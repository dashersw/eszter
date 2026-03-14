import * as t from '@babel/types'
import { parse } from '@babel/parser'
import type {
  FragmentCollectionKind,
  FragmentCollectionNodeMap,
  FragmentCollectionSpec,
  FragmentKind,
  FragmentNodeMap,
  FragmentSpec,
  HoleValue,
  ModuleNode,
  ParseContext
} from './types.js'

/**
 * Placeholder name prefix/suffix.  The UID segment makes them globally unique
 * so they cannot clash with any real identifier in the template string.
 */
const HOLE_PREFIX = '__ESZTER_'
const HOLE_SUFFIX = '__'

function generateUID(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Recursively walk a Babel AST node and replace every Identifier whose name
 * matches a placeholder with the corresponding hole node.
 *
 * We use VISITOR_KEYS to restrict traversal to semantic child positions only,
 * so we never touch comments, location metadata, or other non-AST properties.
 */
function substituteHoles(node: t.Node, replacements: Map<string, t.Node>): t.Node {
  // Base case: if this node itself is a placeholder identifier, replace it.
  if (t.isIdentifier(node)) {
    const replacement = replacements.get(node.name)
    if (replacement !== undefined) {
      return t.cloneNode(replacement as t.Expression, true)
    }
    return node
  }

  // Shallow-copy the node so we don't mutate the parsed AST.
  const copy = { ...node } as Record<string, unknown>

  // Only recurse into the child positions defined by @babel/types itself.
  /* v8 ignore next -- all parsed Babel node types have VISITOR_KEYS entries */
  const keys: string[] = (t.VISITOR_KEYS as Record<string, string[]>)[node.type] ?? []

  for (const key of keys) {
    const val = copy[key]
    if (val === null || val === undefined) continue

    if (Array.isArray(val)) {
      copy[key] = val.map(item => {
        if (item !== null && typeof item === 'object' && typeof (item as t.Node).type === 'string') {
          return substituteHoles(item as t.Node, replacements)
        }
        return item
      })
    } else if (typeof val === 'object' && typeof (val as t.Node).type === 'string') {
      copy[key] = substituteHoles(val as t.Node, replacements)
    }
  }

  return copy as unknown as t.Node
}

/**
 * Coerce a hole value to a Babel AST node.
 * Primitive JS values are automatically promoted to their literal node types.
 */
export function coerceHole(value: HoleValue): t.Node {
  if (typeof value === 'string') return t.stringLiteral(value)
  if (typeof value === 'number') return t.numericLiteral(value)
  if (typeof value === 'boolean') return t.booleanLiteral(value)
  if (value === null) return t.nullLiteral()
  return value
}

function buildSource(
  strings: TemplateStringsArray,
  holes: HoleValue[]
): { source: string; replacements: Map<string, t.Node> } {
  const uid = generateUID()
  let source = strings[0]
  const replacements = new Map<string, t.Node>()
  for (let i = 0; i < holes.length; i++) {
    const node = coerceHole(holes[i])

    if (t.isStringLiteral(node)) {
      source += quoteStringLiteral(node.value) + strings[i + 1]
      continue
    }
    if (t.isNumericLiteral(node)) {
      source += String(node.value) + strings[i + 1]
      continue
    }
    if (t.isBooleanLiteral(node)) {
      source += (node.value ? 'true' : 'false') + strings[i + 1]
      continue
    }
    if (t.isNullLiteral(node)) {
      source += 'null' + strings[i + 1]
      continue
    }

    const placeholder = `${HOLE_PREFIX}${uid}_${i}${HOLE_SUFFIX}`
    replacements.set(placeholder, node)
    source += placeholder + strings[i + 1]
  }
  return { source, replacements }
}

function parseSource(source: string): t.File {
  return parse(source, {
    sourceType: 'module',
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    allowSuperOutsideMethod: true
  })
}

function parseWithHelpfulError(source: string): t.File {
  try {
    return parseSource(source)
  } catch (err) {
    throw new Error(
      `eszter: failed to parse template.\n` +
        `Reconstructed source:\n${source}\n\n` +
        `Parser error: ${(err as Error).message}`
    )
  }
}

function parseFragmentWithHelpfulError(kind: FragmentKind, source: string): t.File {
  try {
    return parseSource(source)
  } catch (err) {
    throw new Error(
      `eszter: failed to parse ${kind} template.\n` +
        `Reconstructed source:\n${source}\n\n` +
        `Parser error: ${(err as Error).message}`
    )
  }
}

function parseFragmentCollectionWithHelpfulError(kind: FragmentCollectionKind, source: string): t.File {
  try {
    return parseSource(source)
  } catch (err) {
    throw new Error(
      `eszter: failed to parse ${kind} template.\n` +
        `Reconstructed source:\n${source}\n\n` +
        `Parser error: ${(err as Error).message}`
    )
  }
}

function parseWrappedExpressionWithHelpfulError(kind: string, source: string): t.File {
  try {
    return parseSource(source)
  } catch (err) {
    throw new Error(
      `eszter: failed to parse ${kind} template.\n` +
        `Reconstructed source:\n${source}\n\n` +
        `Parser error: ${(err as Error).message}`
    )
  }
}

function substituteFile(file: t.File, replacements: Map<string, t.Node>): t.File {
  return substituteHoles(file, replacements) as t.File
}

function quoteStringLiteral(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u0008/g, '\\b')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')}'`
}

function wrapStatements(source: string, context: ParseContext): { wrapped: string; labelCount: number } {
  const labels = Array.from(new Set([...(context.breakLabels ?? []), ...(context.continueLabels ?? [])]))
  let wrapped = `while(true){\n${source}\n}`

  for (let i = labels.length - 1; i >= 0; i--) {
    wrapped = `${labels[i]}: while(true){\n${wrapped}\n}`
  }

  return { wrapped, labelCount: labels.length }
}

function extractWrappedStatements(file: t.File, labelCount: number): t.Statement[] {
  let node: t.Statement = file.program.body[0] as t.Statement

  for (let i = 0; i < labelCount; i++) {
    const labeled = node as t.LabeledStatement
    const labeledLoop = labeled.body as t.WhileStatement
    node = (labeledLoop.body as t.BlockStatement).body[0] as t.Statement
  }

  const whileStmt = node as t.WhileStatement
  return (whileStmt.body as t.BlockStatement).body as t.Statement[]
}

/**
 * Core engine: given the raw strings and hole values from a tagged template,
 * parse the reconstructed source and substitute the holes back in.
 *
 * Returns the list of top-level statements produced.
 */
export function buildAST(strings: TemplateStringsArray, holes: HoleValue[], context: ParseContext = {}): t.Statement[] {
  const { source, replacements } = buildSource(strings, holes)
  const { wrapped, labelCount } = wrapStatements(source, context)
  const file = parseWithHelpfulError(wrapped)
  const substituted = substituteFile(file, replacements)
  return extractWrappedStatements(substituted, labelCount)
}

/** Parse a template as top-level module code. */
export function buildModuleAST(strings: TemplateStringsArray, holes: HoleValue[]): ModuleNode[] {
  const { source, replacements } = buildSource(strings, holes)
  const file = parseWithHelpfulError(source)
  const substituted = substituteFile(file, replacements)
  return substituted.program.body as ModuleNode[]
}

function extractSingleClassMethod(file: t.File): t.ClassMethod {
  const classDecl = file.program.body[0]
  /* v8 ignore start -- fragment wrapper always produces a ClassDeclaration on successful parse */
  if (!t.isClassDeclaration(classDecl)) {
    throw new Error(`eszter: fragment wrapper for ClassMethod did not produce a ClassDeclaration.`)
  }
  /* v8 ignore stop */
  const member = classDecl.body.body[0]
  if (!t.isClassMethod(member)) {
    throw new Error(`eszter: template did not produce a ClassMethod.`)
  }
  return member
}

function extractSingleModuleDeclaration<
  K extends 'ImportDeclaration' | 'ExportNamedDeclaration' | 'ExportDefaultDeclaration' | 'ExportAllDeclaration'
>(file: t.File, kind: K): FragmentNodeMap[K] {
  const declaration = file.program.body[0]
  if (declaration === undefined || declaration.type !== kind) {
    throw new Error(`eszter: template did not produce a ${kind}.`)
  }
  return declaration as FragmentNodeMap[K]
}

function extractSingleClassMember<
  K extends 'ClassMethod' | 'ClassProperty' | 'ClassPrivateMethod' | 'ClassPrivateProperty'
>(file: t.File, kind: K): FragmentNodeMap[K] {
  const classDecl = file.program.body[0]
  /* v8 ignore start -- fragment wrapper always produces a ClassDeclaration on successful parse */
  if (!t.isClassDeclaration(classDecl)) {
    throw new Error(`eszter: fragment wrapper for ${kind} did not produce a ClassDeclaration.`)
  }
  /* v8 ignore stop */
  const member = classDecl.body.body[0]
  if (member === undefined || member.type !== kind) {
    throw new Error(`eszter: template did not produce a ${kind}.`)
  }
  return member as FragmentNodeMap[K]
}

function extractSingleObjectProperty<K extends 'ObjectMethod' | 'ObjectProperty'>(
  file: t.File,
  kind: K
): FragmentNodeMap[K] {
  const stmt = file.program.body[0]
  /* v8 ignore start -- fragment wrapper always produces an ExpressionStatement(ObjectExpression) on successful parse */
  if (!t.isExpressionStatement(stmt) || !t.isObjectExpression(stmt.expression)) {
    throw new Error(`eszter: fragment wrapper for ${kind} did not produce an ObjectExpression.`)
  }
  /* v8 ignore stop */
  const prop = stmt.expression.properties[0]
  if (prop === undefined || t.isSpreadElement(prop) || prop.type !== kind) {
    throw new Error(`eszter: template did not produce an ${kind}.`)
  }
  return prop as FragmentNodeMap[K]
}

function extractSingleVariableDeclarator(file: t.File): t.VariableDeclarator {
  const decl = file.program.body[0]
  /* v8 ignore start -- fragment wrapper always produces a VariableDeclaration on successful parse */
  if (!t.isVariableDeclaration(decl)) {
    throw new Error(`eszter: fragment wrapper for VariableDeclarator did not produce a VariableDeclaration.`)
  }
  /* v8 ignore stop */
  const declarator = decl.declarations[0]
  /* v8 ignore start -- valid const wrapper always yields one VariableDeclarator */
  if (!t.isVariableDeclarator(declarator)) {
    throw new Error(`eszter: template did not produce a VariableDeclarator.`)
  }
  /* v8 ignore stop */
  return declarator
}

function extractSinglePattern(file: t.File): t.LVal {
  const fnDecl = file.program.body[0]
  /* v8 ignore start -- fragment wrapper always produces a FunctionDeclaration on successful parse */
  if (!t.isFunctionDeclaration(fnDecl)) {
    throw new Error(`eszter: fragment wrapper for Pattern did not produce a FunctionDeclaration.`)
  }
  /* v8 ignore stop */
  const param = fnDecl.params[0]
  if (param === undefined) {
    throw new Error(`eszter: template did not produce a Pattern.`)
  }
  return param as t.LVal
}

function extractSingleSpecificPattern<K extends 'ObjectPattern' | 'ArrayPattern' | 'AssignmentPattern' | 'RestElement'>(
  file: t.File,
  kind: K
): FragmentNodeMap[K] {
  const pattern = extractSinglePattern(file)
  if (pattern.type !== kind) {
    throw new Error(`eszter: template did not produce a ${kind}.`)
  }
  return pattern as FragmentNodeMap[K]
}

function extractClassBody(file: t.File): t.ClassBody['body'] {
  const classDecl = file.program.body[0]
  /* v8 ignore start -- collection wrapper always produces a ClassDeclaration on successful parse */
  if (!t.isClassDeclaration(classDecl)) {
    throw new Error(`eszter: collection wrapper for ClassBody did not produce a ClassDeclaration.`)
  }
  /* v8 ignore stop */
  return classDecl.body.body
}

function extractObjectBody(file: t.File): t.ObjectExpression['properties'] {
  const stmt = file.program.body[0]
  /* v8 ignore start -- collection wrapper always produces an ExpressionStatement(ObjectExpression) on successful parse */
  if (!t.isExpressionStatement(stmt) || !t.isObjectExpression(stmt.expression)) {
    throw new Error(`eszter: collection wrapper for ObjectBody did not produce an ObjectExpression.`)
  }
  /* v8 ignore stop */
  return stmt.expression.properties
}

function extractParams(file: t.File): t.FunctionDeclaration['params'] {
  const fnDecl = file.program.body[0]
  /* v8 ignore start -- collection wrapper always produces a FunctionDeclaration on successful parse */
  if (!t.isFunctionDeclaration(fnDecl)) {
    throw new Error(`eszter: collection wrapper for Params did not produce a FunctionDeclaration.`)
  }
  /* v8 ignore stop */
  return fnDecl.params
}

function extractArrayElements(file: t.File): t.ArrayExpression['elements'] {
  const stmt = file.program.body[0]
  /* v8 ignore start -- collection wrapper always produces an ExpressionStatement(ArrayExpression) on successful parse */
  if (!t.isExpressionStatement(stmt) || !t.isArrayExpression(stmt.expression)) {
    throw new Error(`eszter: collection wrapper for ArrayElements did not produce an ArrayExpression.`)
  }
  /* v8 ignore stop */
  return stmt.expression.elements
}

function extractWrappedExpression<K extends t.Expression['type']>(
  file: t.File,
  kind: K
): Extract<t.Expression, { type: K }> {
  const stmt = file.program.body[0]
  /* v8 ignore start -- wrapped expression parser always produces an ExpressionStatement on successful parse */
  if (!t.isExpressionStatement(stmt)) {
    throw new Error(`eszter: wrapped ${kind} template did not produce an ExpressionStatement.`)
  }
  /* v8 ignore stop */
  if (stmt.expression.type !== kind) {
    throw new Error(`eszter: template did not produce a ${kind}.`)
  }
  return stmt.expression as Extract<t.Expression, { type: K }>
}

const FRAGMENT_SPECS: { [K in FragmentKind]: FragmentSpec<K> } = {
  ImportDeclaration: {
    wrap(source) {
      return source
    },
    extract(file) {
      return extractSingleModuleDeclaration(file, 'ImportDeclaration')
    }
  },
  ExportNamedDeclaration: {
    wrap(source) {
      return source
    },
    extract(file) {
      return extractSingleModuleDeclaration(file, 'ExportNamedDeclaration')
    }
  },
  ExportDefaultDeclaration: {
    wrap(source) {
      return source
    },
    extract(file) {
      return extractSingleModuleDeclaration(file, 'ExportDefaultDeclaration')
    }
  },
  ExportAllDeclaration: {
    wrap(source) {
      return source
    },
    extract(file) {
      return extractSingleModuleDeclaration(file, 'ExportAllDeclaration')
    }
  },
  ClassMethod: {
    wrap(source) {
      return `class __EszterFragment__ {\n${source}\n}`
    },
    extract: extractSingleClassMethod
  },
  ClassProperty: {
    wrap(source) {
      return `class __EszterFragment__ {\n${source}\n}`
    },
    extract(file) {
      return extractSingleClassMember(file, 'ClassProperty')
    }
  },
  ClassPrivateMethod: {
    wrap(source) {
      return `class __EszterFragment__ {\n${source}\n}`
    },
    extract(file) {
      return extractSingleClassMember(file, 'ClassPrivateMethod')
    }
  },
  ClassPrivateProperty: {
    wrap(source) {
      return `class __EszterFragment__ {\n${source}\n}`
    },
    extract(file) {
      return extractSingleClassMember(file, 'ClassPrivateProperty')
    }
  },
  ObjectMethod: {
    wrap(source) {
      return `({\n${source}\n})`
    },
    extract(file) {
      return extractSingleObjectProperty(file, 'ObjectMethod')
    }
  },
  ObjectProperty: {
    wrap(source) {
      return `({\n${source}\n})`
    },
    extract(file) {
      return extractSingleObjectProperty(file, 'ObjectProperty')
    }
  },
  VariableDeclarator: {
    wrap(source) {
      return `const ${source};`
    },
    extract: extractSingleVariableDeclarator
  },
  Pattern: {
    wrap(source) {
      return `function __EszterFragment__(${source}) {}`
    },
    extract: extractSinglePattern
  },
  ObjectPattern: {
    wrap(source) {
      return `function __EszterFragment__(${source}) {}`
    },
    extract(file) {
      return extractSingleSpecificPattern(file, 'ObjectPattern')
    }
  },
  ArrayPattern: {
    wrap(source) {
      return `function __EszterFragment__(${source}) {}`
    },
    extract(file) {
      return extractSingleSpecificPattern(file, 'ArrayPattern')
    }
  },
  AssignmentPattern: {
    wrap(source) {
      return `function __EszterFragment__(${source}) {}`
    },
    extract(file) {
      return extractSingleSpecificPattern(file, 'AssignmentPattern')
    }
  },
  RestElement: {
    wrap(source) {
      return `function __EszterFragment__(${source}) {}`
    },
    extract(file) {
      return extractSingleSpecificPattern(file, 'RestElement')
    }
  }
}

const FRAGMENT_COLLECTION_SPECS: { [K in FragmentCollectionKind]: FragmentCollectionSpec<K> } = {
  ModuleBody: {
    wrap(source) {
      return source
    },
    extract(file) {
      return file.program.body as ModuleNode[]
    }
  },
  ClassBody: {
    wrap(source) {
      return `class __EszterFragment__ {\n${source}\n}`
    },
    extract: extractClassBody
  },
  ObjectBody: {
    wrap(source) {
      return `({\n${source}\n})`
    },
    extract: extractObjectBody
  },
  Params: {
    wrap(source) {
      return `function __EszterFragment__(${source}) {}`
    },
    extract: extractParams
  },
  ArrayElements: {
    wrap(source) {
      return `[\n${source}\n]`
    },
    extract: extractArrayElements
  }
}

/** Parse a template inside a fragment-specific wrapper and extract one node. */
export function buildFragmentAST<K extends FragmentKind>(
  kind: K,
  strings: TemplateStringsArray,
  holes: HoleValue[]
): FragmentNodeMap[K] {
  const { source, replacements } = buildSource(strings, holes)
  const wrapped = FRAGMENT_SPECS[kind].wrap(source)
  const file = parseFragmentWithHelpfulError(kind, wrapped)
  const substituted = substituteFile(file, replacements)
  return FRAGMENT_SPECS[kind].extract(substituted)
}

/** Parse a template inside a collection-specific wrapper and extract multiple nodes. */
export function buildFragmentCollectionAST<K extends FragmentCollectionKind>(
  kind: K,
  strings: TemplateStringsArray,
  holes: HoleValue[]
): FragmentCollectionNodeMap[K] {
  const { source, replacements } = buildSource(strings, holes)
  const wrapped = FRAGMENT_COLLECTION_SPECS[kind].wrap(source)
  const file = parseFragmentCollectionWithHelpfulError(kind, wrapped)
  const substituted = substituteFile(file, replacements)
  return FRAGMENT_COLLECTION_SPECS[kind].extract(substituted)
}

/** Parse a full expression inside parens and extract a specific expression kind. */
export function buildWrappedExpressionAST<K extends t.Expression['type']>(
  kind: K,
  strings: TemplateStringsArray,
  holes: HoleValue[]
): Extract<t.Expression, { type: K }> {
  const { source, replacements } = buildSource(strings, holes)
  const file = parseWrappedExpressionWithHelpfulError(kind, `(\n${source}\n)`)
  const substituted = substituteFile(file, replacements)
  return extractWrappedExpression(substituted, kind)
}

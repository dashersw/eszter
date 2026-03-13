import * as t from '@babel/types'
import { parse } from '@babel/parser'
import type { HoleValue, ModuleNode, ParseContext } from './types.js'

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

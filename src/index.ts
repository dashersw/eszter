import * as t from '@babel/types'
import {
  buildAST,
  buildFragmentAST,
  buildFragmentCollectionAST,
  buildModuleAST,
  buildWrappedExpressionAST,
  coerceHole
} from './core.js'
import type {
  FragmentBuilder,
  FragmentCollectionBuilder,
  FragmentCollectionKind,
  FragmentKind,
  InferStatement,
  HoleValue,
  ModuleNode,
  ParseContext
} from './types.js'

export { id, str, num, bool, nil, clone } from './helpers.js'
export {
  appendToBody,
  appendToBlock,
  insertAfter,
  insertBefore,
  prependToBody,
  removeNode,
  renameIdentifier,
  replaceExpr,
  replaceIdentifier,
  replaceBody,
  replaceMany,
  replaceStmt,
  rewrite,
  withBody,
  wrapExpr,
  wrapStmt,
  prependToBlock
} from './edit.js'
export type {
  FragmentBuilder,
  FragmentCollectionBuilder,
  FragmentCollectionKind,
  FragmentKind,
  InferStatement,
  HoleValue,
  ModuleNode,
  ParseContext,
  RewriteVisitor
} from './types.js'

const STRING_PLACEHOLDER = '%%'

function normalizeTemplateInput(input: string | TemplateStringsArray, holes: HoleValue[]): TemplateStringsArray {
  if (typeof input !== 'string') {
    return input
  }

  const cooked = input.split(STRING_PLACEHOLDER)
  const placeholderCount = cooked.length - 1

  if (placeholderCount !== holes.length) {
    throw new Error(
      `eszter: string API expected ${holes.length} "${STRING_PLACEHOLDER}" placeholder(s), got ${placeholderCount}.`
    )
  }

  const raw = [...cooked]
  const strings = [...cooked] as string[] & { raw: readonly string[] }
  Object.defineProperty(strings, 'raw', { value: raw })
  return strings as unknown as TemplateStringsArray
}

export interface ContextualJs {
  <T extends string>(template: T, ...holes: HoleValue[]): InferStatement<T>
  <R extends t.Statement = t.Statement>(strings: TemplateStringsArray, ...holes: HoleValue[]): R
}

export interface ContextualJsAll {
  (template: string, ...holes: HoleValue[]): t.Statement[]
  (strings: TemplateStringsArray, ...holes: HoleValue[]): t.Statement[]
}

export interface ContextualClass {
  (template: string, ...holes: HoleValue[]): t.ClassDeclaration
  (strings: TemplateStringsArray, ...holes: HoleValue[]): t.ClassDeclaration
}

export interface ContextualFunction {
  (template: string, ...holes: HoleValue[]): t.FunctionDeclaration
  (strings: TemplateStringsArray, ...holes: HoleValue[]): t.FunctionDeclaration
}

/**
 * Build a **single** AST statement from a template string.
 *
 * Supports both tagged-template and string-call forms:
 *
 * - Tagged template: ergonomic `${...}` hole syntax.
 * - String call: exact literal-type inference via `InferStatement<T>`.
 *
 * @example
 * const stmt = js('if (!%%) { init(); }', cond)
 * // stmt: t.IfStatement
 *
 * @example
 * const loop = js`for (var i = 0; i < ${arr}.length; i++) {}`
 * // loop: t.Statement by default, but can still narrow via context/generic
 *
 * @throws if the template does not produce exactly one statement.
 */
export function js<T extends string>(template: T, ...holes: HoleValue[]): InferStatement<T>
export function js<R extends t.Statement = t.Statement>(strings: TemplateStringsArray, ...holes: HoleValue[]): R
export function js(stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]): t.Statement {
  const stmts = buildAST(normalizeTemplateInput(stringsOrTemplate, holes), holes)
  if (stmts.length !== 1) {
    throw new Error(
      `eszter: js\`...\` must contain exactly one statement, got ${stmts.length}. ` +
        `Use jsAll\`...\` for multiple statements.`
    )
  }
  return stmts[0]
}

/**
 * Build a single statement with explicit parse context for labeled
 * `break`/`continue` targets.
 */
export function jsInContext(context: ParseContext): ContextualJs {
  return ((stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]) => {
    const stmts = buildAST(normalizeTemplateInput(stringsOrTemplate, holes), holes, context)
    if (stmts.length !== 1) {
      throw new Error(
        `eszter: jsInContext\`...\` must contain exactly one statement, got ${stmts.length}. ` +
          `Use jsAllInContext(...) for multiple statements.`
      )
    }
    return stmts[0]
  }) as ContextualJs
}

/**
 * Build **multiple** AST statements from a template string.
 *
 * @example
 * const stmts = jsAll`
 *   var ${id(parentVar)} = ${id(elVar)}.parentElement;
 *   var ${id(tmpVar)} = ${id(parentVar)}
 *     ? ${id(parentVar)}.cloneNode(false)
 *     : document.createElement('div');
 *   ${id(tmpVar)}.innerHTML = this.${id(renderMethod)}(${id(itemVar)});
 * `
 * // stmts: t.Statement[]
 */
export function jsAll(template: string, ...holes: HoleValue[]): t.Statement[]
export function jsAll(strings: TemplateStringsArray, ...holes: HoleValue[]): t.Statement[]
export function jsAll(stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]): t.Statement[] {
  return buildAST(normalizeTemplateInput(stringsOrTemplate, holes), holes)
}

/** Alias for jsAll when the statements are intended for a block or method body. */
export const jsBlockBody = jsAll

/** Build multiple statements with explicit parse context for labeled control flow. */
export function jsAllInContext(context: ParseContext): ContextualJsAll {
  return ((stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]) => {
    return buildAST(normalizeTemplateInput(stringsOrTemplate, holes), holes, context)
  }) as ContextualJsAll
}

/** Build top-level module statements and declarations, including import/export. */
export function jsModule(template: string, ...holes: HoleValue[]): ModuleNode[]
export function jsModule(strings: TemplateStringsArray, ...holes: HoleValue[]): ModuleNode[]
export function jsModule(stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]): ModuleNode[] {
  return buildModuleAST(normalizeTemplateInput(stringsOrTemplate, holes), holes)
}

/** Build a fragment node that needs a wrapper-specific parse context. */
export function jsAs<K extends FragmentKind>(kind: K): FragmentBuilder<K> {
  return ((stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]) => {
    return buildFragmentAST(kind, normalizeTemplateInput(stringsOrTemplate, holes), holes)
  }) as FragmentBuilder<K>
}

/** Alias for jsAs(...) when you want a more generic name. */
export const parseAs = jsAs

/** Build a fragment collection that needs a wrapper-specific parse context. */
export function jsAsMany<K extends FragmentCollectionKind>(kind: K): FragmentCollectionBuilder<K> {
  return ((stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]) => {
    return buildFragmentCollectionAST(kind, normalizeTemplateInput(stringsOrTemplate, holes), holes)
  }) as FragmentCollectionBuilder<K>
}

/** Alias for jsAsMany(...) when you want a more generic name. */
export const parseAsMany = jsAsMany

/** Build a single class method fragment. */
export const jsMethod = jsAs('ClassMethod')

/** Build a single import declaration fragment. */
export const jsImport = jsAs('ImportDeclaration')

/** Build a single named export declaration fragment. */
export const jsExport = jsAs('ExportNamedDeclaration')

/** Build a single default export declaration fragment. */
export const jsExportDefault = jsAs('ExportDefaultDeclaration')

/** Build a single export-all declaration fragment. */
export const jsExportAll = jsAs('ExportAllDeclaration')

/** Build a single class property fragment. */
export const jsClassProp = jsAs('ClassProperty')

/** Build a single private class method fragment. */
export const jsPrivateMethod = jsAs('ClassPrivateMethod')

/** Build a single private class property fragment. */
export const jsPrivateProp = jsAs('ClassPrivateProperty')

/** Build a single object method fragment. */
export const jsObjectMethod = jsAs('ObjectMethod')

/** Build a single object property fragment. */
export const jsProp = jsAs('ObjectProperty')

/** Alias for jsProp when object-property naming reads better at the call site. */
export const jsObjectProp = jsProp

/** Build a single variable declarator fragment. */
export const jsDeclarator = jsAs('VariableDeclarator')

/** Build a single parameter/pattern fragment. */
export const jsPattern = jsAs('Pattern')

/** Build a single object-pattern fragment. */
export const jsObjectPattern = jsAs('ObjectPattern')

/** Build a single array-pattern fragment. */
export const jsArrayPattern = jsAs('ArrayPattern')

/** Build a single assignment-pattern fragment. */
export const jsAssignmentPattern = jsAs('AssignmentPattern')

/** Build a single rest-element fragment. */
export const jsRest = jsAs('RestElement')

/** Alias for jsPattern when parameter naming reads better at the call site. */
export const jsParam = jsPattern

/** Build a class-body member list. */
export const jsClassBody = jsAsMany('ClassBody')

/** Build a module-body statement/declaration list. */
export const jsModuleBody = jsAsMany('ModuleBody')

/** Build an object-member list. */
export const jsObjectBody = jsAsMany('ObjectBody')

/** Build a function parameter list. */
export const jsParams = jsAsMany('Params')

/** Build an array element list. */
export const jsArrayElements = jsAsMany('ArrayElements')

/**
 * Build a single AST **expression** from a template string.
 *
 * The template must be a single expression (no trailing semicolon required,
 * but it must produce exactly one expression statement when parsed).
 *
 * @example
 * const expr = jsExpr`${el}.textContent !== ${value}`
 * // expr: t.Expression  (t.BinaryExpression at runtime)
 *
 * @example
 * const call = jsExpr`${id(arr)}.find(__t => __t.${id(idProp)} === ${idExpr})`
 * // call: t.Expression  (t.CallExpression at runtime)
 *
 * @throws if the template is not a single expression statement.
 */
export function jsExpr(template: string, ...holes: HoleValue[]): t.Expression
export function jsExpr(strings: TemplateStringsArray, ...holes: HoleValue[]): t.Expression
export function jsExpr(stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]): t.Expression {
  const stmts = buildAST(normalizeTemplateInput(stringsOrTemplate, holes), holes)
  if (stmts.length !== 1) {
    throw new Error(
      `eszter: jsExpr\`...\` must be a single expression, got ${stmts.length} statements. ` +
        `Use jsAll\`...\` for multiple statements.`
    )
  }
  const stmt = stmts[0]
  if (!t.isExpressionStatement(stmt)) {
    throw new Error(
      `eszter: jsExpr\`...\` must be an expression statement, got ${stmt.type}. ` + `Use js\`...\` for full statements.`
    )
  }
  return stmt.expression
}

/** Build a single object expression with an explicit object-focused name. */
export function jsObjectExpr(template: string, ...holes: HoleValue[]): t.ObjectExpression
export function jsObjectExpr(strings: TemplateStringsArray, ...holes: HoleValue[]): t.ObjectExpression
export function jsObjectExpr(
  stringsOrTemplate: string | TemplateStringsArray,
  ...holes: HoleValue[]
): t.ObjectExpression {
  return buildWrappedExpressionAST('ObjectExpression', normalizeTemplateInput(stringsOrTemplate, holes), holes)
}

/** Build a single array expression with an explicit array-focused name. */
export function jsArrayExpr(template: string, ...holes: HoleValue[]): t.ArrayExpression
export function jsArrayExpr(strings: TemplateStringsArray, ...holes: HoleValue[]): t.ArrayExpression
export function jsArrayExpr(
  stringsOrTemplate: string | TemplateStringsArray,
  ...holes: HoleValue[]
): t.ArrayExpression {
  return buildWrappedExpressionAST('ArrayExpression', normalizeTemplateInput(stringsOrTemplate, holes), holes)
}

/** Build a single class declaration with an explicit class-focused name. */
export function jsClass(template: string, ...holes: HoleValue[]): t.ClassDeclaration
export function jsClass(strings: TemplateStringsArray, ...holes: HoleValue[]): t.ClassDeclaration
export function jsClass(stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]): t.ClassDeclaration {
  return js(stringsOrTemplate as string & TemplateStringsArray, ...holes) as t.ClassDeclaration
}

/** Build a single function declaration with an explicit function-focused name. */
export function jsFunction(template: string, ...holes: HoleValue[]): t.FunctionDeclaration
export function jsFunction(strings: TemplateStringsArray, ...holes: HoleValue[]): t.FunctionDeclaration
export function jsFunction(
  stringsOrTemplate: string | TemplateStringsArray,
  ...holes: HoleValue[]
): t.FunctionDeclaration {
  return js(stringsOrTemplate as string & TemplateStringsArray, ...holes) as t.FunctionDeclaration
}

/**
 * Build a `t.TemplateLiteral` node from a tagged template string.
 *
 * This solves the template-literal-in-generated-code problem: instead of
 * escaping backticks inside `js\`...\``, use `tpl\`...\`` as a hole.
 *
 * Holes may be AST nodes or raw primitives (auto-coerced to literals).
 *
 * @example
 * // Generate:  container.querySelector(`[key="${id}"]`)
 * const selector = tpl`[key="${idExpr}"]`
 * const call = jsExpr`${containerRef}.querySelector(${selector})`
 *
 * @example
 * // Generate:  const msg = `Hello, ${name}!`
 * const decl = js`const msg = ${tpl`Hello, ${nameExpr}!`};`
 */
export function tpl(template: string, ...holes: HoleValue[]): t.TemplateLiteral
export function tpl(strings: TemplateStringsArray, ...holes: HoleValue[]): t.TemplateLiteral
export function tpl(stringsOrTemplate: string | TemplateStringsArray, ...holes: HoleValue[]): t.TemplateLiteral {
  const strings = normalizeTemplateInput(stringsOrTemplate, holes)
  const quasis: t.TemplateElement[] = []
  const expressions: t.Expression[] = []

  for (let i = 0; i < strings.length; i++) {
    const tail = i === strings.length - 1
    quasis.push(t.templateElement({ raw: strings.raw[i], cooked: strings[i] }, tail))
    if (!tail) {
      expressions.push(coerceHole(holes[i]) as t.Expression)
    }
  }

  return t.templateLiteral(quasis, expressions)
}

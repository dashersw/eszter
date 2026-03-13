import * as t from '@babel/types'
import { buildAST, buildModuleAST, coerceHole } from './core.js'
import type { InferStatement, HoleValue, ModuleNode, ParseContext } from './types.js'

export { id, str, num, bool, nil, clone } from './helpers.js'
export type { InferStatement, HoleValue, ModuleNode, ParseContext } from './types.js'

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

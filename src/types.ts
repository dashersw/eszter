import type * as t from '@babel/types'

/**
 * Strips leading whitespace characters from a string literal type.
 * Used so that indented templates still infer the correct return type.
 *
 * TrimWS<'  if (x) {}'> → 'if (x) {}'
 */
export type TrimWS<S extends string> = S extends ` ${infer R}` | `\n${infer R}` | `\t${infer R}` | `\r${infer R}`
  ? TrimWS<R>
  : S

/**
 * Infers the precise Babel statement node type from the first keyword in a
 * template string.  This is what makes js`if (...) {}` return t.IfStatement
 * instead of the broad t.Statement.
 *
 * The pattern match runs after stripping leading whitespace so indented
 * multi-line templates work identically.
 */
export type InferStatement<T extends string> =
  TrimWS<T> extends `if${string}`
    ? t.IfStatement
    : TrimWS<T> extends `var ${string}` | `let ${string}` | `const ${string}`
      ? t.VariableDeclaration
      : TrimWS<T> extends `return${string}`
        ? t.ReturnStatement
        : TrimWS<T> extends `for${string}`
          ? t.ForStatement
          : TrimWS<T> extends `while${string}`
            ? t.WhileStatement
            : TrimWS<T> extends `do${string}`
              ? t.DoWhileStatement
              : TrimWS<T> extends `continue${string}`
                ? t.ContinueStatement
                : TrimWS<T> extends `break${string}`
                  ? t.BreakStatement
                  : TrimWS<T> extends `throw ${string}`
                    ? t.ThrowStatement
                    : TrimWS<T> extends `switch${string}`
                      ? t.SwitchStatement
                      : TrimWS<T> extends `try${string}`
                        ? t.TryStatement
                        : TrimWS<T> extends `function${string}`
                          ? t.FunctionDeclaration
                          : TrimWS<T> extends `class${string}`
                            ? t.ClassDeclaration
                            : TrimWS<T> extends `{${string}`
                              ? t.BlockStatement
                              : t.Statement

/** Top-level nodes that may appear in a parsed module body. */
export type ModuleNode = t.Statement | t.ModuleDeclaration

/**
 * Optional parse context for statement templates that need extra surrounding
 * syntax to be valid during parsing.
 */
export interface ParseContext {
  breakLabels?: readonly string[]
  continueLabels?: readonly string[]
}

/**
 * Accepted types for template holes.
 *
 * Primitive values are automatically coerced to their AST literal equivalents:
 *   string  → t.StringLiteral
 *   number  → t.NumericLiteral
 *   boolean → t.BooleanLiteral
 *   null    → t.NullLiteral
 *
 * This means you can write js`this.$(${'.root'})` instead of js`this.$(${str('.root')})`.
 */
export type HoleValue = t.Node | string | number | boolean | null

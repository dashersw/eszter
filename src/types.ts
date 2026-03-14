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

/** Fragment node kinds that need wrapper-specific parse contexts. */
export type FragmentKind =
  | 'ImportDeclaration'
  | 'ExportNamedDeclaration'
  | 'ExportDefaultDeclaration'
  | 'ExportAllDeclaration'
  | 'ClassMethod'
  | 'ClassProperty'
  | 'ClassPrivateMethod'
  | 'ClassPrivateProperty'
  | 'ObjectMethod'
  | 'ObjectProperty'
  | 'VariableDeclarator'
  | 'Pattern'
  | 'ObjectPattern'
  | 'ArrayPattern'
  | 'AssignmentPattern'
  | 'RestElement'

/** Maps a fragment kind to the Babel node type it returns. */
export interface FragmentNodeMap {
  ImportDeclaration: t.ImportDeclaration
  ExportNamedDeclaration: t.ExportNamedDeclaration
  ExportDefaultDeclaration: t.ExportDefaultDeclaration
  ExportAllDeclaration: t.ExportAllDeclaration
  ClassMethod: t.ClassMethod
  ClassProperty: t.ClassProperty
  ClassPrivateMethod: t.ClassPrivateMethod
  ClassPrivateProperty: t.ClassPrivateProperty
  ObjectMethod: t.ObjectMethod
  ObjectProperty: t.ObjectProperty
  VariableDeclarator: t.VariableDeclarator
  Pattern: t.LVal
  ObjectPattern: t.ObjectPattern
  ArrayPattern: t.ArrayPattern
  AssignmentPattern: t.AssignmentPattern
  RestElement: t.RestElement
}

/** Wrapper/extractor contract for fragment parsing. */
export interface FragmentSpec<K extends FragmentKind = FragmentKind> {
  wrap(source: string): string
  extract(file: t.File): FragmentNodeMap[K]
}

/** Callable template builder for fragment-parsing helpers. */
export interface FragmentBuilder<K extends FragmentKind> {
  (template: string, ...holes: HoleValue[]): FragmentNodeMap[K]
  (strings: TemplateStringsArray, ...holes: HoleValue[]): FragmentNodeMap[K]
}

/** Fragment collection kinds that return a list extracted from a wrapper. */
export type FragmentCollectionKind = 'ModuleBody' | 'ClassBody' | 'ObjectBody' | 'Params' | 'ArrayElements'

/** Maps a collection kind to the Babel node list it returns. */
export interface FragmentCollectionNodeMap {
  ModuleBody: ModuleNode[]
  ClassBody: t.ClassBody['body']
  ObjectBody: t.ObjectExpression['properties']
  Params: t.FunctionDeclaration['params']
  ArrayElements: t.ArrayExpression['elements']
}

/** Wrapper/extractor contract for collection fragment parsing. */
export interface FragmentCollectionSpec<K extends FragmentCollectionKind = FragmentCollectionKind> {
  wrap(source: string): string
  extract(file: t.File): FragmentCollectionNodeMap[K]
}

/** Callable template builder for collection fragment helpers. */
export interface FragmentCollectionBuilder<K extends FragmentCollectionKind> {
  (template: string, ...holes: HoleValue[]): FragmentCollectionNodeMap[K]
  (strings: TemplateStringsArray, ...holes: HoleValue[]): FragmentCollectionNodeMap[K]
}

/** Lightweight subtree rewrite visitor. */
export type RewriteVisitor = Partial<{
  [K in t.Node['type']]: (node: Extract<t.Node, { type: K }>) => t.Node | void
}> & {
  enter?: (node: t.Node) => t.Node | void
  exit?: (node: t.Node) => t.Node | void
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

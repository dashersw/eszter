import * as t from '@babel/types'

/**
 * Build a t.Identifier, preserving the name as a literal type so TypeScript
 * can track it through the AST.
 *
 * @example
 * const node = id('__container')
 * // node: t.Identifier & { name: '__container' }
 */
export function id<N extends string>(name: N): t.Identifier & { name: N } {
  return t.identifier(name) as t.Identifier & { name: N }
}

/**
 * Build a t.StringLiteral, preserving the value as a literal type.
 *
 * Use this inside template holes when you need a JS string literal rather
 * than an identifier.  Without it, bare strings are treated as identifiers.
 *
 * @example
 * js`this.$({ str('.container') })`   // → this.$('.container')
 * js`this.$({ id('x') })`             // → this.$(x)
 */
export function str<V extends string>(value: V): t.StringLiteral & { value: V } {
  return t.stringLiteral(value) as t.StringLiteral & { value: V }
}

/**
 * Build a t.NumericLiteral, preserving the value as a literal type.
 */
export function num<V extends number>(value: V): t.NumericLiteral & { value: V } {
  return t.numericLiteral(value) as t.NumericLiteral & { value: V }
}

/**
 * Build a t.BooleanLiteral, preserving the value as a literal type.
 */
export function bool<V extends boolean>(value: V): t.BooleanLiteral & { value: V } {
  return t.booleanLiteral(value) as t.BooleanLiteral & { value: V }
}

/** Build a t.NullLiteral. */
export function nil(): t.NullLiteral {
  return t.nullLiteral()
}

/**
 * Deep-clone a Babel AST node.  Thin alias for t.cloneNode that avoids
 * importing @babel/types at every call site.
 */
export function clone<T extends t.Node>(node: T): T {
  return t.cloneNode(node, true)
}

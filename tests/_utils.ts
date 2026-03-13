/**
 * Shared test utilities: code generation and assertion helpers.
 */
import { createRequire } from 'module'
import * as t from '@babel/types'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const _generate = require('@babel/generator')
const generate: (node: t.Node) => { code: string } = _generate.default ?? _generate

/** Convert any Babel AST node back to a compact code string. */
export function code(node: t.Node): string {
  return generate(node, { jsescOption: { quotes: 'single' } }).code.trim()
}

/**
 * Assert that a node serialises to the expected code string and optionally
 * has the expected Babel node type.
 */
export function assertCode(node: t.Node, expected: string, expectedType?: string): void {
  const actual = code(node)
  assert.equal(actual, expected, `Generated code mismatch`)
  if (expectedType !== undefined) {
    assert.equal(node.type, expectedType, `Node type mismatch`)
  }
}

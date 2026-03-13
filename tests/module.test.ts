/**
 * Tests for top-level module parsing helpers.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { jsModule, id, str } from '../src/index.js'
import { assertCode } from './_utils.js'

describe('jsModule', () => {
  it('parses import and export declarations', () => {
    const nodes = jsModule`
      import { foo } from './dep';
      export const value = 1;
    `
    assert.equal(nodes.length, 2)
    assert.equal(nodes[0].type, 'ImportDeclaration')
    assert.equal(nodes[1].type, 'ExportNamedDeclaration')
    assertCode(nodes[0] as t.Node, "import { foo } from './dep';")
    assertCode(nodes[1] as t.Node, 'export const value = 1;')
  })

  it('supports the string-call form with holes', () => {
    const nodes = jsModule(
      'import { %% as %% } from %%; export const %% = %%;',
      id('foo'),
      id('bar'),
      str('./dep'),
      id('answer'),
      42
    )
    assert.equal(nodes.length, 2)
    assertCode(nodes[0] as t.Node, "import { foo as bar } from './dep';")
    assertCode(nodes[1] as t.Node, 'export const answer = 42;')
  })
})

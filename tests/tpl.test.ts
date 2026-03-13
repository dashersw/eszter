/**
 * Tests for the tpl`` tagged template helper.
 *
 * tpl`` builds t.TemplateLiteral nodes so you can embed template literals
 * in generated code without escaping backticks inside js`...`.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { js, jsExpr, tpl } from '../src/index.js'
import { assertCode, code } from './_utils.js'

describe('tpl``', () => {
  it('produces a TemplateLiteral node', () => {
    const node = tpl`hello world`
    assert.equal(node.type, 'TemplateLiteral')
  })

  it('static template (no holes)', () => {
    const node = tpl`hello world`
    assert.equal(node.quasis.length, 1)
    assert.equal(node.expressions.length, 0)
    assert.equal(node.quasis[0].value.cooked, 'hello world')
    assert.equal(node.quasis[0].value.raw, 'hello world')
    assert.ok(node.quasis[0].tail)
  })

  it('template with one hole (AST node)', () => {
    const nameExpr = t.identifier('name')
    const node = tpl`Hello, ${nameExpr}!`
    assert.equal(node.quasis.length, 2)
    assert.equal(node.expressions.length, 1)
    assert.equal(node.quasis[0].value.cooked, 'Hello, ')
    assert.equal(node.quasis[1].value.cooked, '!')
    assert.ok(node.quasis[1].tail)
    assert.equal((node.expressions[0] as t.Identifier).name, 'name')
  })

  it('template with primitive string hole', () => {
    const node = tpl`[key="${'someKey'}"]`
    assert.equal(node.expressions.length, 1)
    assert.equal(node.expressions[0].type, 'StringLiteral')
    assert.equal((node.expressions[0] as t.StringLiteral).value, 'someKey')
  })

  it('template with multiple holes', () => {
    const a = t.identifier('a')
    const b = t.identifier('b')
    const node = tpl`${a} and ${b}`
    assert.equal(node.quasis.length, 3)
    assert.equal(node.expressions.length, 2)
    assert.equal(node.quasis[0].value.cooked, '')
    assert.equal(node.quasis[1].value.cooked, ' and ')
    assert.equal(node.quasis[2].value.cooked, '')
  })

  it('can be used as a hole inside js``', () => {
    const idExpr = t.identifier('itemId')
    const selector = tpl`[key="${idExpr}"]`
    const stmt = js`var sel = ${selector};`
    assertCode(stmt, 'var sel = `[key="${itemId}"]`;')
  })

  it('can be used as a hole inside jsExpr``', () => {
    const idExpr = t.identifier('id')
    const containerRef = t.memberExpression(t.thisExpression(), t.identifier('__container'))
    const selector = tpl`[key="${idExpr}"]`
    const expr = jsExpr`${containerRef}.querySelector(${selector})`
    assertCode(expr, 'this.__container.querySelector(`[key="${id}"]`)')
  })

  it('static tpl`` used as hole produces a template literal in output', () => {
    const stmt = js`var x = ${tpl`hello`};`
    assertCode(stmt, 'var x = `hello`;')
  })

  it('preserves raw string for escape sequences', () => {
    // raw should differ from cooked for escape sequences
    const node = tpl`line1\nline2`
    assert.equal(node.quasis[0].value.raw, 'line1\\nline2')
    // cooked is the interpreted version from the template
    assert.equal(node.quasis[0].value.cooked, 'line1\nline2')
  })

  it('querySelector pattern — the primary use case', () => {
    const idVar = t.identifier('__key')
    const containerRef = t.memberExpression(t.thisExpression(), t.identifier('__todos_container'))
    const selector = tpl`[key="${idVar}"]`
    const expr = jsExpr`${containerRef}.querySelector(${selector})`
    assertCode(expr, 'this.__todos_container.querySelector(`[key="${__key}"]`)')
  })

  it('supports the string API with placeholders', () => {
    const node = tpl('Hello, %%!', t.identifier('name'))
    assert.equal(node.quasis.length, 2)
    assert.equal(node.expressions.length, 1)
    assert.equal(node.quasis[0].value.cooked, 'Hello, ')
    assert.equal(node.quasis[1].value.cooked, '!')
    assertCode(js`var msg = ${node};`, 'var msg = `Hello, ${name}!`;')
  })
})

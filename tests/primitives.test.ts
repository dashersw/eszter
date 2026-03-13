/**
 * Tests for primitive hole coercion.
 *
 * Verifies that raw JS primitives passed as holes are automatically promoted
 * to the correct Babel literal node types without needing str()/num()/bool()/nil().
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { js, jsAll, jsExpr } from '../src/index.js'
import { assertCode } from './_utils.js'

describe('primitive holes — string', () => {
  it('bare string coerced to StringLiteral in js`...`', () => {
    const stmt = js`var x = ${'hello'};`
    assertCode(stmt, "var x = 'hello';", 'VariableDeclaration')
  })

  it('bare string in jsExpr`...`', () => {
    const expr = jsExpr`foo(${'bar'})`
    assertCode(expr, "foo('bar')")
  })

  it('bare string hole replaces str()', () => {
    const sel = '.root'
    const stmt = js`this.$(${sel});`
    assertCode(stmt, "this.$('.root');")
  })

  it('multiple string holes in one template', () => {
    const stmt = js`el.setAttribute(${'data-id'}, ${'value'});`
    assertCode(stmt, "el.setAttribute('data-id', 'value');")
  })
})

describe('primitive holes — number', () => {
  it('bare number coerced to NumericLiteral', () => {
    const stmt = js`var n = ${42};`
    assertCode(stmt, 'var n = 42;', 'VariableDeclaration')
  })

  it('float number', () => {
    const stmt = js`var f = ${3.14};`
    assertCode(stmt, 'var f = 3.14;')
  })
})

describe('primitive holes — boolean', () => {
  it('true coerced to BooleanLiteral', () => {
    const stmt = js`var b = ${true};`
    assertCode(stmt, 'var b = true;', 'VariableDeclaration')
  })

  it('false coerced to BooleanLiteral', () => {
    const stmt = js`el.cloneNode(${false});`
    assertCode(stmt, 'el.cloneNode(false);')
  })
})

describe('primitive holes — null', () => {
  it('null coerced to NullLiteral', () => {
    const stmt = js`var n = ${null};`
    assertCode(stmt, 'var n = null;', 'VariableDeclaration')
  })

  it('null in conditional', () => {
    const stmt = js`var v = cond ? x : ${null};`
    assertCode(stmt, 'var v = cond ? x : null;')
  })
})

describe('primitive holes — mixed with nodes', () => {
  it('string and node in same template', () => {
    const el = t.identifier('el')
    const stmt = js`${el}.setAttribute(${'data-id'}, value);`
    assertCode(stmt, "el.setAttribute('data-id', value);")
  })

  it('jsAll with primitive holes', () => {
    const stmts = jsAll`
      var x = ${'hello'};
      var y = ${42};
      var z = ${true};
      var w = ${null};
    `
    assert.equal(stmts.length, 4)
    assertCode(stmts[0], "var x = 'hello';")
    assertCode(stmts[1], 'var y = 42;')
    assertCode(stmts[2], 'var z = true;')
    assertCode(stmts[3], 'var w = null;')
  })
})

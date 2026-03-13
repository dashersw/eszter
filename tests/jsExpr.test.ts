/**
 * Tests for jsExpr`...` — building a single expression.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { jsExpr, id, str, num, bool, nil } from '../src/index.js'
import { assertCode } from './_utils.js'

describe('jsExpr — unary expressions', () => {
  it('!x', () => {
    const expr = jsExpr`!x`
    assert.equal(expr.type, 'UnaryExpression')
    assertCode(expr, '!x')
  })

  it('!hole', () => {
    const x = t.identifier('myFlag')
    const expr = jsExpr`!${x}`
    assert.equal(expr.type, 'UnaryExpression')
    assertCode(expr, '!myFlag')
  })

  it('typeof x', () => {
    const expr = jsExpr`typeof x`
    assert.equal(expr.type, 'UnaryExpression')
    assertCode(expr, 'typeof x')
  })

  it('void 0', () => {
    const expr = jsExpr`void 0`
    assert.equal(expr.type, 'UnaryExpression')
    assertCode(expr, 'void 0')
  })
})

describe('jsExpr("...") string API', () => {
  it('builds a unary expression from a literal string', () => {
    const expr = jsExpr('!x')
    assert.equal(expr.type, 'UnaryExpression')
    assertCode(expr, '!x')
  })

  it('supports placeholders in function-call form', () => {
    const expr = jsExpr('%%.getAttribute(%%)', t.identifier('el'), str('data-id'))
    assert.equal(expr.type, 'CallExpression')
    assertCode(expr, "el.getAttribute('data-id')")
  })
})

describe('jsExpr — binary expressions', () => {
  it('a !== b', () => {
    const a = t.identifier('a')
    const b = t.identifier('b')
    const expr = jsExpr`${a} !== ${b}`
    assert.equal(expr.type, 'BinaryExpression')
    assert.equal((expr as t.BinaryExpression).operator, '!==')
    assertCode(expr, 'a !== b')
  })

  it('a === b', () => {
    const expr = jsExpr`a === b`
    assert.equal(expr.type, 'BinaryExpression')
    assert.equal((expr as t.BinaryExpression).operator, '===')
  })

  it('a < b', () => {
    const expr = jsExpr`i < n`
    assert.equal(expr.type, 'BinaryExpression')
  })

  it('a >= 0', () => {
    const expr = jsExpr`idx >= 0`
    assert.equal(expr.type, 'BinaryExpression')
  })

  it('a + b', () => {
    const expr = jsExpr`a + b`
    assert.equal(expr.type, 'BinaryExpression')
    assertCode(expr, 'a + b')
  })
})

describe('jsExpr — logical expressions', () => {
  it('a && b', () => {
    const expr = jsExpr`a && b`
    assert.equal(expr.type, 'LogicalExpression')
    assertCode(expr, 'a && b')
  })

  it('a || b', () => {
    const expr = jsExpr`a || b`
    assert.equal(expr.type, 'LogicalExpression')
    assertCode(expr, 'a || b')
  })

  it('compound: a || b with holes', () => {
    const proxied = t.memberExpression(t.thisExpression(), t.identifier('state'))
    const raw = t.memberExpression(proxied, t.identifier('__getTarget'))
    const expr = jsExpr`${raw} || ${proxied}`
    assert.equal(expr.type, 'LogicalExpression')
    assertCode(expr, 'this.state.__getTarget || this.state')
  })
})

describe('jsExpr — member expressions', () => {
  it('obj.prop', () => {
    const expr = jsExpr`el.textContent`
    assert.equal(expr.type, 'MemberExpression')
    assertCode(expr, 'el.textContent')
  })

  it('this.${hole}', () => {
    const expr = jsExpr`this.${id('__container')}`
    assert.equal(expr.type, 'MemberExpression')
    assertCode(expr, 'this.__container')
  })

  it('${expr}.property', () => {
    const el = t.identifier('el')
    const expr = jsExpr`${el}.parentElement`
    assert.equal(expr.type, 'MemberExpression')
    assertCode(expr, 'el.parentElement')
  })

  it('computed member: arr[i]', () => {
    const expr = jsExpr`arr[i]`
    assert.equal(expr.type, 'MemberExpression')
    assert.equal((expr as t.MemberExpression).computed, true)
  })
})

describe('jsExpr — call expressions', () => {
  it('fn()', () => {
    const expr = jsExpr`fn()`
    assert.equal(expr.type, 'CallExpression')
  })

  it('obj.method(arg)', () => {
    const expr = jsExpr`el.getAttribute('key')`
    assert.equal(expr.type, 'CallExpression')
    assertCode(expr, "el.getAttribute('key')")
  })

  it('method with holes as arguments', () => {
    const el = t.identifier('el')
    const attr = str('data-id')
    const expr = jsExpr`${el}.getAttribute(${attr})`
    assert.equal(expr.type, 'CallExpression')
    assertCode(expr, "el.getAttribute('data-id')")
  })

  it('chained method call', () => {
    const arr = t.identifier('__rawArr')
    const idProp = id('id')
    const idExpr = t.identifier('value')
    const expr = jsExpr`${arr}.findIndex(__d => __d.${idProp} === ${idExpr})`
    assert.equal(expr.type, 'CallExpression')
    assertCode(expr, '__rawArr.findIndex(__d => __d.id === value)')
  })
})

describe('jsExpr — assignment expressions', () => {
  it('a = b', () => {
    const el = t.memberExpression(t.identifier('el'), t.identifier('textContent'))
    const val = t.identifier('newText')
    const expr = jsExpr`${el} = ${val}`
    assert.equal(expr.type, 'AssignmentExpression')
    assertCode(expr, 'el.textContent = newText')
  })
})

describe('jsExpr — conditional expressions', () => {
  it('a ? b : c', () => {
    const parent = id('parent')
    const child = id('child')
    const expr = jsExpr`${parent} ? ${parent}.cloneNode(${bool(false)}) : document.createElement(${str('div')})`
    assert.equal(expr.type, 'ConditionalExpression')
    assertCode(expr, "parent ? parent.cloneNode(false) : document.createElement('div')")
  })
})

describe('jsExpr — arrow functions', () => {
  it('simple arrow', () => {
    const idProp = id('id')
    const idExpr = t.identifier('value')
    const expr = jsExpr`arr.find(__t => __t.${idProp} === ${idExpr})`
    assert.equal(expr.type, 'CallExpression')
    assertCode(expr, 'arr.find(__t => __t.id === value)')
  })
})

describe('jsExpr — new expressions', () => {
  it('new Foo()', () => {
    const expr = jsExpr`new Error('oops')`
    assert.equal(expr.type, 'NewExpression')
  })
})

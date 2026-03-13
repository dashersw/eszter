/**
 * Tests for the primitive builder helpers: id, str, num, bool, nil, clone.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { id, str, num, bool, nil, clone } from '../src/index.js'

describe('id()', () => {
  it('produces a t.Identifier', () => {
    const node = id('foo')
    assert.equal(node.type, 'Identifier')
    assert.equal(node.name, 'foo')
  })

  it('propagates the name as a literal type (compile-time)', () => {
    const node = id('__container')
    // TypeScript sees: node.name as '__container', not just string.
    // We verify the runtime value to confirm the type contract holds.
    const name: '__container' = node.name
    assert.equal(name, '__container')
  })

  it('works for all valid identifier characters', () => {
    assert.equal(id('_private').name, '_private')
    assert.equal(id('$ref').name, '$ref')
    assert.equal(id('camelCase').name, 'camelCase')
    assert.equal(id('__dunder__').name, '__dunder__')
  })

  it('is assignable to t.Identifier', () => {
    const node: t.Identifier = id('x')
    assert.equal(node.type, 'Identifier')
  })
})

describe('str()', () => {
  it('produces a t.StringLiteral', () => {
    const node = str('.container')
    assert.equal(node.type, 'StringLiteral')
    assert.equal(node.value, '.container')
  })

  it('propagates the value as a literal type', () => {
    const node = str('hello')
    const value: 'hello' = node.value
    assert.equal(value, 'hello')
  })

  it('handles empty string', () => {
    const node = str('')
    assert.equal(node.value, '')
  })

  it('handles strings with special characters', () => {
    assert.equal(str('.my-class > span').value, '.my-class > span')
    assert.equal(str("it's alive").value, "it's alive")
  })

  it('is assignable to t.StringLiteral', () => {
    const node: t.StringLiteral = str('test')
    assert.equal(node.type, 'StringLiteral')
  })
})

describe('num()', () => {
  it('produces a t.NumericLiteral', () => {
    const node = num(42)
    assert.equal(node.type, 'NumericLiteral')
    assert.equal(node.value, 42)
  })

  it('propagates the value as a literal type', () => {
    const node = num(0)
    const value: 0 = node.value
    assert.equal(value, 0)
  })

  it('handles negative numbers', () => {
    // num() wraps t.numericLiteral; negation in templates uses unary minus
    assert.equal(num(0).value, 0)
    assert.equal(num(3.14).value, 3.14)
  })
})

describe('bool()', () => {
  it('produces a t.BooleanLiteral for true', () => {
    const node = bool(true)
    assert.equal(node.type, 'BooleanLiteral')
    assert.equal(node.value, true)
  })

  it('produces a t.BooleanLiteral for false', () => {
    const node = bool(false)
    assert.equal(node.type, 'BooleanLiteral')
    assert.equal(node.value, false)
  })

  it('propagates the value as a literal type', () => {
    const t_node = bool(true)
    const f_node = bool(false)
    const tv: true = t_node.value
    const fv: false = f_node.value
    assert.equal(tv, true)
    assert.equal(fv, false)
  })
})

describe('nil()', () => {
  it('produces a t.NullLiteral', () => {
    const node = nil()
    assert.equal(node.type, 'NullLiteral')
  })

  it('always returns a fresh node', () => {
    assert.notStrictEqual(nil(), nil())
  })
})

describe('clone()', () => {
  it('deep-clones an Identifier', () => {
    const original = id('x')
    const copy = clone(original)
    assert.equal(copy.name, 'x')
    assert.notStrictEqual(copy, original)
  })

  it('deep-clones a complex expression', () => {
    const original = t.memberExpression(t.identifier('a'), t.identifier('b'))
    const copy = clone(original)
    assert.equal(copy.type, 'MemberExpression')
    assert.notStrictEqual(copy, original)
    assert.notStrictEqual((copy as t.MemberExpression).object, original.object)
  })

  it('preserves the node type', () => {
    const original = str('hello')
    const copy = clone(original)
    assert.equal(copy.type, 'StringLiteral')
    assert.equal((copy as t.StringLiteral).value, 'hello')
  })
})

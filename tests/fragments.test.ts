/**
 * Tests for fragment parsing helpers such as jsMethod and jsProp.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import {
  id,
  jsAs,
  jsAsMany,
  jsArrayPattern,
  jsArrayElements,
  jsArrayExpr,
  jsAssignmentPattern,
  jsClass,
  jsClassBody,
  jsClassProp,
  jsDeclarator,
  jsFunction,
  jsMethod,
  jsObjectBody,
  jsObjectExpr,
  jsObjectMethod,
  jsObjectPattern,
  jsParams,
  jsPattern,
  jsPrivateMethod,
  jsPrivateProp,
  jsProp,
  jsRest
} from '../src/index.js'
import { assertCode } from './_utils.js'

function assertClassMemberCode(
  member: t.ClassMethod | t.ClassProperty | t.ClassPrivateMethod | t.ClassPrivateProperty,
  expected: string
): void {
  const node = t.classDeclaration(t.identifier('Demo'), null, t.classBody([member]), [])
  assertCode(node, `class Demo {\n  ${expected}\n}`)
}

function assertObjectMemberCode(property: t.ObjectMethod | t.ObjectProperty, expected: string): void {
  assertCode(t.objectExpression([property]), `{\n  ${expected}\n}`)
}

describe('jsAs', () => {
  it('parses a class method fragment via the generic API', () => {
    const buildMethod = jsAs('ClassMethod')
    const method = buildMethod`${id('render')}(value, change) { return value ?? change; }`
    assert.equal(method.type, 'ClassMethod')
    assert.equal(method.kind, 'method')
    assertClassMemberCode(method, 'render(value, change) {\n    return value ?? change;\n  }')
  })

  it('parses object properties via wrapper extraction', () => {
    const buildProp = jsAs('ObjectProperty')
    const prop = buildProp`${id('enabled')}: true`
    assert.equal(prop.type, 'ObjectProperty')
    assertObjectMemberCode(prop, 'enabled: true')
  })

  it('parses class properties via the generic API', () => {
    const buildProp = jsAs('ClassProperty')
    const prop = buildProp`${id('state')} = null`
    assert.equal(prop.type, 'ClassProperty')
    assertClassMemberCode(prop, 'state = null;')
  })

  it('parses private class methods via the generic API', () => {
    const buildMethod = jsAs('ClassPrivateMethod')
    const method = buildMethod`#${id('render')}(value) { return value; }`
    assert.equal(method.type, 'ClassPrivateMethod')
    assertClassMemberCode(method, '#render(value) {\n    return value;\n  }')
  })

  it('parses object patterns via the generic API', () => {
    const buildPattern = jsAs('ObjectPattern')
    const pattern = buildPattern`{ id, label = fallback }`
    assert.equal(pattern.type, 'ObjectPattern')
  })

  it('throws when a valid fragment parses to the wrong kind', () => {
    const buildMethod = jsAs('ClassMethod')
    assert.throws(() => buildMethod`${id('state')} = null`, /did not produce a ClassMethod/)
  })

  it('throws when an object member parses to the wrong kind', () => {
    const buildMethod = jsAs('ObjectMethod')
    assert.throws(() => buildMethod`${id('enabled')}: true`, /did not produce an ObjectMethod/)
  })

  it('throws when a class member parses to the wrong specific kind', () => {
    const buildPrivateProp = jsAs('ClassPrivateProperty')
    assert.throws(() => buildPrivateProp`${id('state')} = null`, /did not produce a ClassPrivateProperty/)
  })

  it('throws when a specific pattern kind does not match', () => {
    const buildPattern = jsAs('ObjectPattern')
    assert.throws(() => buildPattern`[first, second]`, /did not produce a ObjectPattern/)
  })

  it('throws when a generic pattern fragment is empty', () => {
    const buildPattern = jsAs('Pattern')
    assert.throws(() => buildPattern``, /did not produce a Pattern/)
  })

  it('reports fragment parse errors helpfully', () => {
    const buildMethod = jsAs('ClassMethod')
    assert.throws(() => buildMethod`${id('render')}(value {`, /failed to parse ClassMethod template/)
  })
})

describe('jsAsMany', () => {
  it('parses a class body collection via the generic API', () => {
    const buildClassBody = jsAsMany('ClassBody')
    const body = buildClassBody`
      state = null
      render() { return 1; }
    `
    const cls = t.classDeclaration(t.identifier('Demo'), null, t.classBody(body), [])
    assertCode(cls, 'class Demo {\n  state = null;\n  render() {\n    return 1;\n  }\n}')
  })

  it('parses an object body collection via the generic API', () => {
    const buildObjectBody = jsAsMany('ObjectBody')
    const body = buildObjectBody`
      enabled: true,
      render() { return 1; }
    `
    assertCode(t.objectExpression(body), '{\n  enabled: true,\n  render() {\n    return 1;\n  }\n}')
  })

  it('parses params and array elements collections', () => {
    const buildParams = jsAsMany('Params')
    const buildElements = jsAsMany('ArrayElements')
    const params = buildParams`value, { id }, ...rest`
    const elements = buildElements`1, value, ...rest`

    assertCode(
      t.functionDeclaration(t.identifier('demo'), params, t.blockStatement([])),
      'function demo(value, {\n  id\n}, ...rest) {}'
    )
    assertCode(t.arrayExpression(elements), '[1, value, ...rest]')
  })
})

describe('fragment aliases', () => {
  it('jsMethod builds a class method', () => {
    const method = jsMethod`${id('load')}(item) { return item.id; }`
    assert.equal(method.type, 'ClassMethod')
    assertClassMemberCode(method, 'load(item) {\n    return item.id;\n  }')
  })

  it('jsObjectMethod builds an object method', () => {
    const method = jsObjectMethod`${id('load')}(item) { return item.id; }`
    assert.equal(method.type, 'ObjectMethod')
    assertObjectMemberCode(method, 'load(item) {\n    return item.id;\n  }')
  })

  it('jsProp builds an object property', () => {
    const prop = jsProp`${id('answer')}: 42`
    assert.equal(prop.type, 'ObjectProperty')
    assertObjectMemberCode(prop, 'answer: 42')
  })

  it('jsClassProp builds a class property', () => {
    const prop = jsClassProp`${id('state')} = null`
    assert.equal(prop.type, 'ClassProperty')
    assertClassMemberCode(prop, 'state = null;')
  })

  it('jsPrivateMethod builds a private class method', () => {
    const method = jsPrivateMethod`#${id('render')}(value) { return value; }`
    assert.equal(method.type, 'ClassPrivateMethod')
    assertClassMemberCode(method, '#render(value) {\n    return value;\n  }')
  })

  it('jsPrivateProp builds a private class property', () => {
    const prop = jsPrivateProp`#${id('cache')} = new Map()`
    assert.equal(prop.type, 'ClassPrivateProperty')
    assertClassMemberCode(prop, '#cache = new Map();')
  })

  it('jsDeclarator builds a variable declarator', () => {
    const declarator = jsDeclarator`${id('answer')} = 42`
    assert.equal(declarator.type, 'VariableDeclarator')
    assertCode(t.variableDeclaration('const', [declarator]), 'const answer = 42;')
  })

  it('jsPattern builds an object pattern parameter fragment', () => {
    const pattern = jsPattern`{ id, label = fallback }`
    assert.equal(pattern.type, 'ObjectPattern')
    const fn = t.functionDeclaration(t.identifier('demo'), [pattern], t.blockStatement([]))
    assertCode(fn, 'function demo({\n  id,\n  label = fallback\n}) {}')
  })

  it('jsObjectPattern builds a typed object pattern fragment', () => {
    const pattern = jsObjectPattern`{ id, label = fallback }`
    assert.equal(pattern.type, 'ObjectPattern')
  })

  it('jsArrayPattern builds a typed array pattern fragment', () => {
    const pattern = jsArrayPattern`[first, second]`
    assert.equal(pattern.type, 'ArrayPattern')
    const fn = t.functionDeclaration(t.identifier('demo'), [pattern], t.blockStatement([]))
    assertCode(fn, 'function demo([first, second]) {}')
  })

  it('jsAssignmentPattern builds a defaulted parameter fragment', () => {
    const pattern = jsAssignmentPattern`${id('value')} = 1`
    assert.equal(pattern.type, 'AssignmentPattern')
    const fn = t.functionDeclaration(t.identifier('demo'), [pattern], t.blockStatement([]))
    assertCode(fn, 'function demo(value = 1) {}')
  })

  it('jsRest builds a rest parameter fragment', () => {
    const rest = jsRest`...items`
    assert.equal(rest.type, 'RestElement')
    const fn = t.functionDeclaration(t.identifier('demo'), [rest], t.blockStatement([]))
    assertCode(fn, 'function demo(...items) {}')
  })

  it('jsClassBody builds a class member collection', () => {
    const body = jsClassBody`
      state = null
      render() { return 1; }
    `
    const cls = t.classDeclaration(t.identifier('Demo'), null, t.classBody(body), [])
    assertCode(cls, 'class Demo {\n  state = null;\n  render() {\n    return 1;\n  }\n}')
  })

  it('jsObjectBody builds an object member collection', () => {
    const body = jsObjectBody`
      enabled: true,
      render() { return 1; }
    `
    assertCode(t.objectExpression(body), '{\n  enabled: true,\n  render() {\n    return 1;\n  }\n}')
  })

  it('jsParams builds a parameter list collection', () => {
    const params = jsParams`value, { id }, ...rest`
    const fn = t.functionDeclaration(t.identifier('demo'), params, t.blockStatement([]))
    assertCode(fn, 'function demo(value, {\n  id\n}, ...rest) {}')
  })

  it('jsArrayElements builds an array element collection', () => {
    const elements = jsArrayElements`1, value, ...rest`
    assertCode(t.arrayExpression(elements), '[1, value, ...rest]')
  })

  it('jsObjectExpr aliases object expressions clearly', () => {
    const expr = jsObjectExpr`{ enabled: true, render() { return 1; } }`
    assert.equal(expr.type, 'ObjectExpression')
    assertCode(expr, '{\n  enabled: true,\n  render() {\n    return 1;\n  }\n}')
  })

  it('jsArrayExpr aliases array expressions clearly', () => {
    const expr = jsArrayExpr`[1, value, ...rest]`
    assert.equal(expr.type, 'ArrayExpression')
    assertCode(expr, '[1, value, ...rest]')
  })

  it('jsObjectExpr and jsArrayExpr throw when the wrapped expression kind does not match', () => {
    assert.throws(() => jsObjectExpr`[1, 2, 3]`, /did not produce a ObjectExpression/)
    assert.throws(() => jsArrayExpr`{ enabled: true }`, /did not produce a ArrayExpression/)
  })

  it('collection and wrapped-expression helpers report parse errors helpfully', () => {
    assert.throws(() => jsAsMany('ObjectBody')`enabled:`, /failed to parse ObjectBody template/)
    assert.throws(() => jsObjectExpr`{ enabled: }`, /failed to parse ObjectExpression template/)
  })

  it('jsClass aliases class declarations clearly', () => {
    const classDecl = jsClass`class Example { render() { return 1; } }`
    assert.equal(classDecl.type, 'ClassDeclaration')
    assertCode(classDecl, 'class Example {\n  render() {\n    return 1;\n  }\n}')
  })

  it('jsFunction aliases function declarations clearly', () => {
    const fnDecl = jsFunction`function render(value) { return value; }`
    assert.equal(fnDecl.type, 'FunctionDeclaration')
    assertCode(fnDecl, 'function render(value) {\n  return value;\n}')
  })
})

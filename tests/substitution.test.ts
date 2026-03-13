/**
 * Tests for the substitution engine in core.ts.
 *
 * These exercise every structural position a hole can appear in, and
 * verify that the recursive walker handles all AST node shapes correctly.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { js, jsAll, jsExpr, id, str, num, bool, nil, clone } from '../src/index.js'
import { assertCode, code } from './_utils.js'

describe('substitution — identifier positions', () => {
  it('hole as a standalone identifier (expression statement)', () => {
    const x = t.identifier('myVar')
    const stmt = js`${x};`
    assertCode(stmt, 'myVar;')
  })

  it('hole as the LHS of an assignment', () => {
    const lhs = t.memberExpression(t.thisExpression(), t.identifier('_x'))
    const stmt = js`${lhs} = 1;`
    assertCode(stmt, 'this._x = 1;')
  })

  it('hole as the RHS of an assignment', () => {
    const rhs = t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('$')), [t.stringLiteral('.root')])
    const stmt = js`el = ${rhs};`
    assertCode(stmt, "el = this.$('.root');")
  })

  it('hole as member expression property (this.${name})', () => {
    const stmt = js`var x = this.${id('__el')};`
    assertCode(stmt, 'var x = this.__el;')
  })

  it('hole as member expression object (${expr}.prop)', () => {
    const expr = t.memberExpression(t.thisExpression(), t.identifier('state'))
    const stmt = js`var x = ${expr}.todos;`
    assertCode(stmt, 'var x = this.state.todos;')
  })

  it('hole as callee (${fn}(args))', () => {
    const fn = t.memberExpression(t.thisExpression(), t.identifier('render'))
    const stmt = js`${fn}(item);`
    assertCode(stmt, 'this.render(item);')
  })

  it('hole as argument', () => {
    const arg = t.identifier('item')
    const stmt = js`this.render(${arg});`
    assertCode(stmt, 'this.render(item);')
  })
})

describe('substitution — literal node holes', () => {
  it('StringLiteral hole in method argument', () => {
    const stmt = js`el.setAttribute('key', ${str('active')});`
    assertCode(stmt, "el.setAttribute('key', 'active');")
  })

  it('NumericLiteral hole', () => {
    const stmt = js`el.cloneNode(${num(0)});`
    assertCode(stmt, 'el.cloneNode(0);')
  })

  it('BooleanLiteral hole', () => {
    const stmt = js`el.cloneNode(${bool(true)});`
    assertCode(stmt, 'el.cloneNode(true);')
  })

  it('NullLiteral hole', () => {
    const stmt = js`var x = ${nil()};`
    assertCode(stmt, 'var x = null;')
  })
})

describe('substitution — complex node holes', () => {
  it('MemberExpression as hole', () => {
    const base = t.memberExpression(t.thisExpression(), t.identifier('__items'))
    const stmt = js`if (!${base}) { return; }`
    assertCode(stmt, 'if (!this.__items) {\n  return;\n}')
  })

  it('CallExpression as hole', () => {
    const call = t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('$')), [t.stringLiteral('.list')])
    const stmt = js`var el = ${call};`
    assertCode(stmt, "var el = this.$('.list');")
  })

  it('BinaryExpression as hole (in condition)', () => {
    const test = t.binaryExpression(
      '!==',
      t.memberExpression(t.identifier('el'), t.identifier('textContent')),
      t.identifier('value')
    )
    const stmt = js`if (${test}) { update(); }`
    assertCode(stmt, 'if (el.textContent !== value) {\n  update();\n}')
  })

  it('LogicalExpression as hole', () => {
    const arr = t.identifier('proxied')
    const expr = t.logicalExpression('||', t.memberExpression(arr, t.identifier('__getTarget')), arr)
    const stmt = js`var raw = ${expr};`
    assertCode(stmt, 'var raw = proxied.__getTarget || proxied;')
  })

  it('ConditionalExpression as hole (nested in another)', () => {
    const inner = t.conditionalExpression(t.identifier('ok'), t.stringLiteral('yes'), t.stringLiteral('no'))
    const stmt = js`var result = ${inner};`
    assertCode(stmt, "var result = ok ? 'yes' : 'no';")
  })
})

describe('substitution — same hole used multiple times', () => {
  it('same identifier node in two positions', () => {
    const name = id('__container')
    const stmts = jsAll`
      if (!this.${name}) {
        this.${name} = this.$('.root');
      }
    `
    // Both positions should have __container (independent clones).
    assertCode(stmts[0], "if (!this.__container) {\n  this.__container = this.$('.root');\n}")
  })

  it('same complex expression node in two positions produces independent clones', () => {
    const expr = t.memberExpression(t.thisExpression(), t.identifier('_ref'))
    const stmts = jsAll`
      var a = ${expr};
      var b = ${expr};
    `
    const aInit = (stmts[0] as t.VariableDeclaration).declarations[0].init as t.MemberExpression
    const bInit = (stmts[1] as t.VariableDeclaration).declarations[0].init as t.MemberExpression
    // Same structure, different objects.
    assert.notStrictEqual(aInit, bInit)
    assert.equal(aInit.type, 'MemberExpression')
    assert.equal(bInit.type, 'MemberExpression')
  })
})

describe('substitution — nested structure preservation', () => {
  it('does not disturb non-hole identifiers in the template', () => {
    const method = id('renderItem')
    const stmt = js`this.${method}(item, index);`
    // 'item' and 'index' are literal template text, not holes
    assertCode(stmt, 'this.renderItem(item, index);')
  })

  it('preserves operator tokens', () => {
    const lhs = t.memberExpression(t.identifier('el'), t.identifier('className'))
    const rhs = t.identifier('newClass')
    const stmt = js`if (${lhs} !== ${rhs}) { ${lhs} = ${rhs}; }`
    assertCode(stmt, 'if (el.className !== newClass) {\n  el.className = newClass;\n}')
  })

  it('preserves computed member access in template body', () => {
    const n = t.memberExpression(t.identifier('arr'), t.identifier('length'))
    const stmt = js`for (var i = 0; i < ${n}; i++) { process(arr[i]); }`
    assertCode(stmt, 'for (var i = 0; i < arr.length; i++) {\n  process(arr[i]);\n}')
  })
})

describe('substitution — deeply nested holes', () => {
  it('hole inside arrow function inside call', () => {
    const idProp = id('id')
    const idExpr = t.identifier('targetId')
    const arr = t.identifier('__rawArr')
    const expr = jsExpr`${arr}.find(__t => __t.${idProp} === ${idExpr})`
    assertCode(expr, '__rawArr.find(__t => __t.id === targetId)')
  })

  it('hole in ternary branches', () => {
    const a = t.callExpression(t.memberExpression(t.identifier('p'), t.identifier('cloneNode')), [
      t.booleanLiteral(false)
    ])
    const b = t.callExpression(t.memberExpression(t.identifier('document'), t.identifier('createElement')), [
      t.stringLiteral('div')
    ])
    const expr = jsExpr`parent ? ${a} : ${b}`
    assertCode(expr, "parent ? p.cloneNode(false) : document.createElement('div')")
  })
})

describe('substitution — sparse array traversal', () => {
  it('handles null elements in ArrayExpression (sparse arrays)', () => {
    const stmt = js`const x = [, 1, , 2];`
    assertCode(stmt, 'const x = [, 1,, 2];')
  })

  it('handles null elements with holes', () => {
    const val = num(42)
    const stmt = js`const x = [, ${val}, , 3];`
    assertCode(stmt, 'const x = [, 42,, 3];')
  })
})

describe('substitution — jsExpr holes', () => {
  it('no holes', () => {
    const expr = jsExpr`a + b`
    assertCode(expr, 'a + b')
  })

  it('single hole', () => {
    const n = t.memberExpression(t.identifier('arr'), t.identifier('length'))
    const expr = jsExpr`i < ${n}`
    assertCode(expr, 'i < arr.length')
  })

  it('multiple holes', () => {
    const el = t.identifier('el')
    const val = t.identifier('value')
    const expr = jsExpr`${el}.textContent !== ${val}`
    assertCode(expr, 'el.textContent !== value')
  })
})

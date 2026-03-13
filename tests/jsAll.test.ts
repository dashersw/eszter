/**
 * Tests for jsAll`...` — building multiple statements at once.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { jsAll, id, str, num, bool, nil } from '../src/index.js'
import { assertCode, code } from './_utils.js'

describe('jsAll — basic usage', () => {
  it('returns an array of statements', () => {
    const stmts = jsAll`
      var x = 1;
      var y = 2;
    `
    assert.equal(Array.isArray(stmts), true)
    assert.equal(stmts.length, 2)
    assert.equal(stmts[0].type, 'VariableDeclaration')
    assert.equal(stmts[1].type, 'VariableDeclaration')
  })

  it('returns a single-element array when one statement is given', () => {
    const stmts = jsAll`var x = 1;`
    assert.equal(stmts.length, 1)
  })

  it('handles three or more statements', () => {
    const stmts = jsAll`
      var a = 1;
      var b = 2;
      var c = 3;
      return a + b + c;
    `
    assert.equal(stmts.length, 4)
    assert.equal(stmts[3].type, 'ReturnStatement')
  })
})

describe('jsAll("...") string API', () => {
  it('returns multiple statements from a literal string', () => {
    const stmts = jsAll('var x = 1; var y = %%;', t.numericLiteral(2))
    assert.equal(stmts.length, 2)
    assertCode(stmts[0], 'var x = 1;')
    assertCode(stmts[1], 'var y = 2;')
  })
})

describe('jsAll — holes', () => {
  it('substitutes a single hole across multiple statements', () => {
    const name = id('__container')
    const sel = str('.root')
    const stmts = jsAll`
      var ${name} = null;
      if (!${name}) { ${name} = this.$(${sel}); }
    `
    assert.equal(stmts.length, 2)
    assertCode(stmts[0], 'var __container = null;')
    assertCode(stmts[1], "if (!__container) {\n  __container = this.$('.root');\n}")
  })

  it('each hole position gets an independent clone', () => {
    const expr = t.identifier('x')
    const stmts = jsAll`
      var a = ${expr};
      var b = ${expr};
    `
    const aInit = (stmts[0] as t.VariableDeclaration).declarations[0].init as t.Identifier
    const bInit = (stmts[1] as t.VariableDeclaration).declarations[0].init as t.Identifier
    // Same value, but different node objects (cloned).
    assert.equal(aInit.name, 'x')
    assert.equal(bInit.name, 'x')
    assert.notStrictEqual(aInit, bInit)
  })

  it('handles complex expression holes', () => {
    const containerRef = t.memberExpression(t.thisExpression(), t.identifier('__list'))
    const stmts = jsAll`
      if (!${containerRef}) { return; }
      ${containerRef}.innerHTML = '';
    `
    assert.equal(stmts.length, 2)
    assertCode(stmts[0], 'if (!this.__list) {\n  return;\n}')
    assertCode(stmts[1], "this.__list.innerHTML = '';")
  })
})

describe('jsAll — real-world patterns from vite-plugin-erste', () => {
  it('buildSingleItemRerender-style block', () => {
    const elVar = id('__oldEl')
    const itemVar = id('__oldItem')
    const parentVar = id('__oldParent')
    const tmpVar = id('__oldTmp')
    const newElVar = id('__oldNew')
    const renderMethod = id('renderTodosItem')
    const stmts = jsAll`
      var ${parentVar} = ${elVar}.parentElement;
      var ${tmpVar} = ${parentVar}
        ? ${parentVar}.cloneNode(false)
        : document.createElement('div');
      ${tmpVar}.innerHTML = this.${renderMethod}(${itemVar});
      var ${newElVar} = ${tmpVar}.firstElementChild;
      if (${newElVar}) { ${elVar}.replaceWith(${newElVar}); }
    `
    assert.equal(stmts.length, 5)
    assertCode(stmts[0], 'var __oldParent = __oldEl.parentElement;')
    assertCode(stmts[1], "var __oldTmp = __oldParent ? __oldParent.cloneNode(false) : document.createElement('div');")
    assertCode(stmts[2], '__oldTmp.innerHTML = this.renderTodosItem(__oldItem);')
    assertCode(stmts[3], 'var __oldNew = __oldTmp.firstElementChild;')
    assertCode(stmts[4], 'if (__oldNew) {\n  __oldEl.replaceWith(__oldNew);\n}')
  })

  it('findIndex lookup pattern', () => {
    const idxVar = id('__row_old_idx')
    const rowVar = id('__row_old')
    const arrExpr = t.identifier('__rawArr')
    const containerRef = t.memberExpression(t.thisExpression(), t.identifier('__items'))
    const idProp = id('id')
    const idExpr = t.identifier('__prevValue')
    const stmts = jsAll`
      var ${idxVar} = ${arrExpr}.findIndex(__d => __d.${idProp} === ${idExpr});
      var ${rowVar} = ${idxVar} >= 0 ? ${containerRef}.children[${idxVar}] : null;
    `
    assert.equal(stmts.length, 2)
    assertCode(stmts[0], 'var __row_old_idx = __rawArr.findIndex(__d => __d.id === __prevValue);')
    assertCode(stmts[1], 'var __row_old = __row_old_idx >= 0 ? this.__items.children[__row_old_idx] : null;')
  })

  it('classList toggle pattern', () => {
    const targetVar = id('__target_old')
    const className = str('selected')
    const stmts = jsAll`
      if (!${targetVar}) { continue; }
      ${targetVar}.classList.toggle(${className}, ${bool(true)});
    `
    assert.equal(stmts.length, 2)
    assertCode(stmts[0], 'if (!__target_old) {\n  continue;\n}')
    assertCode(stmts[1], "__target_old.classList.toggle('selected', true);")
  })
})

describe('jsAll — mixed statement types', () => {
  it('mixes declarations, if, and return', () => {
    const stmts = jsAll`
      var el = container.querySelector('[key="1"]');
      if (!el) { return; }
      el.textContent = 'hello';
    `
    assert.equal(stmts[0].type, 'VariableDeclaration')
    assert.equal(stmts[1].type, 'IfStatement')
    assert.equal(stmts[2].type, 'ExpressionStatement')
  })

  it('handles for loops', () => {
    const len = t.memberExpression(t.identifier('arr'), t.identifier('length'))
    const stmts = jsAll`
      for (var i = 0; i < ${len}; i++) {
        process(arr[i]);
      }
    `
    assert.equal(stmts.length, 1)
    assert.equal(stmts[0].type, 'ForStatement')
  })
})

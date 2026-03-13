/**
 * Integration tests: full replicas of the noisiest patterns from
 * packages/vite-plugin-erste/generate-array.ts and generate-array-patch.ts.
 *
 * Each test builds the exact same AST as the original @babel/types code and
 * verifies it by round-tripping back to the expected JavaScript string.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { js, jsAll, jsExpr, id, str, num, bool, nil, clone } from '../src/index.js'
import { assertCode, code } from './_utils.js'

// ─── helpers that mirror the plugin's own helpers ─────────────────────────────

function thisProp(name: string): t.MemberExpression {
  return t.memberExpression(t.thisExpression(), t.identifier(name))
}

// ─── lazyInit pattern ─────────────────────────────────────────────────────────

describe('lazyInit pattern', () => {
  /**
   * Mirrors the repeated pattern in the plugin:
   *
   *   if (!this.__container) {
   *     this.__container = this.$('.selector');
   *   }
   */
  it('produces the correct if(!this.x) { this.x = this.$(...); } AST', () => {
    const containerName = '__todos_container'
    const selector = 'ul.todos'

    const stmt = js`if (!this.${id(containerName)}) {
      this.${id(containerName)} = this.$(${str(selector)});
    }`

    assert.equal(stmt.type, 'IfStatement')
    assertCode(stmt, `if (!this.__todos_container) {\n  this.__todos_container = this.$('ul.todos');\n}`)
  })

  it('works for any container name and selector (parameterised)', () => {
    for (const [cName, sel] of [
      ['__items_container', '.items'],
      ['__list_container', '#list'],
    ] as const) {
      const stmt = js`if (!this.${id(cName)}) {
        this.${id(cName)} = this.$(${str(sel)});
      }`
      assert.equal(stmt.type, 'IfStatement')
      const generated = code(stmt)
      assert.ok(generated.includes(cName), `Should contain ${cName}`)
      assert.ok(generated.includes(sel), `Should contain ${sel}`)
    }
  })
})

// ─── buildPatchStatement patterns ────────────────────────────────────────────

describe('buildPatchStatement — text case', () => {
  /**
   * Original:
   *
   *   if (el.textContent !== entry.expression) {
   *     el.textContent = entry.expression;
   *   }
   */
  it('produces an if (x !== y) { x = y; } statement', () => {
    const el = t.identifier('el')
    const value = t.memberExpression(t.identifier('entry'), t.identifier('expression'))

    const stmt = js`if (${el}.textContent !== ${value}) {
      ${el}.textContent = ${value};
    }`

    assert.equal(stmt.type, 'IfStatement')
    assertCode(stmt, 'if (el.textContent !== entry.expression) {\n  el.textContent = entry.expression;\n}')
  })
})

describe('buildPatchStatement — className case', () => {
  it('produces an if (x.className !== y) { x.className = y; } statement', () => {
    const el = t.identifier('el')
    const value = t.memberExpression(t.identifier('entry'), t.identifier('expression'))

    const stmt = js`if (${el}.className !== ${value}) {
      ${el}.className = ${value};
    }`

    assert.equal(stmt.type, 'IfStatement')
    assertCode(stmt, 'if (el.className !== entry.expression) {\n  el.className = entry.expression;\n}')
  })
})

describe('buildPatchStatement — attribute case', () => {
  /**
   * Original:
   *
   *   if (el.getAttribute('attrName') !== entry.expression) {
   *     el.setAttribute('attrName', entry.expression);
   *   }
   */
  it('produces getAttribute/setAttribute guard', () => {
    const el = t.identifier('el')
    const attrName = 'data-key'
    const value = t.memberExpression(t.identifier('entry'), t.identifier('expression'))

    const stmt = js`if (${el}.getAttribute(${str(attrName)}) !== ${value}) {
      ${el}.setAttribute(${str(attrName)}, ${value});
    }`

    assert.equal(stmt.type, 'IfStatement')
    assertCode(
      stmt,
      `if (el.getAttribute('data-key') !== entry.expression) {\n  el.setAttribute('data-key', entry.expression);\n}`
    )
  })
})

// ─── buildSingleItemRerender inner block ──────────────────────────────────────

describe('buildSingleItemRerender block', () => {
  /**
   * Original (the deepest block, simplified):
   *
   *   var __oldParent = __oldEl.parentElement;
   *   var __oldTmp = __oldParent
   *     ? __oldParent.cloneNode(false)
   *     : document.createElement('div');
   *   __oldTmp.innerHTML = this.renderTodosItem(__oldItem);
   *   var __oldNew = __oldTmp.firstElementChild;
   *   if (__oldNew) { __oldEl.replaceWith(__oldNew); }
   */
  it('produces the five-statement rerender block', () => {
    const elVar = id('__oldEl')
    const itemVar = id('__oldItem')
    const parentVar = id('__oldParent')
    const tmpVar = id('__oldTmp')
    const newElVar = id('__oldNew')
    const renderMethod = id('renderTodosItem')

    const stmts = jsAll`
      var ${parentVar} = ${elVar}.parentElement;
      var ${tmpVar} = ${parentVar}
        ? ${parentVar}.cloneNode(${bool(false)})
        : document.createElement(${str('div')});
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
})

// ─── buildRelationalClassPatch inner block ────────────────────────────────────

describe('buildRelationalClassPatch classList.toggle', () => {
  /**
   * Original:
   *
   *   if (__target_old) {
   *     __target_old.classList.toggle('selected', true);
   *   }
   */
  it('produces classList.toggle guarded by an if', () => {
    const targetVar = id('__target_old')
    const className = str('selected')
    const enabled = bool(true)

    const stmt = js`if (${targetVar}) {
      ${targetVar}.classList.toggle(${className}, ${enabled});
    }`

    assert.equal(stmt.type, 'IfStatement')
    assertCode(stmt, "if (__target_old) {\n  __target_old.classList.toggle('selected', true);\n}")
  })
})

// ─── array observer raw-array extraction ──────────────────────────────────────

describe('raw array extraction pattern', () => {
  /**
   * Original:
   *
   *   var __rawArr = proxied.__getTarget || proxied;
   */
  it('produces the logical-or raw-array declaration', () => {
    const proxied = t.identifier('proxied')
    const stmt = js`var __rawArr = ${proxied}.__getTarget || ${proxied};`

    assert.equal(stmt.type, 'VariableDeclaration')
    assertCode(stmt, 'var __rawArr = proxied.__getTarget || proxied;')
  })
})

// ─── previousValue extraction ─────────────────────────────────────────────────

describe('previousValue extraction pattern', () => {
  /**
   * Original:
   *
   *   var __previousValue = change[0] ? change[0].previousValue : null;
   */
  it('produces the conditional previousValue declaration', () => {
    const stmt = js`var __previousValue = change[0] ? change[0].previousValue : ${nil()};`

    assert.equal(stmt.type, 'VariableDeclaration')
    assertCode(stmt, 'var __previousValue = change[0] ? change[0].previousValue : null;')
  })
})

// ─── findIndex lookup ─────────────────────────────────────────────────────────

describe('findIndex lookup pattern', () => {
  /**
   * Original (two-statement form):
   *
   *   var __row_old_idx = __rawArr.findIndex(__d => __d.id === idExpr);
   *   var __row_old = __row_old_idx >= 0
   *     ? container.children[__row_old_idx]
   *     : null;
   */
  it('produces findIndex + conditional children lookup', () => {
    const arr = t.identifier('__rawArr')
    const container = thisProp('__todos_container')
    const idProp = id('id')
    const idExpr = t.identifier('prevValue')

    const stmts = jsAll`
      var __row_old_idx = ${arr}.findIndex(__d => __d.${idProp} === ${idExpr});
      var __row_old = __row_old_idx >= 0
        ? ${container}.children[__row_old_idx]
        : ${nil()};
    `

    assert.equal(stmts.length, 2)
    assertCode(stmts[0], 'var __row_old_idx = __rawArr.findIndex(__d => __d.id === prevValue);')
    assertCode(stmts[1], 'var __row_old = __row_old_idx >= 0 ? this.__todos_container.children[__row_old_idx] : null;')
  })
})

// ─── conditional patch loop body ─────────────────────────────────────────────

describe('conditional patch loop body', () => {
  /**
   * Original (inner loop body):
   *
   *   const item = __arr[__i];
   *   const row  = container.children[__i];
   *   if (!row) { continue; }
   */
  it('produces the loop-body const declarations and guard', () => {
    const container = thisProp('__todos_container')
    const stmts = jsAll`
      const item = __arr[__i];
      const row  = ${container}.children[__i];
      if (!row) { continue; }
    `
    assert.equal(stmts.length, 3)
    assertCode(stmts[0], 'const item = __arr[__i];')
    assertCode(stmts[1], 'const row = this.__todos_container.children[__i];')
    assertCode(stmts[2], 'if (!row) {\n  continue;\n}')
  })
})

// ─── keyed item check in generatePatchItemMethod ──────────────────────────────

describe('keyed item setAttribute guard', () => {
  /**
   * Original:
   *
   *   const __itemKey = String(item.id);
   *   if (el.getAttribute('key') !== __itemKey) {
   *     el.setAttribute('key', __itemKey);
   *   }
   */
  it('produces keyed setAttribute guard', () => {
    const idProp = id('id')

    const stmts = jsAll`
      const __itemKey = String(item.${idProp});
      if (el.getAttribute(${str('key')}) !== __itemKey) {
        el.setAttribute(${str('key')}, __itemKey);
      }
    `
    assert.equal(stmts.length, 2)
    assertCode(stmts[0], 'const __itemKey = String(item.id);')
    assertCode(stmts[1], "if (el.getAttribute('key') !== __itemKey) {\n  el.setAttribute('key', __itemKey);\n}")
  })
})

// ─── template lazy-init cloneNode ────────────────────────────────────────────

describe('template element lazy-init', () => {
  /**
   * Original (from generateCreateItemMethod):
   *
   *   if (!this.__todos_template) {
   *     var __tw = this.__todos_container.cloneNode(false);
   *     __tw.innerHTML = this.renderTodosItem({ id: 0, label: '' });
   *     this.__todos_template = __tw.firstElementChild;
   *   }
   */
  it('produces the template lazy-init block', () => {
    const templateProp = id('__todos_template')
    const containerProp = id('__todos_container')
    const renderMethod = id('renderTodosItem')

    const stmt = js`if (!this.${templateProp}) {
      var __tw = this.${containerProp}.cloneNode(${bool(false)});
      __tw.innerHTML = this.${renderMethod}({ id: ${num(0)}, label: ${str('')} });
      this.${templateProp} = __tw.firstElementChild;
    }`

    assert.equal(stmt.type, 'IfStatement')
    const expected = [
      'if (!this.__todos_template) {',
      '  var __tw = this.__todos_container.cloneNode(false);',
      "  __tw.innerHTML = this.renderTodosItem({",
      '    id: 0,',
      "    label: ''",
      '  });',
      '  this.__todos_template = __tw.firstElementChild;',
      '}',
    ].join('\n')
    assertCode(stmt, expected)
  })
})

/**
 * Tests for edit helpers that reshape existing AST nodes.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import {
  appendToBody,
  appendToBlock,
  insertAfter,
  insertBefore,
  js,
  jsBlockBody,
  jsExpr,
  prependToBody,
  prependToBlock,
  removeNode,
  renameIdentifier,
  replaceBody,
  replaceExpr,
  replaceIdentifier,
  replaceMany,
  replaceStmt,
  rewrite,
  withBody,
  wrapExpr,
  wrapStmt
} from '../src/index.js'
import { assertCode } from './_utils.js'

describe('replace helpers', () => {
  it('replaceExpr returns a cloned replacement expression', () => {
    const original = jsExpr`state.todos`
    const next = replaceExpr(original, current => jsExpr`${current}.__getTarget || ${current}`)

    assert.equal(next.type, 'LogicalExpression')
    assertCode(next, 'state.todos.__getTarget || state.todos')
    assertCode(original, 'state.todos')
  })

  it('replaceStmt swaps a statement while leaving the original untouched', () => {
    const original = js`row.textContent = value;`
    const next = replaceStmt(original, () => js`row.className = value;`)

    assert.equal(next.type, 'ExpressionStatement')
    assertCode(next, 'row.className = value;')
    assertCode(original, 'row.textContent = value;')
  })

  it('replace helpers also accept direct replacement nodes and arrays', () => {
    const expr = replaceExpr(jsExpr`value`, jsExpr`fallback`)
    const stmt = replaceStmt(js`row.textContent = value;`, js`row.className = value;`)
    const many = replaceMany(js`row.textContent = value;`, [js`guard();`, js`render();`])

    assertCode(expr, 'fallback')
    assertCode(stmt, 'row.className = value;')
    assertCode(many[0], 'guard();')
    assertCode(many[1], 'render();')
  })

  it('replaceMany can expand one statement into several', () => {
    const original = js`row.textContent = value;`
    const next = replaceMany(original, current => [js`if (!row) { return; }`, current])

    assert.equal(next.length, 2)
    assertCode(next[0], 'if (!row) {\n  return;\n}')
    assertCode(next[1], 'row.textContent = value;')
  })

  it('wrapExpr and wrapStmt compose around existing nodes', () => {
    const expr = wrapExpr(jsExpr`value`, current => jsExpr`String(${current})`)
    const stmt = wrapStmt(js`render(item);`, current =>
      t.ifStatement(t.identifier('item'), t.blockStatement([current]))
    )

    assertCode(expr, 'String(value)')
    assertCode(stmt, 'if (item) {\n  render(item);\n}')
  })
})

describe('block editing helpers', () => {
  const first = js`sync();`
  const second = js`render();`
  const block = t.blockStatement([first, second])

  it('appendToBlock and prependToBlock return new block statements', () => {
    const prepended = prependToBlock(block, js`if (!ready) { return; }`)
    const appended = appendToBlock(block, js`cleanup();`)

    assertCode(prepended, '{\n  if (!ready) {\n    return;\n  }\n  sync();\n  render();\n}')
    assertCode(appended, '{\n  sync();\n  render();\n  cleanup();\n}')
    assertCode(block, '{\n  sync();\n  render();\n}')
  })

  it('insertBefore, insertAfter, and removeNode target block members by identity', () => {
    const before = insertBefore(block, second, js`prepare();`)
    const after = insertAfter(block, first, js`prepare();`)
    const removed = removeNode(block, first)

    assertCode(before, '{\n  sync();\n  prepare();\n  render();\n}')
    assertCode(after, '{\n  sync();\n  prepare();\n  render();\n}')
    assertCode(removed, '{\n  render();\n}')
  })

  it('throws when the target statement is missing', () => {
    const other = js`other();`
    assert.throws(() => insertBefore(block, other, js`prepare();`), /not found in block body/)
    assert.throws(() => insertAfter(block, other, js`prepare();`), /not found in block body/)
    assert.throws(() => removeNode(block, other), /not found in block body/)
  })
})

describe('body composition helpers', () => {
  it('jsBlockBody aliases jsAll for block-oriented statement lists', () => {
    const body = jsBlockBody`
      const value = load();
      if (!value) return;
    `

    assert.equal(body.length, 2)
    assertCode(body[0], 'const value = load();')
    assertCode(body[1], 'if (!value) return;')
  })

  it('appendToBody and prependToBody compose around method and function bodies', () => {
    const method = js`class Example { render() { sync(); } }` as t.ClassDeclaration
    const render = method.body.body[0] as t.ClassMethod
    const fn = js`function load() { render(); }` as t.FunctionDeclaration

    const appended = appendToBody(render, js`cleanup();`)
    const prepended = prependToBody(fn, js`if (!ready) { return; }`)

    assertCode(appended, 'render() {\n  sync();\n  cleanup();\n}')
    assertCode(prepended, 'function load() {\n  if (!ready) {\n    return;\n  }\n  render();\n}')
    assertCode(render, 'render() {\n  sync();\n}')
    assertCode(fn, 'function load() {\n  render();\n}')
  })

  it('replaceBody and withBody return clone-first rewrites', () => {
    const method = js`class Example { render() { sync(); render(); } }` as t.ClassDeclaration
    const render = method.body.body[0] as t.ClassMethod
    const arrow = t.arrowFunctionExpression([], t.blockStatement([js`sync();`]))

    const replaced = replaceBody(render, [js`prepare();`, js`render();`])
    const transformed = withBody(arrow, body => [js`if (!ready) { return; }`, ...body, js`cleanup();`])

    assertCode(replaced, 'render() {\n  prepare();\n  render();\n}')
    assertCode(transformed, '() => {\n  if (!ready) {\n    return;\n  }\n  sync();\n  cleanup();\n}')
    assertCode(render, 'render() {\n  sync();\n  render();\n}')
    assertCode(arrow, '() => {\n  sync();\n}')
  })

  it('body helpers throw for expression-bodied arrows', () => {
    const arrow = t.arrowFunctionExpression([], t.identifier('value'))

    assert.throws(() => appendToBody(arrow, js`cleanup();`), /block-bodied function or method/)
    assert.throws(() => replaceBody(arrow, [js`cleanup();`]), /block-bodied function or method/)
    assert.throws(() => withBody(arrow, body => body), /block-bodied function or method/)
  })
})

describe('rewrite helpers', () => {
  it('rewrite performs clone-first subtree transforms', () => {
    const expr = jsExpr`item.id === selectedId`
    const next = rewrite(expr, {
      Identifier(node) {
        if (node.name === 'item') {
          return t.identifier('row')
        }
      }
    })

    assertCode(next, 'row.id === selectedId')
    assertCode(expr, 'item.id === selectedId')
  })

  it('renameIdentifier renames simple identifiers', () => {
    const expr = jsExpr`item.id === itemId`
    const next = renameIdentifier(expr, 'item', 'row')
    assertCode(next, 'row.id === itemId')
  })

  it('replaceIdentifier substitutes identifier references with expressions', () => {
    const expr = jsExpr`item.id === selectedId`
    const next = replaceIdentifier(expr, 'selectedId', jsExpr`this.state.selected.id`)
    assertCode(next, 'item.id === this.state.selected.id')
  })

  it('rewrite supports enter/exit hooks and sparse arrays', () => {
    const expr = jsExpr`[item, , selectedId]`
    const next = rewrite(expr, {
      enter(node) {
        if (node.type === 'Identifier' && node.name === 'item') {
          return t.identifier('row')
        }
      },
      exit(node) {
        if (node.type === 'Identifier' && node.name === 'selectedId') {
          return t.identifier('currentId')
        }
      }
    })

    assertCode(next, '[row,, currentId]')
    assertCode(expr, '[item,, selectedId]')
  })
})

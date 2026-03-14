/**
 * edit-existing.ts
 *
 * Edit helpers work on existing Babel nodes without mutating the original
 * subtree, which keeps AST composition predictable.
 */
import * as t from '@babel/types'
import {
  appendToBody,
  appendToBlock,
  insertBefore,
  js,
  jsBlockBody,
  jsExpr,
  renameIdentifier,
  replaceExpr,
  replaceBody,
  replaceIdentifier,
  replaceMany,
  withBody,
  wrapStmt
} from '../src/index.js'
import { print } from './_print.js'

const rawExpr = jsExpr`state.todos`
const wrappedExpr = replaceExpr(rawExpr, current => jsExpr`${current}.__getTarget || ${current}`)
print('replaceExpr', t.expressionStatement(wrappedExpr))

const originalStmt = js`row.textContent = value;`
print(
  'replaceMany',
  replaceMany(originalStmt, current => [js`if (!row) { return; }`, current])
)

const guardedStmt = wrapStmt(originalStmt, current => t.ifStatement(t.identifier('row'), t.blockStatement([current])))
print('wrapStmt', guardedStmt)

const block = t.blockStatement([js`sync();`, js`render();`])
print('appendToBlock', appendToBlock(block, js`cleanup();`))
print('insertBefore', insertBefore(block, block.body[1], js`prepare();`))

const method = js`class Widget { render() { sync(); } }` as t.ClassDeclaration
const renderMethod = method.body.body[0] as t.ClassMethod
print(
  'jsBlockBody',
  jsBlockBody`
  if (!ready) return;
  sync();
`
)
print('appendToBody', appendToBody(renderMethod, js`cleanup();`))
print(
  'replaceBody',
  replaceBody(
    renderMethod,
    jsBlockBody`
    const value = load();
    if (!value) return;
    render(value);
  `
  )
)
print(
  'withBody',
  withBody(renderMethod, body => [js`if (!this.rendered_) return;`, ...body, js`cleanup();`])
)

const renamedExpr = renameIdentifier(jsExpr`item.id === itemId`, 'item', 'row')
print('renameIdentifier', t.expressionStatement(renamedExpr))

const replacedIdentifier = replaceIdentifier(
  jsExpr`item.id === selectedId`,
  'selectedId',
  jsExpr`this.state.selected.id`
)
print('replaceIdentifier', t.expressionStatement(replacedIdentifier))

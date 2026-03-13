/**
 * patch-statement.ts
 *
 * DOM attribute patching with a guard: only write if the value has changed.
 * This is the central pattern in virtual-DOM-adjacent reconcilers that avoid
 * full innerHTML replacement.
 *
 * Three variants are shown:
 *   1. textContent  —  if (el.textContent !== val) { el.textContent = val; }
 *   2. className    —  if (el.className !== val) { el.className = val; }
 *   3. attribute    —  if (el.getAttribute(name) !== val) { el.setAttribute(name, val); }
 */
import * as t from '@babel/types'
import { js, str } from '../src/index.js'
import { print } from './_print.js'

type PatchType = 'text' | 'className' | 'attribute'

interface PatchEntry {
  type: PatchType
  el: t.Expression
  value: t.Expression
  attributeName?: string
}

function buildPatchStatement(entry: PatchEntry): t.IfStatement {
  const { el, value } = entry

  switch (entry.type) {
    case 'text':
      return js`if (${el}.textContent !== ${value}) {
        ${el}.textContent = ${value};
      }`

    case 'className':
      return js`if (${el}.className !== ${value}) {
        ${el}.className = ${value};
      }`

    case 'attribute': {
      const attr = str(entry.attributeName!)
      return js`if (${el}.getAttribute(${attr}) !== ${value}) {
        ${el}.setAttribute(${attr}, ${value});
      }`
    }
  }
}

// ─── Demo ────────────────────────────────────────────────────────────────────

const el = t.identifier('el')
const itemLabel = t.memberExpression(t.identifier('item'), t.identifier('label'))
const itemClass = t.memberExpression(t.identifier('item'), t.identifier('className'))

print('text patch', buildPatchStatement({ type: 'text', el, value: itemLabel }))
print('className patch', buildPatchStatement({ type: 'className', el, value: itemClass }))
print(
  'attribute patch',
  buildPatchStatement({
    type: 'attribute',
    el,
    value: t.memberExpression(t.identifier('item'), t.identifier('id')),
    attributeName: 'data-id'
  })
)

// ─── Equivalent raw @babel/types code for the 'text' case ────────────────────
//
// case 'text':
//   return t.ifStatement(
//     t.binaryExpression('!==', t.memberExpression(el, t.identifier('textContent')), value),
//     t.expressionStatement(
//       t.assignmentExpression('=', t.memberExpression(el, t.identifier('textContent')), value)
//     )
//   )
//
// 9 lines per branch. With eszter: 3 lines per branch.

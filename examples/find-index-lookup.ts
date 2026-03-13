/**
 * find-index-lookup.ts
 *
 * Two strategies for finding a row in a DOM list by item identity:
 *
 *   Strategy A — findIndex (when you have the array):
 *     var __row_idx = arr.findIndex(__d => __d.id === idExpr);
 *     var __row = __row_idx >= 0 ? container.children[__row_idx] : null;
 *
 *   Strategy B — querySelector with CSS.escape (when you only have the DOM):
 *     var __key = typeof CSS !== 'undefined' && CSS.escape
 *       ? CSS.escape(String(idExpr))
 *       : String(idExpr);
 *     var __row = container ? container.querySelector(`[key="${__key}"]`) : null;
 */
import * as t from '@babel/types'
import { jsAll, jsExpr, id, nil } from '../src/index.js'
import { print } from './_print.js'

// ─── Strategy A: findIndex ────────────────────────────────────────────────────

function buildFindIndexLookup(
  containerRef: t.Expression,
  arrExpr: t.Expression,
  idExpr: t.Expression,
  idProp: string,
  rowVar: string,
): t.Statement[] {
  const idxVar = `${rowVar}_idx`

  return jsAll`
    var ${id(idxVar)} = ${arrExpr}.findIndex(__d => __d.${id(idProp)} === ${idExpr});
    var ${id(rowVar)} = ${id(idxVar)} >= 0
      ? ${containerRef}.children[${id(idxVar)}]
      : ${nil()};
  `
}

// ─── Strategy B: querySelector ────────────────────────────────────────────────

function buildQuerySelectorLookup(
  containerRef: t.Expression,
  idExpr: t.Expression,
  rowVar: string,
  suffix: string,
): t.Statement[] {
  const keyVar = `__key_${suffix}`

  // CSS.escape is used when available to safely quote the id value in the selector.
  const escapedKey = jsExpr`
    typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(String(${idExpr}))
      : String(${idExpr})
  `

  const query = jsExpr`
    ${containerRef}
      ? ${containerRef}.querySelector('[key="' + ${id(keyVar)} + '"]')
      : ${nil()}
  `

  return jsAll`
    var ${id(keyVar)} = ${escapedKey};
    var ${id(rowVar)} = ${query};
  `
}

// ─── Demo ────────────────────────────────────────────────────────────────────

const container = t.memberExpression(t.thisExpression(), t.identifier('__todos_container'))
const arr = t.identifier('__rawArr')
const idExpr = t.identifier('prevValue')

print('findIndex lookup', buildFindIndexLookup(container, arr, idExpr, 'id', '__row_old'))
print('querySelector lookup', buildQuerySelectorLookup(container, idExpr, '__row_old', 'old'))

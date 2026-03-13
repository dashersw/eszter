/**
 * rerender-block.ts
 *
 * In-place rerender of a single keyed list item.
 * This is the most line-dense pattern in DOM-centric component codegen:
 * find the element, find the data, clone a wrapper, set innerHTML,
 * extract the new element, replace the old one.
 *
 * Generated JavaScript (for prefix = 'old'):
 *
 *   var __oldEl = container.querySelector('[key="' + id + '"]');
 *   if (__oldEl) {
 *     var __oldItem = arr.find(__t => __t.id === id);
 *     if (__oldItem) {
 *       var __oldParent = __oldEl.parentElement;
 *       var __oldTmp = __oldParent
 *         ? __oldParent.cloneNode(false)
 *         : document.createElement('div');
 *       __oldTmp.innerHTML = this.renderTodosItem(__oldItem);
 *       var __oldNew = __oldTmp.firstElementChild;
 *       if (__oldNew) { __oldEl.replaceWith(__oldNew); }
 *     }
 *   }
 */
import * as t from '@babel/types'
import { js, jsAll, jsExpr, id, str, bool } from '../src/index.js'
import { print } from './_print.js'

function buildSingleItemRerender(
  idExpr: t.Expression,
  containerRef: t.Expression,
  arrExpr: t.Expression,
  renderMethodName: string,
  idProp: string,
  prefix: string,
): t.Statement[] {
  const elVar       = `__${prefix}El`
  const itemVar     = `__${prefix}Item`
  const tmpVar      = `__${prefix}Tmp`
  const newElVar    = `__${prefix}New`
  const parentVar   = `__${prefix}Parent`

  // Find element by key attribute
  const elInit = jsExpr`${containerRef}.querySelector('[key="' + ${idExpr} + '"]')`

  // Find matching item in array
  const itemInit = jsExpr`
    ${arrExpr}.find(__t => __t.${id(idProp)} === ${idExpr})
  `

  // Inner block: clone, set innerHTML, replace
  const innerBlock = jsAll`
    var ${id(parentVar)} = ${id(elVar)}.parentElement;
    var ${id(tmpVar)} = ${id(parentVar)}
      ? ${id(parentVar)}.cloneNode(${bool(false)})
      : document.createElement(${str('div')});
    ${id(tmpVar)}.innerHTML = this.${id(renderMethodName)}(${id(itemVar)});
    var ${id(newElVar)} = ${id(tmpVar)}.firstElementChild;
    if (${id(newElVar)}) { ${id(elVar)}.replaceWith(${id(newElVar)}); }
  `

  return [
    js`var ${id(elVar)} = ${elInit};`,
    js`if (${id(elVar)}) {
      var ${id(itemVar)} = ${itemInit};
      if (${id(itemVar)}) {
        ${t.blockStatement(innerBlock)}
      }
    }`,
  ]
}

// ─── Demo ────────────────────────────────────────────────────────────────────

const containerRef = t.memberExpression(t.thisExpression(), t.identifier('__todos_container'))
const arrExpr = t.identifier('__rawArr')
const prevId = t.memberExpression(t.thisExpression(), t.identifier('__prev_todos'))
const newId = t.identifier('value')

print('rerender previous item', buildSingleItemRerender(
  prevId, containerRef, arrExpr, 'renderTodosItem', 'id', 'old'
))

print('rerender new item', buildSingleItemRerender(
  newId, containerRef, arrExpr, 'renderTodosItem', 'id', 'new'
))

/**
 * lazy-init.ts
 *
 * The "guard and lazy-initialise a cached DOM reference" pattern.
 * This appears dozens of times in Babel-based component codegen tools —
 * once per observed property per component.
 *
 * Generated JavaScript:
 *
 *   if (!this.__container) {
 *     this.__container = this.$('.container');
 *   }
 */
import * as t from '@babel/types'
import { js, id, str } from '../src/index.js'
import { print } from './_print.js'

// ─── With eszter ─────────────────────────────────────────────────────────────

function lazyInit(containerName: string, selector: string): t.IfStatement {
  return js`if (!this.${id(containerName)}) {
    this.${id(containerName)} = this.$(${str(selector)});
  }`
}

print('lazyInit("__container", ".container")', lazyInit('__container', '.container'))
print('lazyInit("__list_container", "ul.todos")', lazyInit('__list_container', 'ul.todos'))

// ─── Equivalent raw @babel/types code ────────────────────────────────────────
//
// function lazyInitRaw(containerName: string, selector: string): t.IfStatement {
//   return t.ifStatement(
//     t.unaryExpression('!', t.memberExpression(t.thisExpression(), t.identifier(containerName))),
//     t.blockStatement([
//       t.expressionStatement(
//         t.assignmentExpression('=',
//           t.memberExpression(t.thisExpression(), t.identifier(containerName)),
//           t.callExpression(
//             t.memberExpression(t.thisExpression(), t.identifier('$')),
//             [t.stringLiteral(selector)]
//           )
//         )
//       )
//     ])
//   )
// }
//
// Same result. 14 lines vs 3.

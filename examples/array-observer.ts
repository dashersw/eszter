/**
 * array-observer.ts
 *
 * Builds a complete observer class method for a keyed list.
 * This demonstrates composing eszter output into a full t.ClassMethod
 * using raw @babel/types at the top level.
 *
 * Generated JavaScript (simplified):
 *
 *   __observe_state_todos(value, change) {
 *     if (!this.__todos_container) {
 *       this.__todos_container = this.$('ul.todos');
 *     }
 *     var __rawArr = this.state.todos.__getTarget || this.state.todos;
 *     var __previousValue = change[0] ? change[0].previousValue : null;
 *     if (__previousValue != null) {
 *       // rerender previous item ...
 *     }
 *     if (value != null) {
 *       // rerender new item ...
 *     }
 *     this.__prev_todos = value;
 *   }
 */
import * as t from '@babel/types'
import { js, jsAll, jsExpr, id, str, nil } from '../src/index.js'
import { print } from './_print.js'

function generateArrayItemsRerenderObserver(
  arrayPath: string,
  containerSelector: string,
  renderMethodName: string,
  idProp: string,
  methodName: string
): t.ClassMethod {
  const containerName = `__${arrayPath.replace(/\./g, '_')}_container`
  const prevName = `__prev_${arrayPath.replace(/\./g, '_')}`

  // this.state.todos (or this.state.some.nested.path)
  const proxiedArr = arrayPath
    .split('.')
    .reduce<t.Expression>(
      (acc, part) => t.memberExpression(acc, t.identifier(part)),
      t.memberExpression(t.thisExpression(), t.identifier('state'))
    )

  // this.state.todos.__getTarget || this.state.todos
  const rawArrExpr = jsExpr`${t.cloneNode(proxiedArr, true)}.__getTarget || ${proxiedArr}`

  const containerRef = t.memberExpression(t.thisExpression(), t.identifier(containerName))
  const prevProp = t.memberExpression(t.thisExpression(), t.identifier(prevName))

  // Build the rerender block for prev/new item (inline for brevity here)
  function rerenderBlock(prefix: string, idExpr: t.Expression): t.IfStatement {
    const elVar = `__${prefix}El`
    const itemVar = `__${prefix}Item`
    const tmpVar = `__${prefix}Tmp`
    const newElVar = `__${prefix}New`
    const parentVar = `__${prefix}Parent`

    const elInit = jsExpr`${containerRef}.querySelector('[key="' + ${idExpr} + '"]')`
    const itemInit = jsExpr`${t.identifier('__rawArr')}.find(__t => __t.${id(idProp)} === ${idExpr})`

    const innerBlock = jsAll`
      var ${id(parentVar)} = ${id(elVar)}.parentElement;
      var ${id(tmpVar)} = ${id(parentVar)}
        ? ${id(parentVar)}.cloneNode(false)
        : document.createElement('div');
      ${id(tmpVar)}.innerHTML = this.${id(renderMethodName)}(${id(itemVar)});
      var ${id(newElVar)} = ${id(tmpVar)}.firstElementChild;
      if (${id(newElVar)}) { ${id(elVar)}.replaceWith(${id(newElVar)}); }
    `

    return js`if (${idExpr} != ${nil()}) {
      var ${id(elVar)} = ${elInit};
      if (${id(elVar)}) {
        var ${id(itemVar)} = ${itemInit};
        if (${id(itemVar)}) {
          ${t.blockStatement(innerBlock)}
        }
      }
    }`
  }

  const body: t.Statement[] = [
    // 1. Lazy-init container ref
    js`if (!this.${id(containerName)}) {
      this.${id(containerName)} = this.$(${str(containerSelector)});
    }`,

    // 2. Unwrap proxy to get the raw array
    js`var __rawArr = ${rawArrExpr};`,

    // 3. Extract previous value from the change record
    js`var __previousValue = change[0] ? change[0].previousValue : ${nil()};`,

    // 4. Rerender the previously selected item (if any)
    rerenderBlock('old', t.identifier('__previousValue')),

    // 5. Rerender the newly selected item (if any)
    rerenderBlock('new', t.identifier('value')),

    // 6. Save current value for next call
    js`this.${id(prevName)} = value;`
  ]

  return t.classMethod(
    'method',
    t.identifier(methodName),
    [t.identifier('value'), t.identifier('change')],
    t.blockStatement(body)
  )
}

// ─── Demo ────────────────────────────────────────────────────────────────────

print(
  '__observe_state_todos()',
  generateArrayItemsRerenderObserver('todos', 'ul.todos', 'renderTodosItem', 'id', '__observe_state_todos')
)

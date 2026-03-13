/**
 * Sample project demonstrating eszter installed as an npm package.
 *
 * Run: npm run demo
 */
import { createRequire } from 'module'
import * as t from '@babel/types'
import { js, jsAll, jsExpr, tpl, id, str, num, bool, nil, clone } from 'eszter'

const require = createRequire(import.meta.url)
const _generate = require('@babel/generator')
const generate: (node: t.Node) => { code: string } = _generate.default ?? _generate

function print(label: string, node: t.Node | t.Node[]): void {
  const nodes = Array.isArray(node) ? node : [node]
  const code = nodes.map(n => generate(n).code).join('\n')
  console.log(`\n--- ${label} ---`)
  console.log(code)
}

// ────────────────────────────────────────────────────────────────────
// 1. Single statement with js``
// ────────────────────────────────────────────────────────────────────
const ifStmt = js`if (!this.${id('__container')}) {
  this.${id('__container')} = this.$(${str('.container')});
}`

print('js` - lazy init guard', ifStmt)

// ────────────────────────────────────────────────────────────────────
// 2. String-call form with type inference
// ────────────────────────────────────────────────────────────────────
const forStmt = js('for (var i = 0; i < %%.length; i++) {}', id('items'))

print('js() string-call - for loop', forStmt)

// ────────────────────────────────────────────────────────────────────
// 3. Multiple statements with jsAll``
// ────────────────────────────────────────────────────────────────────
const setup = jsAll`
  var ${id('parent')} = ${id('el')}.parentElement;
  var ${id('tmp')} = ${id('parent')}
    ? ${id('parent')}.cloneNode(false)
    : document.createElement('div');
  ${id('tmp')}.innerHTML = this.render(${id('item')});
`

print('jsAll` - multi-statement setup', setup)

// ────────────────────────────────────────────────────────────────────
// 4. Expression extraction with jsExpr``
// ────────────────────────────────────────────────────────────────────
const condition = jsExpr`${id('el')}.textContent !== ${id('value')}`

print('jsExpr` - binary expression', condition)

// ────────────────────────────────────────────────────────────────────
// 5. Template literal construction with tpl``
// ────────────────────────────────────────────────────────────────────
const selector = tpl`[key="${id('itemId')}"]`
const queryCall = jsExpr`${id('container')}.querySelector(${selector})`

print('tpl` + jsExpr` - template literal in querySelector', queryCall)

// ────────────────────────────────────────────────────────────────────
// 6. Helpers: id, str, num, bool, nil, clone
// ────────────────────────────────────────────────────────────────────
const decl = js`var config = {
  name: ${str('eszter')},
  version: ${num(1)},
  enabled: ${bool(true)},
  data: ${nil()}
};`

print('helpers - object literal with primitives', decl)

const cloned = clone(decl)
print('clone - deep copy of the declaration', cloned)

// ────────────────────────────────────────────────────────────────────
// 7. Composing eszter output with raw @babel/types
// ────────────────────────────────────────────────────────────────────
const body = jsAll`
  this.${id('__el')} = this.$(${str('.item')});
  this.${id('__el')}.textContent = ${id('value')};
`

const method = t.classMethod('method', t.identifier('init'), [t.identifier('value')], t.blockStatement(body))

print('eszter + @babel/types - class method', method)

console.log('\nAll examples ran successfully!')

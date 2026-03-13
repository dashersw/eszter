/**
 * mixing-with-babel.ts
 *
 * eszter is a layer on top of @babel/types, not a replacement.
 * This example shows the modes of mixing:
 *
 *   1. Raw t.* nodes as holes — pass any existing node directly into a template.
 *   2. eszter output as input to t.* — the result of js/jsAll is a t.Node.
 *   3. Composing at any granularity — use eszter where it helps, raw t.* where it doesn't.
 *   4. Primitive holes — pass strings/numbers/booleans directly without helpers.
 *   5. tpl`` — build template literals for generated code without escaping backticks.
 */
import * as t from '@babel/types'
import { js, jsAll, jsExpr, id, tpl, clone } from '../src/index.js'
import { print } from './_print.js'

// ─── 1. Raw t.* nodes as holes ────────────────────────────────────────────────

// Any @babel/types node can be dropped into a template hole.
const logicalExpr = t.logicalExpression(
  '||',
  t.memberExpression(t.identifier('proxied'), t.identifier('__getTarget')),
  t.identifier('proxied')
)

// The logicalExpr goes straight into the initialiser.
const rawArrDecl = js`var __rawArr = ${logicalExpr};`
// → var __rawArr = proxied.__getTarget || proxied;
print('raw node as hole', rawArrDecl)

// ─── 2. eszter output as input to t.* ────────────────────────────────────────

// Build individual statements with eszter, compose into a method with raw t.*.
// Note: the selector string is passed as a raw string hole — no str() needed.
const guardStmt = js`if (!this.${id('__container')}) {
  this.${id('__container')} = this.$(${'.root'});
}`

const assignStmt = js`this.${id('__prev')} = value;`

// Wrap in a class method using raw t.classMethod.
const method = t.classMethod(
  'method',
  t.identifier('onUpdate'),
  [t.identifier('value'), t.identifier('change')],
  t.blockStatement([guardStmt, assignStmt])
)
print('eszter stmts inside raw classMethod', method)

// ─── 3. Fine-grained composition ─────────────────────────────────────────────

// Some structures are easier to express as raw @babel/types (e.g. arrow functions
// with complex bodies), others benefit from eszter. Mix freely.

const todosContainer = t.memberExpression(t.thisExpression(), t.identifier('__todos_container'))
const rawArr = t.identifier('__rawArr')

// Arrow function is compact enough as raw t.*
const patchCallback = t.arrowFunctionExpression(
  [t.identifier('item'), t.identifier('i')],
  t.blockStatement(jsAll`
    const row = ${todosContainer}.children[i];
    if (!row) { return; }
    this.${id('patchTodosItem')}(row, ${t.identifier('todo')});
  `)
)

// Tagged-template form: ergonomic when you want native `${...}` holes.
// jsExpr produces a single expression — perfect for a .forEach() call.
const forEachExpr = jsExpr`${rawArr}.forEach(${patchCallback})`
print('forEach via jsExpr', forEachExpr)

// String-call form: use `%%` placeholders when you want exact statement-type
// inference from the literal source text.
const forLoop = js(
  `for (var i = 0; i < %%.length; i++) {
  const row = %%.children[i];
  if (!row) { continue; }
  this.%%(row, %%[i]);
}`,
  rawArr,
  todosContainer,
  id('patchTodosItem'),
  rawArr
)
print('for loop via js(string)', forLoop)

// ─── 4. Primitive holes — no helper functions needed ─────────────────────────

// Strings, numbers, booleans, and null can be passed directly as holes.
// eszter auto-coerces them to the correct literal node type.

const attrPatch = js`if (${t.identifier('el')}.getAttribute(${'data-id'}) !== ${'value'}) {
  ${t.identifier('el')}.setAttribute(${'data-id'}, ${'value'});
}`
// → if (el.getAttribute('data-id') !== 'value') { el.setAttribute('data-id', 'value'); }
print('primitive string holes', attrPatch)

const cloneCall = js`var copy = el.cloneNode(${false});`
// → var copy = el.cloneNode(false);
print('primitive boolean hole', cloneCall)

const indexDecl = js`var idx = ${-1};`
// → var idx = -1;
print('primitive number hole', indexDecl)

const defaultDecl = js`var prev = ${null};`
// → var prev = null;
print('primitive null hole', defaultDecl)

// ─── 5. tpl`` — template literals in generated code ──────────────────────────

// When the code you're generating contains a template literal, use tpl`` to
// build the inner t.TemplateLiteral as a node, then pass it as a hole.
// This avoids escaping backticks and produces clean AST.

const idExpr = t.identifier('__key')
const containerRef = t.memberExpression(t.thisExpression(), t.identifier('__container'))

// Generate:  this.__container.querySelector(`[key="${__key}"]`)
const selectorExpr = tpl`[key="${idExpr}"]`
const querySelector = jsExpr`${containerRef}.querySelector(${selectorExpr})`
print('querySelector with tpl``', querySelector)

// Generate: const msg = `Hello, ${name}!`
const nameExpr = t.identifier('name')
const msgDecl = js`const msg = ${tpl`Hello, ${nameExpr}!`};`
print('template literal in declaration', msgDecl)

// ─── 6. Clone when reusing the same node in multiple positions ────────────────

// eszter deep-clones each hole automatically, so you can pass the same node
// to multiple positions without worrying about shared references.
// For nodes you build yourself and reuse across *multiple eszter calls*,
// clone() makes the intent explicit.
const containerExpr = t.memberExpression(t.thisExpression(), t.identifier('__list'))

const stmt1 = js`if (!${containerExpr}) { return; }`
const stmt2 = js`${containerExpr}.innerHTML = '';`

// containerExpr is cloned by eszter inside each template, so stmt1 and stmt2
// have independent copies. Mutations to one don't affect the other.
print('reused expression (auto-cloned)', [stmt1, stmt2])

# eszter

Write Babel AST the way you write code, including fragment shapes like class methods and object properties.

```ts
import { js, jsAll, jsExpr, id, tpl } from 'eszter'

// Reads like the JavaScript it produces.
// TypeScript knows the return type is t.IfStatement.
js`if (!this.${id(containerName)}) {
  this.${id(containerName)} = this.$(${selector});
}`
```

---

## The problem

Babel AST construction is loud. A single `if` guard requires six nested function calls:

```ts
t.ifStatement(
  t.unaryExpression('!', t.memberExpression(t.thisExpression(), t.identifier(containerName))),
  t.blockStatement([
    t.expressionStatement(
      t.assignmentExpression(
        '=',
        t.memberExpression(t.thisExpression(), t.identifier(containerName)),
        t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('$')), [t.stringLiteral(selector)])
      )
    )
  ])
)
```

The nesting tells you nothing about the structure of the code being produced. You can't read it, and you can't write it without running it mentally.

## The solution

eszter supports two equivalent authoring styles:

- Tagged templates when you want native `${...}` holes.
- String calls with `%%` placeholders when you want exact `InferStatement<T>` inference from a string literal.

```ts
// Before: 14 lines, 6 levels of nesting
// After: 3 lines, immediately readable

js`if (!this.${id(containerName)}) {
  this.${id(containerName)} = this.$(${str(selector)});
}`
```

Both produce identical ASTs. The second one shows you what the output JavaScript looks like.

```ts
// Exact inference from the literal string:
const loop = js('for (var i = 0; i < %%.length; i++) {}', arr)
// loop: t.ForStatement
```

---

## Install

```sh
npm install eszter
```

eszter requires `@babel/types` and `@babel/parser` as peer dependencies. If you are already using Babel they are already installed.

```sh
npm install @babel/types @babel/parser
```

---

## Core API

### `js` — single statement

`js` supports both:

- Tagged-template form: `js\`if (${cond}) {}\``
- String-call form: `js('if (%%) {}', cond)`

Parses the template as a single statement.

- In string-call form, TypeScript infers the **exact** return type from the literal string via `InferStatement<T>`.
- In tagged-template form, the return type defaults to `t.Statement`, but can still narrow through contextual typing or an explicit generic.

```ts
import { js, id, str, bool, num, nil } from 'eszter'

const a = js('if (x) { y = 1; }')
const b = js('var %% = null;', id('el'))
const c = js('return %%;', expr)
const d = js('for (var i = 0; i < %%; i++) {}', len)
const e = js('while (%%) { step(); }', cond)
const f = js('throw new Error(%%);', str(msg))
const g = js('function %%(%%) {}', id(name), id(param))
const h = js('class %% {}', id(name))

const _: t.IfStatement = a
const __: t.ForStatement = d
```

Tagged templates remain the ergonomic option when you want native `${...}` holes:

```ts
const stmt = js`
  if (!this.${id(prop)}) {
    this.${id(prop)} = ${value};
  }
`
```

String-call form uses `%%` placeholders. The number of placeholders must match the number of holes:

```ts
const stmt = js('if (!%%) { %%.init(); }', ready, service)
```

Throws if the template contains more than one statement (use `jsAll` instead).

---

### `jsAll` — multiple statements

Returns `t.Statement[]`. Use this for blocks of two or more statements.

```ts
import { jsAll, id, str, bool } from 'eszter'

const stmts: t.Statement[] = jsAll`
  var ${id(parentVar)} = ${id(elVar)}.parentElement;
  var ${id(tmpVar)} = ${id(parentVar)}
    ? ${id(parentVar)}.cloneNode(${bool(false)})
    : document.createElement(${str('div')});
  ${id(tmpVar)}.innerHTML = this.${id(renderMethod)}(${id(itemVar)});
  var ${id(newElVar)} = ${id(tmpVar)}.firstElementChild;
  if (${id(newElVar)}) { ${id(elVar)}.replaceWith(${id(newElVar)}); }
`
```

```ts
const stmts = jsAll('var %% = %%; if (!%%) { return; }', id('el'), init, id('el'))
```

---

### `jsInContext(...)` / `jsAllInContext(...)` — labeled control flow

Use these when the snippet contains labeled `break` / `continue` and the parser needs explicit label context.

```ts
import { jsAllInContext, jsInContext } from 'eszter'

const jsOuter = jsInContext({ continueLabels: ['outer'] })
const guard = jsOuter`if (!row) { continue outer; }`

const block = jsAllInContext({ breakLabels: ['done'], continueLabels: ['outer'] })
const stmts = block`
  if (!row) { continue outer; }
  if (finished) { break done; }
`
```

The context is only used to make the snippet syntactically valid during parsing. The returned AST still represents only your original statements.

---

### `jsModule` — top-level module code

Use `jsModule` when the source contains top-level `import` / `export` declarations.
If you want a single declaration or a reusable module-body list instead of a
whole parse result, use `jsImport`, `jsExport`, `jsExportDefault`,
`jsExportAll`, or `jsModuleBody`.

```ts
import { id, jsModule, str } from 'eszter'

const nodes = jsModule`
  import { foo } from './dep';
  export const value = 1;
`

const dynamic = jsModule(
  'import { %% as %% } from %%; export const %% = %%;',
  id('foo'),
  id('bar'),
  str('./dep'),
  id('answer'),
  42
)
```

It returns module-body nodes: `t.Statement | t.ModuleDeclaration`.

```ts
import { id, jsExport, jsExportDefault, jsImport, jsModuleBody } from 'eszter'

const importDecl = jsImport`import data from ${'./dep'};`
const namedExport = jsExport`export const ${id('value')} = 1`
const defaultExport = jsExportDefault`export default data`
const body = jsModuleBody`
  import data from './dep';
  export default data;
`
```

---

### `jsAs(kind)` / `parseAs(kind)` — fragment parsing in context

Some Babel node kinds are not valid standalone statements or expressions. For
those cases, use fragment parsers that wrap your snippet in the right syntactic
context, parse it, then extract the node you actually wanted.

```ts
import { id, jsAs } from 'eszter'

const buildMethod = jsAs('ClassMethod')
const method = buildMethod`${id('render')}(value, change) {
  return value ?? change;
}`
```

Supported fragment kinds today:

- `ImportDeclaration`
- `ExportNamedDeclaration`
- `ExportDefaultDeclaration`
- `ExportAllDeclaration`
- `ClassMethod`
- `ClassProperty`
- `ClassPrivateMethod`
- `ClassPrivateProperty`
- `ObjectMethod`
- `ObjectProperty`
- `VariableDeclarator`
- `Pattern`
- `ObjectPattern`
- `ArrayPattern`
- `AssignmentPattern`
- `RestElement`

`parseAs(kind)` is an alias for `jsAs(kind)`.

---

### `jsAsMany(kind)` / `parseAsMany(kind)` — collection fragments

Some Babel APIs want an inner list rather than a full wrapper node. Use
collection fragment parsers when you want class members, object members,
module bodies, parameter lists, or array elements directly.

```ts
import { jsAsMany } from 'eszter'

const moduleBody = jsAsMany('ModuleBody')`
  import data from './dep';
  export default data;
`

const classBody = jsAsMany('ClassBody')`
  state = null
  render() { return 1; }
`

const objectBody = jsAsMany('ObjectBody')`
  enabled: true,
  render() { return 1; }
`
```

Supported collection kinds today:

- `ModuleBody`
- `ClassBody`
- `ObjectBody`
- `Params`
- `ArrayElements`

`parseAsMany(kind)` is an alias for `jsAsMany(kind)`.

---

### Fragment aliases — common Babel builder scenarios

Use the dedicated aliases when they read better than the generic `jsAs(...)`
form:

```ts
import {
  id,
  jsArrayElements,
  jsArrayPattern,
  jsArrayExpr,
  jsAssignmentPattern,
  jsClass,
  jsClassBody,
  jsClassProp,
  jsDeclarator,
  jsExport,
  jsExportAll,
  jsExportDefault,
  jsFunction,
  jsImport,
  jsMethod,
  jsModuleBody,
  jsObjectBody,
  jsObjectExpr,
  jsObjectMethod,
  jsObjectPattern,
  jsParams,
  jsPattern,
  jsPrivateMethod,
  jsPrivateProp,
  jsProp,
  jsRest
} from 'eszter'

const method = jsMethod`${id('render')}(value, change) {
  return value ?? change;
}`

const importDecl = jsImport`import { ${id('foo')} as ${id('bar')} } from ${'./dep'};`
const namedExport = jsExport`export const ${id('value')} = 1`
const defaultExport = jsExportDefault`export default function ${id('load')}() {}`
const exportAll = jsExportAll`export * from ${'./shared'}`
const classProp = jsClassProp`${id('state')} = null`
const privateMethod = jsPrivateMethod`#${id('renderInternal')}(value) { return value; }`
const privateProp = jsPrivateProp`#${id('cache')} = new Map()`
const objectMethod = jsObjectMethod`${id('load')}(item) { return item.id; }`
const prop = jsProp`${id('enabled')}: true`
const declarator = jsDeclarator`${id('answer')} = 42`
const pattern = jsPattern`{ id, label = fallback }`
const objectPattern = jsObjectPattern`{ id, label = fallback }`
const arrayPattern = jsArrayPattern`[first, second]`
const assignmentPattern = jsAssignmentPattern`${id('value')} = 1`
const rest = jsRest`...items`
const classBody = jsClassBody`
  state = null
  render() { return 1; }
`
const moduleBody = jsModuleBody`
  import data from './dep';
  export default data;
`
const objectBody = jsObjectBody`
  enabled: true,
  render() { return 1; }
`
const params = jsParams`value, { id }, ...rest`
const elements = jsArrayElements`1, value, ...rest`
const objectExpr = jsObjectExpr`{ enabled: true, render() { return 1; } }`
const arrayExpr = jsArrayExpr`[1, value, ...rest]`

const classDecl = jsClass`class Example { render(value) { return value; } }`
const fnDecl = jsFunction`function render(value) { return value; }`
```

These helpers are especially useful when raw Babel would otherwise require
builder towers like `t.importDeclaration(...)`, `t.exportNamedDeclaration(...)`,
`t.classMethod(...)`, `t.classBody([...])`, `t.objectExpression([...])`,
`t.objectProperty(...)`, or `t.variableDeclarator(...)`.

---

### `jsExpr` — single expression

Returns `t.Expression`. The template must be a single expression (no statement keywords, no trailing semicolons required).

```ts
import { jsExpr, id } from 'eszter'

const neq: t.Expression = jsExpr`${el}.textContent !== ${value}`
const find: t.Expression = jsExpr`${arr}.find(__t => __t.${id(idProp)} === ${idExpr})`
const tern: t.Expression = jsExpr`${parent} ? ${parent}.cloneNode(false) : null`
const logic: t.Expression = jsExpr`${proxied}.__getTarget || ${proxied}`

const attr: t.Expression = jsExpr('%%.getAttribute(%%)', el, str('data-id'))
```

Throws if the template is not a single expression statement.

---

### Edit helpers — reshape existing AST

`eszter` can also modify existing Babel subtrees without mutating the original
node. These helpers are intentionally local and clone-first; they are not a
full codemod framework.

```ts
import {
  appendToBlock,
  insertBefore,
  js,
  jsExpr,
  renameIdentifier,
  replaceExpr,
  replaceIdentifier,
  replaceMany,
  wrapStmt
} from 'eszter'
import * as t from '@babel/types'

const rawExpr = jsExpr`state.todos`
const wrappedExpr = replaceExpr(rawExpr, current => jsExpr`${current}.__getTarget || ${current}`)

const originalStmt = js`row.textContent = value;`
const expanded = replaceMany(originalStmt, current => [js`if (!row) { return; }`, current])
const guarded = wrapStmt(originalStmt, current => t.ifStatement(t.identifier('row'), t.blockStatement([current])))

const renamed = renameIdentifier(jsExpr`item.id === itemId`, 'item', 'row')
const replaced = replaceIdentifier(jsExpr`item.id === selectedId`, 'selectedId', jsExpr`this.state.selected.id`)

const block = t.blockStatement([js`sync();`, js`render();`])
const nextBlock = appendToBlock(block, js`cleanup();`)
const inserted = insertBefore(block, block.body[1], js`prepare();`)
```

Available helpers:

- `replaceExpr`
- `replaceStmt`
- `replaceMany`
- `wrapExpr`
- `wrapStmt`
- `appendToBlock`
- `prependToBlock`
- `insertBefore`
- `insertAfter`
- `removeNode`
- `rewrite`
- `renameIdentifier`
- `replaceIdentifier`

---

## Hole helpers

Holes accept any `t.Node` directly, **or raw JS primitives** — strings, numbers, booleans, and `null` are automatically coerced to the right literal node:

```ts
// These are identical:
js`this.$('.root');` // bare string literal in template
js`this.$(${'.root'});` // raw string hole — auto-coerced
js`this.$(${str('.root')});` // explicit str() helper

js`el.cloneNode(${false});` // boolean hole — auto-coerced to BooleanLiteral
js`var n = ${42};` // number hole — auto-coerced to NumericLiteral
js`var x = ${null};` // null hole — auto-coerced to NullLiteral
```

### `id()`, `str()`, `num()`, `bool()`, `nil()`, `clone()`

```ts
import { id, str, num, bool, nil, clone } from 'eszter'
```

| Helper         | Returns                                | Use for                                          |
| -------------- | -------------------------------------- | ------------------------------------------------ |
| `id('name')`   | `t.Identifier & { name: 'name' }`      | variable/property names that must be identifiers |
| `str('value')` | `t.StringLiteral & { value: 'value' }` | string literals with literal type tracking       |
| `num(42)`      | `t.NumericLiteral & { value: 42 }`     | numeric literals with literal type tracking      |
| `bool(true)`   | `t.BooleanLiteral & { value: true }`   | boolean literals with literal type tracking      |
| `nil()`        | `t.NullLiteral`                        | `null`                                           |
| `clone(node)`  | `T` (deep copy)                        | avoid mutating a node used in multiple places    |

`id()` remains necessary because identifiers are structurally different from string literals — `${id('result')}` generates the identifier `result`, while `${'result'}` would generate the string `'result'`.

All helpers **propagate the value as a literal type** so TypeScript can track it:

```ts
const node = id('__container')
//    ^ t.Identifier & { name: '__container' }
node.name // TypeScript knows: '__container', not just string
```

### `tpl` — template literals in generated code

When the JavaScript you're generating itself contains a template literal, use `tpl` to build the inner literal as a node, then pass it as a hole:

```ts
import { js, jsExpr, tpl } from 'eszter'

// Generate:  container.querySelector(`[key="${id}"]`)
const selector = tpl`[key="${idExpr}"]`
const call = jsExpr`${containerRef}.querySelector(${selector})`

// Generate:  const msg = `Hello, ${name}!`
const decl = js`const msg = ${tpl`Hello, ${nameExpr}!`};`

// String-call form also works:
const greeting = tpl('Hello, %%!', nameExpr)
```

This avoids escaping backticks inside `js\`...\``and produces a proper`t.TemplateLiteral` node.

---

## How it works

1. Tagged templates use the native `TemplateStringsArray`; string calls are first split on `%%` into an equivalent template shape.
2. Each hole is replaced with a unique sentinel identifier (`__ESZTER_abc123_0__`).
3. The reconstructed string — which looks like ordinary JavaScript — is parsed by `@babel/parser`.
4. The parsed AST is walked recursively using `@babel/types` VISITOR_KEYS to find and replace every sentinel with the corresponding hole node (deep-cloned).
5. The statements are extracted and returned.

Templates are parsed inside a `while(true){}` wrapper so that `continue`, `break`, and `return` are always syntactically valid regardless of nesting context.

The TypeScript return type for string-call `js(...)` is computed at compile time by the `InferStatement<T>` conditional type, which strips leading whitespace and pattern-matches the first keyword of the template string:

```ts
type InferStatement<T extends string> =
  TrimWS<T> extends `if${string}`   ? t.IfStatement
  : TrimWS<T> extends `var ${string}` | `let ${string}` | `const ${string}` ? t.VariableDeclaration
  : TrimWS<T> extends `return${string}` ? t.ReturnStatement
  : // ... etc.
  : t.Statement
```

---

## Mixing with raw `@babel/types`

eszter is not a replacement for `@babel/types`. It is a layer on top of it. You can freely mix:

```ts
import * as t from '@babel/types'
import { js, jsAll, jsExpr, id, str } from 'eszter'

// Use raw t.* for nodes that don't fit a template
const condition = t.binaryExpression(
  '!==',
  t.memberExpression(t.identifier('el'), t.identifier('textContent')),
  t.identifier('value')
)

// Pass them as holes
const stmt = js`if (${condition}) { el.textContent = value; }`
// stmt: t.IfStatement

// Build complex expression trees with jsExpr
const arr = t.memberExpression(t.thisExpression(), t.identifier('state'))
const rawArr = jsExpr`${arr}.__getTarget || ${arr}`

// Compose into a method with raw t.classMethod
const method = t.classMethod(
  'method',
  t.identifier('onUpdate'),
  [t.identifier('value'), t.identifier('change')],
  t.blockStatement([
    js`if (!this.${id(containerName)}) {
      this.${id(containerName)} = this.$(${selector});
    }`,
    js`var __rawArr = ${rawArr};`,
    ...jsAll`
      if (!__rawArr) { return; }
      this.${id(renderMethod)}(__rawArr);
    `
  ])
)
```

When a node shape has a dedicated fragment helper, prefer that first:

```ts
import { id, jsMethod } from 'eszter'

const method = jsMethod`${id('onUpdate')}(value, change) {
  if (!this.${id('__container')}) {
    this.${id('__container')} = this.$(${'.root'});
  }
  this.${id('__prev')} = value;
}`
```

---

## Known limitations

**Labeled `break` / `continue` in plain `js` / `jsAll`** — the default statement APIs still parse snippets inside an anonymous `while(true){}` wrapper, so outer labels are not visible there. Use `jsInContext(...)` / `jsAllInContext(...)` when labeled control flow needs explicit parse-time context.

**Top-level `import` / `export` in plain `js` / `jsAll`** — the default statement APIs are block-body oriented. Use `jsModule(...)` for module-level parsing.

**Template strings inside templates** — use `tpl\`...\`` instead of escaping backticks. See the [tpl section](#tpl-template-literals-in-generated-code) above.

**String-call placeholders** — `%%` is reserved as the placeholder marker in the string API. The number of `%%` markers must match the number of holes you pass.

**Fragment APIs parse in wrapper contexts** — helpers like `jsMethod` and
`jsProp` work by parsing your snippet in a synthetic wrapper such as a class,
object literal, or function parameter list, then extracting the requested node.
That makes them syntax-driven helpers for Babel nodes, not source-preserving
edit tools.

---

## Examples

See the [`examples/`](./examples) folder for complete, runnable examples covering:

- [`lazy-init.ts`](./examples/lazy-init.ts) — the most common "guard and initialise" pattern
- [`patch-statement.ts`](./examples/patch-statement.ts) — DOM attribute patching with guards
- [`rerender-block.ts`](./examples/rerender-block.ts) — multi-statement rerender logic
- [`array-observer.ts`](./examples/array-observer.ts) — building a full observer class method
- [`find-index-lookup.ts`](./examples/find-index-lookup.ts) — array index lookups with ternaries
- [`module-fragments.ts`](./examples/module-fragments.ts) — real module assembly, string-call helpers, and `parseAs` / `parseAsMany`
- [`fragments.ts`](./examples/fragments.ts) — module declarations, class members, object properties, patterns, and declarators
- [`edit-existing.ts`](./examples/edit-existing.ts) — clone-first subtree replacement and block editing
- [`mixing-with-babel.ts`](./examples/mixing-with-babel.ts) — combining eszter with raw `@babel/types`

---

## License

[MIT](./LICENSE) © [Armagan Amcalar](mailto:armagan@amcalar.com)

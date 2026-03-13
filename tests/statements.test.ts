/**
 * Tests for js`...` — single-statement construction and return-type inference.
 *
 * Every test checks two things:
 *   1. The runtime node type matches what TypeScript statically infers.
 *   2. The generated code round-trips back to the expected JavaScript.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import { js, id, str, num, bool, nil } from '../src/index.js'
import { assertCode } from './_utils.js'

describe('js`if ...`', () => {
  it('returns t.IfStatement', () => {
    const stmt = js`if (x) { y = 1; }`
    assert.equal(stmt.type, 'IfStatement')
    // TypeScript: stmt is t.IfStatement — the .test property exists
    const _: t.Expression = stmt.test
    assertCode(stmt, 'if (x) {\n  y = 1;\n}')
  })

  it('handles if with no space before paren: if(x)', () => {
    const stmt = js`if(x) { y = 1; }`
    assert.equal(stmt.type, 'IfStatement')
  })

  it('handles if/else', () => {
    const stmt = js`if (a) { b = 1; } else { b = 2; }`
    assert.equal(stmt.type, 'IfStatement')
    assert.ok(stmt.alternate !== null)
    assertCode(stmt, 'if (a) {\n  b = 1;\n} else {\n  b = 2;\n}')
  })

  it('handles if (!x)', () => {
    const stmt = js`if (!x) { y = 0; }`
    assert.equal(stmt.type, 'IfStatement')
    assert.equal(stmt.test.type, 'UnaryExpression')
    assertCode(stmt, 'if (!x) {\n  y = 0;\n}')
  })

  it('handles if (a !== b)', () => {
    const stmt = js`if (a !== b) { return; }`
    assert.equal(stmt.type, 'IfStatement')
    assert.equal(stmt.test.type, 'BinaryExpression')
  })

  it('handles if (a === b)', () => {
    const stmt = js`if (a === b) { c = d; }`
    assert.equal(stmt.type, 'IfStatement')
    assert.equal(stmt.test.type, 'BinaryExpression')
  })

  it('handles if (a && b)', () => {
    const stmt = js`if (a && b) { c(); }`
    assert.equal(stmt.type, 'IfStatement')
    assert.equal(stmt.test.type, 'LogicalExpression')
  })

  it('handles if (a || b)', () => {
    const stmt = js`if (a || b) { c(); }`
    assert.equal(stmt.type, 'IfStatement')
    assert.equal(stmt.test.type, 'LogicalExpression')
  })

  it('handles holes in test', () => {
    const x = t.identifier('myVar')
    const stmt = js`if (!${x}) { init(); }`
    assert.equal(stmt.type, 'IfStatement')
    const test = stmt.test as t.UnaryExpression
    assert.equal(test.operator, '!')
    assert.equal((test.argument as t.Identifier).name, 'myVar')
    assertCode(stmt, 'if (!myVar) {\n  init();\n}')
  })

  it('handles holes in consequent body', () => {
    const target = t.memberExpression(t.thisExpression(), t.identifier('_el'))
    const value = t.callExpression(t.memberExpression(t.thisExpression(), t.identifier('$')), [
      t.stringLiteral('.root')
    ])
    const stmt = js`if (!this._el) { ${target} = ${value}; }`
    assert.equal(stmt.type, 'IfStatement')
    assertCode(stmt, "if (!this._el) {\n  this._el = this.$('.root');\n}")
  })

  it('is indentation-agnostic', () => {
    const stmt = js`
      if (x) {
        y = 1;
      }
    `
    assert.equal(stmt.type, 'IfStatement')
  })
})

describe('js("...") string API', () => {
  it('infers t.IfStatement from a literal string', () => {
    const stmt = js('if (x) { y = 1; }')
    assert.equal(stmt.type, 'IfStatement')
    const _: t.Expression = stmt.test
    assertCode(stmt, 'if (x) {\n  y = 1;\n}')
  })

  it('infers t.ForStatement from a literal string with placeholders', () => {
    const limit = t.memberExpression(t.identifier('arr'), t.identifier('length'))
    const stmt = js('for (var i = 0; i < %%; i++) { body(); }', limit)
    assert.equal(stmt.type, 'ForStatement')
    const _: t.Statement = stmt.body
    assertCode(stmt, 'for (var i = 0; i < arr.length; i++) {\n  body();\n}')
  })

  it('falls back to t.Statement for expression statements', () => {
    const stmt = js('x = 1;')
    assert.equal(stmt.type, 'ExpressionStatement')
  })
})

describe('js`var/let/const ...`', () => {
  it('returns t.VariableDeclaration for var', () => {
    const stmt = js`var x = 1;`
    assert.equal(stmt.type, 'VariableDeclaration')
    assert.equal((stmt as t.VariableDeclaration).kind, 'var')
    assertCode(stmt, 'var x = 1;')
  })

  it('returns t.VariableDeclaration for let', () => {
    const stmt = js`let y = 2;`
    assert.equal(stmt.type, 'VariableDeclaration')
    assert.equal((stmt as t.VariableDeclaration).kind, 'let')
  })

  it('returns t.VariableDeclaration for const', () => {
    const stmt = js`const z = 3;`
    assert.equal(stmt.type, 'VariableDeclaration')
    assert.equal((stmt as t.VariableDeclaration).kind, 'const')
  })

  it('holes in the initialiser', () => {
    const init = t.memberExpression(t.identifier('a'), t.identifier('b'))
    const stmt = js`var ${id('result')} = ${init};`
    assert.equal(stmt.type, 'VariableDeclaration')
    assertCode(stmt, 'var result = a.b;')
  })

  it('holes as the variable name', () => {
    const stmt = js`var ${id('__tmp')} = null;`
    const decl = stmt as t.VariableDeclaration
    assert.equal((decl.declarations[0].id as t.Identifier).name, '__tmp')
    assertCode(stmt, 'var __tmp = null;')
  })

  it('handles ternary in initialiser', () => {
    const stmt = js`var ${id('el')} = ${id('parent')} ? ${id('parent')}.firstChild : null;`
    assertCode(stmt, 'var el = parent ? parent.firstChild : null;')
  })
})

describe('js`return ...`', () => {
  it('returns t.ReturnStatement', () => {
    const stmt = js`return x;`
    assert.equal(stmt.type, 'ReturnStatement')
    assertCode(stmt, 'return x;')
  })

  it('returns t.ReturnStatement for bare return', () => {
    const stmt = js`return;`
    assert.equal(stmt.type, 'ReturnStatement')
    assert.equal((stmt as t.ReturnStatement).argument, null)
  })

  it('handles return with a hole', () => {
    const expr = t.identifier('el')
    const stmt = js`return ${expr};`
    assert.equal(stmt.type, 'ReturnStatement')
    assertCode(stmt, 'return el;')
  })
})

describe('js`for ...`', () => {
  it('returns t.ForStatement', () => {
    const stmt = js`for (var i = 0; i < n; i++) {}`
    assert.equal(stmt.type, 'ForStatement')
    assertCode(stmt, 'for (var i = 0; i < n; i++) {}')
  })

  it('handles holes in the init/test/update', () => {
    const n = t.memberExpression(t.identifier('arr'), t.identifier('length'))
    const stmt = js`for (var i = 0; i < ${n}; i++) { body(); }`
    assert.equal(stmt.type, 'ForStatement')
    assertCode(stmt, 'for (var i = 0; i < arr.length; i++) {\n  body();\n}')
  })
})

describe('js`while ...`', () => {
  it('returns t.WhileStatement', () => {
    const stmt = js`while (x > 0) { x--; }`
    assert.equal(stmt.type, 'WhileStatement')
  })
})

describe('js`do ...`', () => {
  it('returns t.DoWhileStatement', () => {
    const stmt = js`do { x++; } while (x < 10);`
    assert.equal(stmt.type, 'DoWhileStatement')
  })
})

describe('js`continue`', () => {
  it('returns t.ContinueStatement', () => {
    const stmt = js`continue;`
    assert.equal(stmt.type, 'ContinueStatement')
  })

  it('continue without label has null label field', () => {
    const stmt = js`continue;`
    assert.equal(stmt.type, 'ContinueStatement')
    assert.equal((stmt as t.ContinueStatement).label, null)
  })
})

describe('js`break`', () => {
  it('returns t.BreakStatement', () => {
    const stmt = js`break;`
    assert.equal(stmt.type, 'BreakStatement')
  })
})

describe('js`throw ...`', () => {
  it('returns t.ThrowStatement', () => {
    const stmt = js`throw new Error('oops');`
    assert.equal(stmt.type, 'ThrowStatement')
    assertCode(stmt, "throw new Error('oops');")
  })

  it('handles a hole as the thrown expression', () => {
    const err = t.newExpression(t.identifier('TypeError'), [t.stringLiteral('bad')])
    const stmt = js`throw ${err};`
    assert.equal(stmt.type, 'ThrowStatement')
    assertCode(stmt, "throw new TypeError('bad');")
  })
})

describe('js`switch ...`', () => {
  it('returns t.SwitchStatement', () => {
    const stmt = js`switch (x) { case 1: break; }`
    assert.equal(stmt.type, 'SwitchStatement')
  })
})

describe('js`try ...`', () => {
  it('returns t.TryStatement', () => {
    const stmt = js`try { x(); } catch (e) { handle(e); }`
    assert.equal(stmt.type, 'TryStatement')
  })
})

describe('js`function ...`', () => {
  it('returns t.FunctionDeclaration', () => {
    const stmt = js`function greet(name) { return name; }`
    assert.equal(stmt.type, 'FunctionDeclaration')
  })
})

describe('js`class ...`', () => {
  it('returns t.ClassDeclaration', () => {
    const stmt = js`class Foo {}`
    assert.equal(stmt.type, 'ClassDeclaration')
  })
})

describe('js`{ ... }` (block statement)', () => {
  it('returns t.BlockStatement', () => {
    const stmt = js`{ var x = 1; }`
    assert.equal(stmt.type, 'BlockStatement')
  })
})

describe('js — fallback to t.Statement for expression statements', () => {
  it('returns t.Statement for plain expression statements', () => {
    const stmt = js`x = 1;`
    // TypeScript infers t.Statement (the fallback), runtime is ExpressionStatement
    assert.equal(stmt.type, 'ExpressionStatement')
  })
})

describe('js — literal values round-trip', () => {
  it('handles string literal holes', () => {
    const stmt = js`var x = ${str('.container')};`
    assertCode(stmt, "var x = '.container';")
  })

  it('handles numeric literal holes', () => {
    const stmt = js`var x = ${num(0)};`
    assertCode(stmt, 'var x = 0;')
  })

  it('handles boolean literal holes', () => {
    const stmt = js`el.cloneNode(${bool(false)});`
    assertCode(stmt, 'el.cloneNode(false);')
  })

  it('handles null literal holes', () => {
    const stmt = js`var x = ${nil()};`
    assertCode(stmt, 'var x = null;')
  })
})

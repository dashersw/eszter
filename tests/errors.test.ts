/**
 * Tests for error paths: bad templates, wrong cardinality, non-expression body.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { js, jsAll, jsExpr, id } from '../src/index.js'

describe('js`...` errors', () => {
  it('throws when template produces zero statements', () => {
    assert.throws(() => js`  `, /exactly one statement, got 0/)
  })

  it('throws when template produces more than one statement', () => {
    assert.throws(() => js`var a = 1; var b = 2;` as unknown, /exactly one statement, got 2/)
  })

  it('error message mentions jsAll as the alternative', () => {
    let msg = ''
    try {
      js`var a = 1; var b = 2;` as unknown
    } catch (e) {
      msg = (e as Error).message
    }
    assert.ok(msg.includes('jsAll'), `Expected 'jsAll' in error message: ${msg}`)
  })
})

describe('jsExpr`...` errors', () => {
  it('throws when template is not an expression statement', () => {
    assert.throws(() => jsExpr`if (x) {}` as unknown, /expression statement.*got IfStatement/)
  })

  it('throws for var declaration (not an expression)', () => {
    assert.throws(() => jsExpr`var x = 1;` as unknown, /expression statement.*got VariableDeclaration/)
  })

  it('throws when template produces multiple statements', () => {
    assert.throws(() => jsExpr`a = 1; b = 2;` as unknown, /single expression, got 2 statements/)
  })

  it('error message mentions js as the alternative', () => {
    let msg = ''
    try {
      jsExpr`if (x) {}` as unknown
    } catch (e) {
      msg = (e as Error).message
    }
    assert.ok(msg.includes('js`'), `Expected 'js\`' in error message: ${msg}`)
  })
})

describe('parse errors', () => {
  it('throws with a helpful message on syntax error in template', () => {
    assert.throws(
      () => jsAll`var x = @invalid;`,
      (err: Error) => {
        assert.ok(err.message.includes('eszter:'), 'message should start with eszter:')
        assert.ok(err.message.includes('Reconstructed source'), 'should include source')
        assert.ok(err.message.includes('Parser error'), 'should include parser error')
        return true
      }
    )
  })

  it('includes the reconstructed source in the error', () => {
    let msg = ''
    try {
      jsAll`var x = @bad;`
    } catch (e) {
      msg = (e as Error).message
    }
    assert.ok(msg.includes('var x = @bad;'), `Should include source in: ${msg}`)
  })
})

describe('string API errors', () => {
  it('throws when placeholder count does not match holes', () => {
    assert.throws(() => js('if (%%) { init(%%); }', id('ready')) as unknown, /expected 1 "%%" placeholder\(s\), got 2/)
  })
})

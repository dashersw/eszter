/**
 * Tests for label-aware statement parsing helpers.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { jsAllInContext, jsInContext } from '../src/index.js'
import { assertCode } from './_utils.js'

describe('jsInContext', () => {
  it('parses labeled continue with explicit loop context', () => {
    const jsOuter = jsInContext({ continueLabels: ['outer'] })
    const stmt = jsOuter`if (!row) { continue outer; }`
    assert.equal(stmt.type, 'IfStatement')
    assertCode(stmt, 'if (!row) {\n  continue outer;\n}')
  })

  it('supports string-call form too', () => {
    const jsDone = jsInContext({ breakLabels: ['done'] })
    const stmt = jsDone('if (stop) { break done; }')
    assert.equal(stmt.type, 'IfStatement')
    assertCode(stmt, 'if (stop) {\n  break done;\n}')
  })

  it('throws when more than one statement is produced', () => {
    const jsOuter = jsInContext({ continueLabels: ['outer'] })
    assert.throws(() => jsOuter`continue outer; continue outer;` as unknown, /exactly one statement, got 2/)
  })
})

describe('jsAllInContext', () => {
  it('parses multiple statements with labeled control flow', () => {
    const block = jsAllInContext({ continueLabels: ['outer'], breakLabels: ['done'] })
    const stmts = block`
      if (!row) { continue outer; }
      if (finished) { break done; }
    `
    assert.equal(stmts.length, 2)
    assertCode(stmts[0], 'if (!row) {\n  continue outer;\n}')
    assertCode(stmts[1], 'if (finished) {\n  break done;\n}')
  })
})

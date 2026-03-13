/**
 * Shared helper: generate code from an AST node and print it.
 * Every example imports this instead of depending on @babel/generator directly.
 */
import { createRequire } from 'module'
import * as t from '@babel/types'

const require = createRequire(import.meta.url)
const _generate = require('@babel/generator')
const generate: (node: t.Node) => { code: string } = _generate.default ?? _generate

export function print(label: string, node: t.Node | t.Node[]): void {
  const nodes = Array.isArray(node) ? node : [node]
  const code = nodes
    .map(n => generate(n, { jsescOption: { quotes: 'single' } }).code)
    .join('\n')
  console.log(`\n// ${label}`)
  console.log(code)
}

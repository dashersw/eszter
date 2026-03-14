/**
 * Tests for top-level module parsing helpers.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as t from '@babel/types'
import {
  id,
  jsAs,
  jsAsMany,
  jsExport,
  jsExportAll,
  jsExportDefault,
  jsImport,
  jsModule,
  jsModuleBody,
  str
} from '../src/index.js'
import { assertCode } from './_utils.js'

describe('jsModule', () => {
  it('parses import and export declarations', () => {
    const nodes = jsModule`
      import { foo } from './dep';
      export const value = 1;
    `
    assert.equal(nodes.length, 2)
    assert.equal(nodes[0].type, 'ImportDeclaration')
    assert.equal(nodes[1].type, 'ExportNamedDeclaration')
    assertCode(nodes[0] as t.Node, "import { foo } from './dep';")
    assertCode(nodes[1] as t.Node, 'export const value = 1;')
  })

  it('supports the string-call form with holes', () => {
    const nodes = jsModule(
      'import { %% as %% } from %%; export const %% = %%;',
      id('foo'),
      id('bar'),
      str('./dep'),
      id('answer'),
      42
    )
    assert.equal(nodes.length, 2)
    assertCode(nodes[0] as t.Node, "import { foo as bar } from './dep';")
    assertCode(nodes[1] as t.Node, 'export const answer = 42;')
  })
})

describe('module fragments', () => {
  it('parses single module declarations via the generic fragment API', () => {
    const buildImport = jsAs('ImportDeclaration')
    const buildExport = jsAs('ExportNamedDeclaration')

    const importDecl = buildImport`import { ${id('foo')} as ${id('bar')} } from ${'./dep'};`
    const exportDecl = buildExport`export const ${id('value')} = 1;`

    assert.equal(importDecl.type, 'ImportDeclaration')
    assert.equal(exportDecl.type, 'ExportNamedDeclaration')
    assertCode(importDecl, "import { foo as bar } from './dep';")
    assertCode(exportDecl, 'export const value = 1;')
  })

  it('parses module bodies via the generic collection API', () => {
    const buildBody = jsAsMany('ModuleBody')
    const body = buildBody`
      import data from './dep';
      export default data;
    `

    assert.equal(body.length, 2)
    assertCode(body[0] as t.Node, "import data from './dep';")
    assertCode(body[1] as t.Node, 'export default data;')
  })

  it('provides import/export aliases for common module declarations', () => {
    const importDecl = jsImport`import data from ${'./dep'};`
    const namedExport = jsExport`export const ${id('value')} = 1;`
    const defaultExport = jsExportDefault`export default function ${id('load')}() {}`
    const exportAll = jsExportAll`export * from ${'./shared'};`
    const moduleBody = jsModuleBody`
      import data from './dep';
      export default data;
    `

    assertCode(importDecl, "import data from './dep';")
    assertCode(namedExport, 'export const value = 1;')
    assertCode(defaultExport, 'export default function load() {}')
    assertCode(exportAll, "export * from './shared';")
    assert.equal(moduleBody.length, 2)
    assertCode(moduleBody[0] as t.Node, "import data from './dep';")
    assertCode(moduleBody[1] as t.Node, 'export default data;')
  })

  it('throws when a module fragment parses to the wrong declaration kind', () => {
    const buildImport = jsAs('ImportDeclaration')
    assert.throws(() => buildImport`export const value = 1;`, /did not produce a ImportDeclaration/)
  })

  it('reports module fragment parse errors helpfully', () => {
    const buildExport = jsAs('ExportDefaultDeclaration')
    assert.throws(() => buildExport`export default`, /failed to parse ExportDefaultDeclaration template/)
    assert.throws(() => jsAsMany('ModuleBody')`import`, /failed to parse ModuleBody template/)
  })
})

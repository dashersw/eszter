/**
 * module-fragments.ts
 *
 * Focused examples for module composition as a real workflow:
 * build imports, assemble a reusable module body, and export a final entrypoint.
 * It also shows the string-call form and the parseAs / parseAsMany aliases.
 */
import {
  id,
  jsExport,
  jsExportAll,
  jsExportDefault,
  jsImport,
  jsModule,
  jsModuleBody,
  parseAs,
  parseAsMany
} from '../src/index.js'
import { print } from './_print.js'

const parsedModule = jsModule`
  import { foo } from './dep';
  export const value = 1;
`
print('jsModule', parsedModule)

const parsedModuleString = jsModule(
  'import { %% as %% } from %%; export { %% };',
  id('loadTodos'),
  id('load'),
  './data',
  id('load')
)
print('jsModule(string-call)', parsedModuleString)

const loadImport = parseAs('ImportDeclaration')('import { %% as %% } from %%;', id('loadTodos'), id('load'), './data')
print('parseAs(ImportDeclaration)', loadImport)

const importDecl = jsImport`import config from ${'./config'};`
const namedExport = jsExport`export const ${id('enabled')} = true`
const defaultExport = jsExportDefault`export default config`
const exportAll = jsExportAll`export * from ${'./shared'}`
print('single declaration aliases', [importDecl, namedExport, defaultExport, exportAll])

const featureScaffold = parseAsMany('ModuleBody')(
  'const %% = %%(); export const %% = %%;',
  id('feature'),
  id('load'),
  id('enabled'),
  true
)
print('parseAsMany(ModuleBody)', featureScaffold)

const moduleBody = jsModuleBody`
  const feature = load();
  export const enabled = true;
`
const assembledModule = [
  loadImport,
  jsImport`import config from ${'./config'};`,
  ...moduleBody,
  jsExport`export const ${id('configValue')} = config.value`,
  jsExportDefault`export default feature`
]
print('jsModuleBody assembly', assembledModule)

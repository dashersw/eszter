/**
 * fragments.ts
 *
 * Fragment helpers cover node shapes that are not valid as standalone
 * statements or expressions: module declarations, class methods, object
 * properties, declarators, and patterns.
 */
import * as t from '@babel/types'
import {
  id,
  jsArrayPattern,
  jsArrayElements,
  jsArrayExpr,
  jsAs,
  jsAsMany,
  jsAssignmentPattern,
  jsClass,
  jsClassBody,
  jsClassProp,
  jsDeclarator,
  jsExport,
  jsExportAll,
  jsExportDefault,
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
} from '../src/index.js'
import { print } from './_print.js'

const genericMethod = jsAs('ClassMethod')`${id('render')}(value, change) { return value ?? change; }`
print('jsAs(ClassMethod)', t.classDeclaration(t.identifier('Demo'), null, t.classBody([genericMethod]), []))

const genericClassBody = jsAsMany('ClassBody')`
  state = null
  render() { return 1; }
`
print('jsAsMany(ClassBody)', t.classDeclaration(t.identifier('DemoBody'), null, t.classBody(genericClassBody), []))

const genericImport = jsAs('ImportDeclaration')`import { ${id('foo')} as ${id('bar')} } from ${'./dep'};`
print('jsAs(ImportDeclaration)', genericImport)

const genericModuleBody = jsAsMany('ModuleBody')`
  import data from './dep';
  export default data;
`
print('jsAsMany(ModuleBody)', genericModuleBody)

const method = jsMethod`${id('load')}(item) { return item.id; }`
print('jsMethod', t.classDeclaration(t.identifier('Store'), null, t.classBody([method]), []))

const importDecl = jsImport`import data from ${'./dep'};`
print('jsImport', importDecl)

const namedExport = jsExport`export const ${id('value')} = 1`
print('jsExport', namedExport)

const defaultExport = jsExportDefault`export default function ${id('load')}() {}`
print('jsExportDefault', defaultExport)

const exportAll = jsExportAll`export * from ${'./shared'}`
print('jsExportAll', exportAll)

const classProp = jsClassProp`${id('state')} = null`
print('jsClassProp', t.classDeclaration(t.identifier('StoreState'), null, t.classBody([classProp]), []))

const privateMethod = jsPrivateMethod`#${id('render')}(value) { return value; }`
print('jsPrivateMethod', t.classDeclaration(t.identifier('SecretStore'), null, t.classBody([privateMethod]), []))

const privateProp = jsPrivateProp`#${id('cache')} = new Map()`
print('jsPrivateProp', t.classDeclaration(t.identifier('SecretStore'), null, t.classBody([privateProp]), []))

const objectMethod = jsObjectMethod`${id('load')}(item) { return item.id; }`
print('jsObjectMethod', t.objectExpression([objectMethod]))

const objectProp = jsProp`${id('enabled')}: true`
print('jsProp', t.objectExpression([objectProp]))

const objectBody = jsObjectBody`
  enabled: true,
  render() { return 1; }
`
print('jsObjectBody', t.objectExpression(objectBody))

const declarator = jsDeclarator`${id('answer')} = 42`
print('jsDeclarator', t.variableDeclaration('const', [declarator]))

const pattern = jsPattern`{ id, label = fallback }`
print('jsPattern', t.functionDeclaration(t.identifier('demo'), [pattern], t.blockStatement([])))

const objectPattern = jsObjectPattern`{ id, label = fallback }`
print('jsObjectPattern', t.functionDeclaration(t.identifier('demoObject'), [objectPattern], t.blockStatement([])))

const arrayPattern = jsArrayPattern`[first, second]`
print('jsArrayPattern', t.functionDeclaration(t.identifier('demoArray'), [arrayPattern], t.blockStatement([])))

const assignmentPattern = jsAssignmentPattern`${id('value')} = 1`
print(
  'jsAssignmentPattern',
  t.functionDeclaration(t.identifier('demoDefault'), [assignmentPattern], t.blockStatement([]))
)

const rest = jsRest`...items`
print('jsRest', t.functionDeclaration(t.identifier('demoRest'), [rest], t.blockStatement([])))

const params = jsParams`value, { id }, ...rest`
print('jsParams', t.functionDeclaration(t.identifier('demoParams'), params, t.blockStatement([])))

const elements = jsArrayElements`1, value, ...rest`
print('jsArrayElements', t.arrayExpression(elements))

const classBody = jsClassBody`
  state = null
  render() { return 1; }
`
print('jsClassBody', t.classDeclaration(t.identifier('DemoClassBody'), null, t.classBody(classBody), []))

const moduleBody = jsModuleBody`
  import data from './dep';
  export default data;
`
print('jsModuleBody', moduleBody)

const objectExpr = jsObjectExpr`{ enabled: true, render() { return 1; } }`
print('jsObjectExpr', objectExpr)

const arrayExpr = jsArrayExpr`[1, value, ...rest]`
print('jsArrayExpr', arrayExpr)

const classDecl = jsClass`class Example { render(value) { return value; } }`
print('jsClass', classDecl)

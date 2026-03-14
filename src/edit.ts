import * as t from '@babel/types'
import type { RewriteVisitor } from './types.js'

type ReplaceInput<T extends t.Node> = T | ((node: T) => T)

function cloneNode<T extends t.Node>(node: T): T {
  return t.cloneNode(node, true)
}

function resolveReplacement<T extends t.Node>(node: T, next: ReplaceInput<T>): T {
  const current = cloneNode(node)
  const replacement = typeof next === 'function' ? next(current) : next
  return cloneNode(replacement)
}

function cloneStatements(statements: readonly t.Statement[]): t.Statement[] {
  return statements.map(statement => cloneNode(statement))
}

function findStatementIndex(block: t.BlockStatement, target: t.Statement): number {
  return block.body.indexOf(target)
}

function replaceWithVisitor(node: t.Node, visitor: RewriteVisitor): t.Node {
  const entered = visitor.enter?.(cloneNode(node)) ?? cloneNode(node)
  const copy = { ...entered } as Record<string, unknown>
  /* v8 ignore next -- Babel node types expose VISITOR_KEYS for semantic traversal */
  const keys = (t.VISITOR_KEYS as Record<string, string[]>)[entered.type] ?? []

  for (const key of keys) {
    const value = copy[key]
    if (value === null || value === undefined) continue

    if (Array.isArray(value)) {
      copy[key] = value.map(item => {
        if (item !== null && typeof item === 'object' && typeof (item as t.Node).type === 'string') {
          return replaceWithVisitor(item as t.Node, visitor)
        }
        return item
      })
      continue
    }

    if (typeof value === 'object' && typeof (value as t.Node).type === 'string') {
      copy[key] = replaceWithVisitor(value as t.Node, visitor)
    }
  }

  const rewritten = copy as unknown as t.Node
  const handler = visitor[rewritten.type as keyof RewriteVisitor] as ((node: t.Node) => t.Node | void) | undefined
  const handled = handler?.(rewritten) ?? rewritten
  return visitor.exit?.(handled) ?? handled
}

export function replaceExpr(node: t.Expression, next: ReplaceInput<t.Expression>): t.Expression {
  return resolveReplacement(node, next)
}

export function replaceStmt<T extends t.Statement>(node: T, next: ReplaceInput<T>): T {
  return resolveReplacement(node, next)
}

export function replaceMany<T extends t.Statement>(
  node: T,
  next: readonly t.Statement[] | ((node: T) => readonly t.Statement[])
): t.Statement[] {
  const current = cloneNode(node)
  const replacement = typeof next === 'function' ? next(current) : next
  return cloneStatements(replacement)
}

export function wrapExpr(node: t.Expression, wrap: (node: t.Expression) => t.Expression): t.Expression {
  return cloneNode(wrap(cloneNode(node)))
}

export function wrapStmt<T extends t.Statement>(node: T, wrap: (node: T) => t.Statement): t.Statement {
  return cloneNode(wrap(cloneNode(node)))
}

export function appendToBlock(block: t.BlockStatement, ...statements: readonly t.Statement[]): t.BlockStatement {
  return t.blockStatement([...cloneStatements(block.body), ...cloneStatements(statements.flat())])
}

export function prependToBlock(block: t.BlockStatement, ...statements: readonly t.Statement[]): t.BlockStatement {
  return t.blockStatement([...cloneStatements(statements.flat()), ...cloneStatements(block.body)])
}

export function insertBefore(
  block: t.BlockStatement,
  target: t.Statement,
  ...statements: readonly t.Statement[]
): t.BlockStatement {
  const index = findStatementIndex(block, target)
  if (index === -1) {
    throw new Error(`eszter: target statement was not found in block body.`)
  }
  const before = cloneStatements(block.body.slice(0, index))
  const after = cloneStatements(block.body.slice(index))
  return t.blockStatement([...before, ...cloneStatements(statements.flat()), ...after])
}

export function insertAfter(
  block: t.BlockStatement,
  target: t.Statement,
  ...statements: readonly t.Statement[]
): t.BlockStatement {
  const index = findStatementIndex(block, target)
  if (index === -1) {
    throw new Error(`eszter: target statement was not found in block body.`)
  }
  const before = cloneStatements(block.body.slice(0, index + 1))
  const after = cloneStatements(block.body.slice(index + 1))
  return t.blockStatement([...before, ...cloneStatements(statements.flat()), ...after])
}

export function removeNode(block: t.BlockStatement, target: t.Statement): t.BlockStatement {
  const index = findStatementIndex(block, target)
  if (index === -1) {
    throw new Error(`eszter: target statement was not found in block body.`)
  }
  return t.blockStatement(cloneStatements(block.body.filter((_, currentIndex) => currentIndex !== index)))
}

export function rewrite<T extends t.Node>(node: T, visitor: RewriteVisitor): T {
  return replaceWithVisitor(node, visitor) as T
}

export function renameIdentifier<T extends t.Node>(node: T, from: string, to: string): T {
  return rewrite(node, {
    Identifier(identifier) {
      if (identifier.name === from) {
        return t.identifier(to)
      }
    }
  })
}

export function replaceIdentifier<T extends t.Node>(node: T, name: string, expr: t.Expression): T {
  return rewrite(node, {
    Identifier(identifier) {
      if (identifier.name === name) {
        return cloneNode(expr)
      }
    }
  })
}

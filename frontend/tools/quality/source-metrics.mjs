import { createHash } from 'node:crypto'
import { Linter } from 'eslint'
import parser from '@typescript-eslint/parser'
import sonarjs from 'eslint-plugin-sonarjs'
import { analyze, extractTokens } from 'estree-halstead'

const linter = new Linter()
const callableTypes = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

export function measureSource(source, file) {
  const parsed = parser.parseForESLint(source, { loc: true, range: true, tokens: true, comment: true })
  const units = []
  const prohibitedTypes = []
  function visit(node, parent) {
    if (node.type === 'TSAnyKeyword' || node.type === 'TSUnknownKeyword') {
      prohibitedTypes.push({ kind: node.type, line: node.loc.start.line })
    }
    if (callableTypes.has(node.type)) {
      const unit = parent?.type === 'MethodDefinition'
        || (parent?.type === 'Property' && (parent.method || parent.kind !== 'init'))
        ? parent : node
      const name = node.id?.name ?? parent?.key?.name ?? parent?.id?.name ?? '(anonymous)'
      units.push({
        name, kind: node.type, range: unit.range, location: unit.loc,
        cyclomatic: null, cognitive: 0, halstead: halsteadFor(unit), body: node.body.loc,
      })
    }
    if (node.type === 'PropertyDefinition' && node.value && !callableTypes.has(node.value.type)) {
      units.push({
        name: node.key.name, kind: 'field-initializer', range: node.range, location: node.loc,
        cyclomatic: null, cognitive: 0, halstead: halsteadFor(node),
      })
    }
    for (const key of parsed.visitorKeys[node.type] ?? []) {
      const value = node[key]
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) visit(child, node)
      } else if (value?.type) visit(value, node)
    }
  }
  visit(parsed.ast, null)
  const messages = linter.verify(source, {
    files: ['**/*.ts'],
    languageOptions: { parser, ecmaVersion: 'latest', sourceType: 'module' },
    plugins: { sonarjs },
    // Zero is a reporting threshold here: collect exact analyzer counts,
    // then enforce the repository's strict limits against the result below.
    rules: { complexity: ['error', { max: 0, variant: 'classic' }], 'sonarjs/cognitive-complexity': ['error', 0] },
  }, { filename: file })
  const lineStarts = [0]
  for (let i = 0; i < source.length; i += 1) if (source[i] === '\n') lineStarts.push(i + 1)
  for (const message of messages) {
    const match = message.ruleId === 'complexity'
      ? message.message.match(/complexity of (\d+)/)
      : message.ruleId === 'sonarjs/cognitive-complexity'
        ? message.message.match(/Complexity from (\d+)/) : null
    if (!match) throw new Error(`Unexpected analyzer diagnostic in ${file}: ${message.message}`)
    const offset = lineStarts[message.line - 1] + message.column - 1
    const unit = units.filter(({ range }) => range[0] <= offset && offset < range[1])
      .sort((a, b) => a.range[1] - a.range[0] - (b.range[1] - b.range[0]))[0]
    if (!unit) throw new Error(`Analyzer diagnostic has no callable in ${file}:${message.line}`)
    unit[message.ruleId === 'complexity' ? 'cyclomatic' : 'cognitive'] = Number(match[1])
  }
  if (units.some(unit => unit.cyclomatic === null)) {
    throw new Error(`Missing cyclomatic measurements in ${file}`)
  }
  return {
    file, sourceHash: createHash('sha256').update(source).digest('hex'),
    sourceLines: source.split('\n').length - Number(source.endsWith('\n')), prohibitedTypes, units,
  }
}

function halsteadFor(node) {
  const { operators, operands } = extractTokens(node)
  return {
    ...analyze(node),
    operators: { distinct: operators.distinctSize, total: operators.totalSize },
    operands: { distinct: operands.distinctSize, total: operands.totalSize },
  }
}

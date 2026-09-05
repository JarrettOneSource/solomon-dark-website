import { rendererFiles } from './tools/quality/scope.mjs'

export default {
  mutate: rendererFiles,
  testRunner: 'command',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.app.json',
  typescriptChecker: { prioritizePerformanceOverAccuracy: false },
  commandRunner: { command: 'node tools/quality/mutation-tests.mjs' },
  coverageAnalysis: 'off',
  concurrency: 2,
  timeoutMS: 10000,
  timeoutFactor: 2,
  reporters: ['clear-text', 'progress', 'json', 'html'],
  jsonReporter: { fileName: 'reports/renderer-quality/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/renderer-quality/mutation/index.html' },
  thresholds: { high: 100, low: 100, break: 100 },
  tempDirName: '.stryker-renderer-tmp',
}

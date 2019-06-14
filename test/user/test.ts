import chalk from 'chalk';

let tests = []
let afters = []
export function test (name, fn) {tests.push([name, fn])}
export function after (fn) {afters.push(fn)}
export async function runTests() {
  for (let i = 0; i < tests.length; i++) {
    const [name, fn] = tests[i]
    console.log(name)
    try {
      await fn()
      console.log(chalk.green('Passed ✓'))
    } catch (e) {
      console.error(chalk.red(e.stack))
      console.error(chalk.red('Failed :('))
    }
  }
  for (let i = 0; i < afters.length; i++) {
    await afters[i]()
  }
}

export const log = (...args) => {
  const err = new Error()
  const fileNameRegex = /\(.*\)/g

  const match = fileNameRegex.exec(err.stack.split('\n')[2])
  console.log(chalk.cyan(match[0].slice(1, match[0].length - 1)))
  console.log(...args)
}
let hasRun = false
process.on('beforeExit', () => {
  if (!hasRun) {
    hasRun = true
    runTests()
  }
})
import chalk from 'chalk';
import uuid from 'uuid/v4'

let tests = []
let afters = []
let befores = []
let onlys = []
export function test (name, fn) {
  const id = uuid()
  tests.push([name, fn, id])
}
test.skip = (name?, fn?) => {}
test.only = (name, fn) => {
  const id = uuid()
  tests.push([name, fn, id])
  onlys.push(id)
}

export function after (fn) {afters.push(fn)}
export function before(fn) {befores.push(fn)}
export async function runTests() {
  for (let i = 0; i < afters.length; i++) {
    await befores[i]()
  }
  for (let i = 0; i < tests.length; i++) {
    const [name, fn, id] = tests[i]
    if (onlys.length && !onlys.includes(id)) continue
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
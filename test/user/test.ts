import chalk from 'chalk';
import uuid from 'uuid/v4'

let curOnlys = []
let curItems = []
let curAfters = []
let curBefores = []

export function test(name, fn, id?: string) {
  id = id || uuid()
  const test = {
    name,
    fn,
    id,
    type: 'test',
  }
  curItems.push(test)
}

test.skip = (name?, fn?) => {}
test.only = (name, fn) => {
  const id = uuid()
  curOnlys.push(id)
  test(name, fn, id)
}

export function describe(name, fn, id?) {
  id = id || uuid()
  const onlys = []
  const items = []
  const befores = []
  const afters = []
  const describe = {
    name,
    id,
    onlys,
    items,
    afters,
    befores,
    type: "describe",
  }
  curItems.push(describe)

  const prevCurItems = curItems
  const prevOnlys = curOnlys
  const prevBefores = curBefores
  const prevAfters = curAfters
  curOnlys = onlys
  curItems = items
  curBefores = befores
  curAfters = afters
  fn()
  curItems = prevCurItems
  curOnlys = prevOnlys
  curBefores = prevBefores
  curAfters = prevAfters
}

describe.only = (name, fn) => {
  const id = uuid()
  curOnlys.push(id)
  describe(name, fn, id)
}
describe.skip = (name?, fn?) => {}

let depth = 0
export async function runTests(items, onlys) {
  depth++
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (onlys.length && !onlys.includes(item.id)) continue
    if (item.type === "test") {
      try {
        console.log(chalk.magenta(`${"#".repeat(depth)} Running ${item.name}`))
        await item.fn()
        console.log(chalk.green(`Passed ✓ ${item.name}`))
      } catch (e) {
        console.error(chalk.red(e.stack))
        console.error(name, chalk.red('Failed :('))
      }
    } else if (item.type === "describe") {
      console.log(chalk.cyan(`${"#".repeat(depth)} ${item.name.toUpperCase()}`))
      for (let i = 0; i < item.befores.length; i++) {
        try {
          await item.befores[i]()
        } catch (e) {
          console.error(e)
        }
      }
      await runTests(item.items, item.onlys)
      for (let i = 0; i < item.afters.length; i++) {
        try {
          await item.afters[i]()
        } catch (e) {
          console.error(e)
        }
      }
    }
  }
  depth++
}

export function after (fn) {
  curAfters.push(fn)
}
export function before(fn) {
  curBefores.push(fn)
}

export const log = (...args) => {
  const err = new Error()
  const fileNameRegex = /\(.*\)/g
  const match = fileNameRegex.exec(err.stack.split('\n')[2])
  console.log(chalk.cyan(match[0].slice(1, match[0].length - 1)))
  console.log(...args)
}

let hasRun = false
process.on('beforeExit', async () => {
  if (!hasRun) {
    hasRun = true
    for (let i = 0; i < curBefores.length; i++) {
      try {
        await curBefores[i]()
      } catch (e) {
        console.error(e)
      }
    }
    await runTests(curItems, curOnlys)
    for (let i = 0; i < curAfters.length; i++) {
      try {
        await curAfters[i]()
      } catch (e) {
        console.error(e)
      }
    }
  }
})
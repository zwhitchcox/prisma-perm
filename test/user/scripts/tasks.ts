import chalk from "chalk";
import * as _ from 'lodash'

const tasks = {}
export function task(name, func, ...deps) {
  if (tasks[name])
    throw new Error('There is already a task with the name ' + name)
  if (typeof func === "string" || Array.isArray(func)) {
    deps = [].concat(func)
    func = null
  }
  tasks[name] = {
    func,
    name,
    deps: [].concat(deps),
  }
}

let taskToRun = ''
export function toRun(name) {
  taskToRun = name
}

let run = 0
process.on('beforeExit', async () => {
  if (!run++) {
    if (!taskToRun) {
      throw new Error('You must specify a task to run')
    }
    console.log(taskToRun)
    runTasks([taskToRun])
  }
})

type TFunc =  () => void
type TDeps = string | string[]



async function runTasks(taskList) {
  for (let i = 0; i < taskList.length; i++) {
    const task = tasks[taskList[i]]
    if (task.deps.length) {
      await runTasks(task.deps)
    }

    if (!task.func) return
    console.log(chalk.green(`running ${task.name}`))
    try {
      await task.func()
    } catch(e) {
      console.error(e)
      return
    }
    console.log(chalk.green(`completed ${task.name}`))
  }
}
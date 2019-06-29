#!/usr/bin/env node
import fs from 'fs-extra'
import yaml from 'js-yaml'
import path from 'path'
import chalk from 'chalk'
import { generate } from './generate-properties'
import mkdirp from 'mkdirp-promise'
import { crudDirectives, prismaDirectives } from './directives';

const args = process.argv.slice(2)



const dir = process.cwd()

const help =
`
${chalk.cyan(`Create a file called prisma.perm.yaml in your prisma directory
or current working directory with a generate config like the following:`)}

${chalk.green(`generate:
  graphql-directives: ./generated/perm/directives.graphql
  properties:
    - ./generated/perm/properties.js
    - ./src/generated/perm/properties.ts`)}

${chalk.cyan(`properties refers to the validation and authorization properties that will
be required to generate the authorization and validation checkers on your
graphql-yoga server and your client side application.`)}
`

if (args.some(arg => ['--help', '-h'].includes(arg))) {
  console.log(help)
  process.exit(0)
}
if (args[0] !== "generate") {
  throw new Error("generate is the only command yet implemented")
}

const prismaPermPathsToCheck = [
  'prisma.perm.yml',
  'prisma.perm.yaml',
  'prisma-perm.yml',
  'prisma-perm.yaml',
  'prisma.permissions.yml',
  'prisma.permissions.yaml',
  'prisma-permissions.yml',
  'prisma-permissions.yaml',
  'prisma/prisma.perm.yml',
  'prisma/prisma-perm.yml',
  'prisma/prisma.perm.yaml',
  'prisma/prisma-perm.yaml',
  'prisma/prisma.permissions.yml',
  'prisma/prisma-permissions.yml',
  'prisma/prisma.permissions.yaml',
  'prisma/prisma-permissions.yaml',
]
const prismaPathsToCheck = [
  'prisma.yml',
  'prisma.yaml',
  'prisma/prisma.yml',
  'prisma/prisma.yaml',
]

;(async () => {
  const prismaConfig = await getConfig(prismaPathsToCheck)
  const prismaPermConfig = await getConfig(prismaPermPathsToCheck)
  const datamodel = await getDataModel(prismaConfig)
  const properties = await generate(datamodel)
  await Promise.all([
    await outputResults(prismaPermConfig.generate['graphql-directives'], crudDirectives + prismaDirectives),
    await outputResults(prismaPermConfig.generate['graphql-perm-directives'], crudDirectives),
    await outputResults(prismaPermConfig.generate['graphql-prisma-directives'], prismaDirectives),
    await outputResults(prismaPermConfig.generate['properties'], properties),
  ])


  console.log(chalk.green("\nSuccessfully generated prisma-perm\n"))
})()
  .catch(error => {
    console.error(error)
    console.error(error.stack)
  })

async function outputResults(paths, result) {
  if (!paths || (Array.isArray(paths) && !paths.length)) return
  paths = [].concat(paths)

  await Promise.all(paths.map(async outputPath => {
    const writePath = path.resolve(process.cwd(), outputPath)
    const dirName = path.dirname(writePath)
    await mkdirp(dirName)
    await fs.writeFile(writePath, result)
    console.log(chalk.cyan(`Generated ${outputPath}`))
  }))
}

async function getConfig(pathsToCheck) {
  const pathToConfig = await getPathToConfig(pathsToCheck)
  if (!pathToConfig) {
    throw new Error(`${chalk.red('Could not find '+chalk.yellow('prisma-perm config') + '. Config must match one of these file names')}` +
    `: \n${chalk.cyan(pathsToCheck.join('\n'))}`)

  }
  const buff = await fs.readFile(`${dir}/${pathToConfig}`)
  const configString = buff.toString()
  const config = yaml.safeLoad(configString)
  return config
}

async function getPathToConfig(pathsToCheck) {
  const paths = await Promise.all(pathsToCheck.map(path => (
    fs.pathExists(dir + '/' + path)
  )))
  const pathIndex = paths.findIndex(Boolean)
  const pathToConfig = pathsToCheck[pathIndex]
  return pathToConfig
}

async function getDataModel(prismaConfig) {
  const datamodelPaths = prismaConfig.datamodel
  const isInPrismaDir = /prisma\/prisma\.yma?l$/.test(await getPathToConfig(prismaPathsToCheck))
  const basename = isInPrismaDir ? path.resolve(process.cwd(), 'prisma') :  process.cwd()
  const buffs = await Promise.all(
    datamodelPaths.map(datamodelPath => fs.readFile(path.resolve(basename, datamodelPath)))
  )
  const datamodel = buffs
    .map(buff => buff.toString())
    .join('\n')

  return datamodel
}

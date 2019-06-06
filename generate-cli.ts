import fs from 'fs-extra'
import yaml from 'js-yaml'
import path from 'path'
import { generate } from './generate'
import mkdirp from 'mkdirp-promise'
import { crudDirectives, prismaDirectives } from './directives';

const dir = process.cwd()

const configError =
`
You must provide an input and output for the permissions configuration like this:

perm:
  generate:
    - generator: directives-graphql
      output:
      - ./client/src/generated/perm/directives.graphql
    - generator: properties
      output: ./client/src/generated/perm/properties.js
`

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
  const prismaConfig= await getConfig(prismaPathsToCheck)
  const prismaPermConfig = await getConfig(prismaPermPathsToCheck)
  const datamodel = await getDataModel(prismaConfig)
  const properties = generate(datamodel)
  await Promise.all([
    await outputResults(prismaPermConfig.generate['graphql-directives'], crudDirectives + prismaDirectives),
    await outputResults(prismaPermConfig.generate['graphql-perm-directives'], crudDirectives),
    await outputResults(prismaPermConfig.generate['graphql-prisma-directives'], prismaDirectives),
    await outputResults(prismaPermConfig.generate['properties'], properties),
  ])


  console.log("Successfully generated prisma-perm")
})()

  .catch(console.error)

async function outputResults(paths, result) {
  if (!paths || (Array.isArray(paths) && !paths.length)) return
  paths = [].concat(paths)

  await Promise.all(paths.map(async outputPath => {
    const writePath = path.resolve(process.cwd(), outputPath)
    const baseName = path.basename(writePath)
    await mkdirp(baseName)
    return fs.writeFile(writePath, result)
  }))
}

async function getConfig(pathsToCheck) {
  const pathToConfig = await getPathToConfig(pathsToCheck)
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
  const basename = isInPrismaDir ? process.cwd() : path.resolve(process.cwd(), 'prisma')
  const buffs = await Promise.all(
    datamodelPaths.map(datamodelPath => fs.readFile(path.resolve(basename, datamodelPath)))
  )
  const datamodel = buffs
    .map(buff => buff.toString())
    .join('\n')

  return datamodel
}

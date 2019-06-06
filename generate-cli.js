const fs = require('fs-extra')
const yaml = require('js-yaml')
const path = require('path')
const dir = process.cwd()
const tsOptions = fs.readJsonSync('./tsconfig.json')
console.log(tsOptions)
require('ts-node').register(Object.assign({}, tsOptions, {
  noImplicitAny: false,
}))
const generate = require('./generate.ts')

const configError =
`
You must provide an input and output for the permissions configuration like this:

perm:
  input: datamodel.graphql
  output:
    - ./server/generated
    - ./client/src/generated
`

const pathsToCheck = [
  'prisma.yml',
  'prisma.yaml',
  'prisma/prisma.yml',
  'prisma/prisma.yaml',
]
Promise.all(
  pathsToCheck.map(path => (
    fs.pathExists(dir + '/' + path)
  ))
).then(paths => {
  const pathIndex = paths.findIndex(Boolean)
  const path = pathsToCheck[pathIndex]
  return fs.readFile(path)
}).then(text => {
  text = text.toString()
  const config = yaml.safeLoad(text)
  const perm = config.perm || config.permissions
  if (!(perm.input && perm.output)) {
    throw new Error(configError)
  }
  const inputPath = path.resolve(dir, config.input)
  const ouputPaths = [].concat(perm.output).map(path => {
    return path.resolve(dir, path)
  })
})

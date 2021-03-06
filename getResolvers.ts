import _ from 'lodash'
import { getCheckers } from "./getCheckers";

const genericData = fnName => async (parent, args, context, info) => {
  return await context.prisma[fnName](args.data)
}
const generic = fnName => async (parent, args, context, info) => {
  return await context.prisma[fnName](args)
}
const genericWhere = fnName => async (parent, args, context, info) => {
  return await context.prisma[fnName](args.where)
}

type FieldResolver = (parent: any, args: any, context: any, info: any) => any

interface FieldResolvers {
  [key: string]: FieldResolver
}

export async function getResolvers(options) {
  const {properties, prisma} = options
  const checkers =  getCheckers(options)
  const resolvers = {
    Mutation: {},
    Query: {},
  }
  for (const typename in properties) {
    const checker = checkers[typename]
    const fnName = lowercaseFirstLetter(typename)
    checkApi(fnName, prisma)
    const resolver = genericWhere(fnName)
    const {_permCheckers} = checker
    resolvers.Query[fnName] = async (parent, args, context, info) => {
      const requestedFieldNames = getReadFieldNames(parent, args, context, info)
      const checkerFns = []
      checkerFns.push(_permCheckers._type.read)
      for (const fieldname of requestedFieldNames) {
        const checkerFn = _permCheckers._scalarFields.read[fieldname] || _.get(_permCheckers, '_resolvedFields[fieldname].read')
        if (checkerFn) checkerFns.push(checkerFn)
      }
      await Promise.all(checkerFns.map(async fn => {
        await fn(parent, args, context, info)
      }))

      return await resolver(parent, args, context, info)
    }

    resolvers[typename] = {}
    for (const fieldname in _permCheckers.resolverFields) {
      const resolver = async (parent, args, context, info) => {
        return await context.prisma[fnName]({id: parent.id})[fieldname]()
      }
      // const foreignTypeName = properties[typename][fieldname].type
      // const foreignChecker = checkers[foreignTypeName]
      resolvers[typename][fieldname] = async (parent, args, context, info) => {
        return await resolver(parent, args, context, info)
      //   const checkerFns = []
      //   const requestedFields = info.fieldASTs.map(field => field.name.value)
      //   for (const fieldname in requestedFields) {
      //     const checkerFn = foreignChecker._permCheckers._scalarFields[fieldname] || foreignChecker._permCheckers.resolverFields[fieldname]
      //     checkerFns.push(checkerFn.read)
      //   }

      //   Promise.all(checkerFns.map(async fn => await fn(parent, args, context, info)))
      //     .then(() => resolver(parent, args, context, info))
      }
    }

    const genericResolverMap = {
      create: genericData,
      update: generic,
      delete: genericWhere
    }

    ;['create', 'update', 'delete'].forEach(action => {
      const fnName = `${action}${typename}`
      const resolver = genericResolverMap[action](fnName)
      checkApi(fnName, prisma)
      const {checkScalars, checkResolved} = checker
      const promiseFns = []
      if (['create', 'update'].includes(action)) {
        promiseFns.push(checkScalars[action])
        promiseFns.push(checkResolved)
      }
      resolvers.Mutation[fnName] = async (...args) => {
        await _permCheckers._type[action](...args)
        await Promise.all(promiseFns.map(async fn => {
          await fn(...args)
        }))

        await resolver(...args)
      }
    })
  }
  return resolvers
}



function checkApi(name: string, prisma) {
  if (!prisma[name])
    throw new Error(`The function ${name} does not exist on prisma.`)
}

function lowercaseFirstLetter(word: string) {
  return word.charAt(0).toLowerCase() + word.slice(1)
}

function getReadFieldNames(parent, args, context, info) {
  const { operation } = info
  const { selectionSet } = operation
  const { selections:mainSelection } =  selectionSet
  if (mainSelection.length > 1) {
    throw new Error('You can only get one item at a time for now.')
  }
  const { selectionSet:fieldSelectionSet } = mainSelection[0]
  const { selections:fieldSelections } = fieldSelectionSet
  return fieldSelections.map(selection => selection.name.value)
}

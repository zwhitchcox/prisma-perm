import _ from 'lodash'
import { getCheckers } from "./getCheckers";
import { IFieldResult } from './generate-properties';

const genericData = fnName => async (parent, args, context, info) => {
  return await context.prisma[fnName](args.data)
}
const generic = fnName => async (parent, args, context, info) => {
  return await context.prisma[fnName](args)
}
const genericWhere = fnName => async (parent, args, context, info) => {
  return await context.prisma[fnName]()
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
      const checkerFns = []

      checkerFns.push(_permCheckers._type.read)

      // TODO recursive check ASTs
      const requestedFields = info.fieldASTs.map(field => field.name.value)
      for (const fieldname in requestedFields) {
        const checkerFn = _permCheckers._scalarFields[fieldname] || _permCheckers.resolverFields[fieldname]
        checkerFns.push(checkerFn.read)
      }

      Promise.all(checkerFns.map(async fn => await fn(parent, args, context, info)))
        .then(() => resolver(parent, args, context, info))
    }

    resolvers[typename] = {}
    for (const fieldname in _permCheckers.resolverFields) {
      const resolver = async (parent, args, context, info) => {
        return await context.prisma[fnName]({id: parent.id})[fieldname]()
      }
      const foreignTypeName = properties[typename][fieldname].type
      const foreignChecker = checkers[foreignTypeName]
      resolvers[typename][fieldname] = async (parent, args, context, info) => {
        const checkerFns = []
        const requestedFields = info.fieldASTs.map(field => field.name.value)
        for (const fieldname in requestedFields) {
          const checkerFn = foreignChecker._permCheckers._scalarFields[fieldname] || foreignChecker._permCheckers.resolverFields[fieldname]
          checkerFns.push(checkerFn.read)
        }

        Promise.all(checkerFns.map(async fn => await fn(parent, args, context, info)))
          .then(() => resolver(parent, args, context, info))
      }
    }

      if (typeResult._permCheckers._type[action]) {
        const checkerFns = [
          typeResult._permCheckers._type[action],
          typeResult._permCheckers._scalarFields[action],
          typeResult._checkResolvers[action],
        ]
        if (['update', 'create'].includes(action)) {
          checkerFns.push(typeResult._checkScalars[action])
        }



    if (crud.c) {
      const createChecker = typeChecker.c
      const action = "create"
      const fnName = `${action}${typeName}`
      const resolver = genericData(fnName)
      const scalarFieldChecker = getScalarFieldChecker(action, typeName, checkers)
      checkApi(fnName, prisma)
      resolvers.Mutation[fnName] = async (parent, args, context, info) => {
        if (await createChecker(parent, args, context, info)) {
          for (const fieldName in createFieldCheckers) {
            const fieldChecker = createFieldCheckers[fieldName]
            if (!(await fieldChecker(parent, args, context, info))) {
              throw new Error("You do not have permission to do that")
            }
          }
          for (const fieldName in resolverFieldCheckers) {
            const resolvedFieldChecker = resolverFieldCheckers[fieldName]
            if (!(await checkResolvedField(parent, args, context, info, resolvedFieldChecker, checkers, fieldName))) -f
          }


          return await resolver(parent, args, context, info)
        }
      }
    }
    if (crud.u) {
      const updateChecker = typeChecker.u
      const action = "update"
      const fnName = `${action}${typeName}`
      const resolver = generic(fnName)
      const updateFieldCheckers = scalarFieldCheckers.u
      checkApi(fnName, prisma)
      resolvers.Mutation[fnName] = async (parent, args, context, info) => {
        if (await updateChecker(parent, args, context, info)) {
          for (const fieldName in updateFieldCheckers) {
            const fieldChecker = updateFieldCheckers[fieldName]
            if (!(await fieldChecker(parent, args, context, info))) {
              throw new Error(`You do not have permission to ${action} ${typeName}.${fieldName}`)
            }
          }
          return await resolver(parent, args, context, info)
        }

        throw new Error(`You do not have permission to do update ${typeName}`)
      }
    }

    if (crud.d) {
      const deleteChecker = typeChecker.u
      const action = "delete"
      const fnName = `${action}${typeName}`
      const resolver = genericWhere(fnName)
      const deleteFieldCheckers = scalarFieldCheckers.d
      checkApi(fnName, prisma)
      resolvers.Mutation[fnName] = async (parent, args, context, info) => {
        if (await deleteChecker(parent, args, context, info)) {
          for (const fieldName in deleteFieldCheckers) {
            const fieldChecker = deleteFieldCheckers[fieldName]
            if (!(await fieldChecker(parent, args, context, info))) {
              throw new Error("You do not have permission to do that")
            }
          }
          return await resolver(parent, args, context, info)
        }
      }
    }
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

async function checkResolvedField(parent, args, context, info, resolvedFieldChecker, checkers, fieldName) {
  if (args[fieldName].create || args[fieldName].connect || args.fieldName.disconnect || args.fieldName.set) {
    if (!await resolvedFieldChecker(parent, args, context, info))
      throw new Error('You do not have permission to do that')

  }
}

async function getScalarFieldChecker(action, typeName, checkers) {

}

async function checkScalarFields(parent, args, context, info, typeName, checkers) {

          for (const fieldName in updateFieldCheckers) {
            const fieldChecker = updateFieldCheckers[fieldName]
            if (!(await fieldChecker(parent, args, context, info))) {
              throw new Error(`You do not have permission to ${action} ${typeName}.${fieldName}`)
            }
          }
          await checkScalarFields(parent, args, context, info, checkers, typeName, action)
}
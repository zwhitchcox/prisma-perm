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

export async function getResolvers(properties, prisma, roleCheckers, checkPriv) {
  const checkers =  getCheckers(properties, roleCheckers, checkPriv)
  const resolvers = {
    Mutation: {},
    Query: {},
  }
  for (const typeName in properties) {
    const typeChecker = checkers[typeName]
    const fieldCheckers = typeChecker.fields
    const crud = (_.get(properties,`${typeName}.crud`) || {})
    if (crud.r) {
      const fnName = lowercaseFirstLetter(typeName)
      checkApi(fnName, prisma)
      const readChecker = typeChecker.r
      const resolver = genericWhere(fnName)
      resolvers.Query[fnName] = async (parent, args, context, info) => {
        if (await readChecker(...args)) {
          const allResult = await resolver(parent, args, context, info)
          const requestedFields = info.fieldASTs.map(field => field.name.value)
          const allowedResult = {}
          await Promise.all(requestedFields.map(async (result, fieldName) => {
              const fieldChecker = typeChecker[fieldName].r
              if (await fieldChecker(parent, args, context, info))
                allowedResult[fieldName] = allResult[fieldName]
          }))
          return allowedResult
        }
      }
      resolvers[typeName] = Object.entries(properties[typeName].fields)
        .reduce((result: FieldResolvers, [fieldName, field]: [string, IFieldResult]): FieldResolvers => {
          const fieldChecker =  typeChecker.fields.r[fieldName]
          const defaultResolver = async (parent, args, context, info) => {
            return await context.prisma[fnName]({id: parent.id})[fieldName]()
          }
          if (fieldChecker) {
            if (field.resolve) {
              let resolverWithFieldChecker
              const fieldChecker = typeChecker.r[fieldName]
              if (fieldChecker) {
                resolverWithFieldChecker = async (parent, args, context, info) => {
                  if (await fieldChecker(parent, args, context, info))
                    return await defaultResolver(parent, args, context, info)
                }
              }
              result[fieldName] = resolverWithFieldChecker || defaultResolver
            }
          }
        return result
      }, <FieldResolvers>{})
    }

    if (crud.c) {
      const createChecker = typeChecker.c
      const action = "create"
      const fnName = `${action}${typeName}`
      const resolver = genericData(fnName)
      const createFieldCheckers = fieldCheckers.c
      checkApi(fnName, prisma)
      resolvers.Mutation[fnName] = async (parent, args, context, info) => {
        if (await createChecker(parent, args, context, info)) {
          for (const fieldName in createFieldCheckers) {
            const fieldChecker = createFieldCheckers[fieldName]
            if (!(await fieldChecker(parent, args, context, info))) {
              throw new Error("You do not have permission to do that")
            }
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
      const updateFieldCheckers = fieldCheckers.u
      checkApi(fnName, prisma)
      resolvers.Mutation[fnName] = async (parent, args, context, info) => {
        if (await updateChecker(parent, args, context, info)) {
          for (const fieldName in updateFieldCheckers) {
            const fieldChecker = updateFieldCheckers[fieldName]
            if (!(await fieldChecker(parent, args, context, info))) {
              throw new Error("You do not have permission to do that")
            }
          }
          return await resolver(parent, args, context, info)
        }
      }
    }

    if (crud.d) {
      const deleteChecker = typeChecker.u
      const action = "delete"
      const fnName = `${action}${typeName}`
      const resolver = genericWhere(fnName)
      const updateFieldCheckers = fieldCheckers.d
      checkApi(fnName, prisma)
      resolvers.Mutation[fnName] = async (parent, args, context, info) => {
        if (await deleteChecker(parent, args, context, info)) {
          for (const fieldName in fieldCheckers) {
            const fieldChecker = updateFieldCheckers[fieldName]
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
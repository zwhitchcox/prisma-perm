import _ from 'lodash'
import { createValidators } from './createValidators';
import { check } from 'prettier';

export function getCheckers(options) {
  const properties = options.properties
  if (!properties) {
    throw new Error('Please pass a properties object, see docs for more info.')
  }
  const validators = createValidators(properties)

  const checkers = Object
    .keys(properties)
    .reduce((mainResult, typename: string) => {
      const typeResult:any = mainResult[typename] = {}

      typeResult._validationCheckers = getValidationCheckers(validators, typename)
      typeResult._permCheckers = {
        _type: getTypePermCheckers(options, properties, typename),
        _scalarFields: getScalarPermCheckers(options, properties, typename),
        _resolverFields: getResolvePermCheckers(options, properties, typename),
      }
      typeResult._checkScalars = getCheckScalars(typeResult) // check validation and scalar permissions
      return mainResult
    }, {})

    for (const typename in checkers) {
      const typeResult = checkers[typename]
      typeResult._checkResolvers = getCheckResolvers(checkers, properties, typename)
      typeResult.checkType = getCheckType(mainResult, typeResult, properties)
    }
  return checkers
}

function getTypePermCheckers(options, properties, typename) {
  return ['create', 'read', 'update', 'delete'].reduce((result, action) => {
    const errMessage = `You do not have permission to ${action} ${typename}`
    const auth = (_.get(properties,`${typename}.crud.${action.charAt(0)}`))
    if (!auth) {
      return () => {
        throw new Error(errMessage)
      }
    }
    result[action] = getPermChecker(options, auth, errMessage)
  }, {})
}

function getScalarPermCheckers(options, properties, typename) {
  ['update', 'read'].reduce((result, action) => {
    const actionResult = {}
    for (const fieldname in properties[typename]) {
      const crudProperties = (_.get(properties,`${typename}.${fieldname}.crud`))
      const auth = crudProperties[action.charAt(0)]
      if (!auth || crudProperties.resolve) continue
      const errMessage = `You do not have permission to ${action} ${typename}.${fieldname}`
      actionResult[fieldname] = getPermChecker(options, auth, errMessage)
    }

    result[action] = actionResult
    return result
  })
}

function getResolvePermCheckers(options, properties, typename) {
  const resolvePermCheckers = {}
  for (const fieldname in properties[typename]) {
    const crudProperties = (_.get(properties,`${typename}.${fieldname}.crud`))
    if (!crudProperties || !crudProperties.resolve) continue
    const fieldPermCheckers = ['create', 'read', 'update', 'delete'].reduce((result, action) => {
      const errMessage = `You do not have permission to ${action} ${typename}.${fieldname}`
      const auth = crudProperties[action.charAt(0)]
      if (!auth) {
        result[action] = () => {
          throw new Error(errMessage)
        }
      }
      result[action] = getPermChecker(options, auth, errMessage)
      return result
    }, {})
    resolvePermCheckers[fieldname] = fieldPermCheckers
  }
  return resolvePermCheckers
}

function getPermChecker(options, auth, errMessage) {
  const permissionsCheckers = []
  if (auth.priv) {
    const privChecker = getPrivChecker(auth.priv, options.checkPriv)
    permissionsCheckers.push(privChecker)
  }
  if (auth.role) {
    const roleChecker = getRoleChecker(auth.role, options.roleCheckers)
    permissionsCheckers.push(roleChecker)
  }
  // if (auth.func) {
  //   checker = withFuncChecker(auth.func, checker, action, resource)
  // }
  return async (...args) {
    const allowed = await Promise.all(permissionsCheckers.map(checker => checker(...args)))
    if(allowed.some(Boolean)) {
      throw new Error(errMessage)
    }
  }
}


function getPrivChecker(privs, checkPriv) {
  return async (...args) => {
    const allowed = await Promise.all(privs.map(async priv => {
      return await checkPriv(...args)
    }))
    return allowed.some(Boolean)
  }
}

function getRoleChecker(roles, roleCheckers) {
  roles.forEach(role => {
    if (!roleCheckers[role]) {
      throw new Error("Could not find that role")
    }
  })
  return async (...args) => {
    const allowed = await Promise.all(roles.map(async role => {
      return await roleCheckers[role](...args)
    }))
    return allowed.some(Boolean)
  }
}

function getValidationCheckers(validators, typeName) {
  return ['create', 'update',].reduce((result, action) => {
    result[action] = getValidationChecker(validators, typeName, action)
    return result
  }, {})
}
function getValidationChecker(validators, typeName, action) {
  const { validation } = validators[typeName]
  if (!validation) {
    return
  }
  const isUpdate = action === "update"
  return (parent, args, context, info) => {
    for (const key in validation) {
      const validator = validation[key]
      const data = args.data || args
      const datum = data[key]
      if (!datum)
        continue
      const errors = validator(datum, isUpdate)
      if (errors.length) {
        throw new Error(`There were errors trying to ${action} ${typeName} errors.join('\n'))`
      }
    }
  }
}

function getCheckScalars({_permCheckers, _validationCheckers}) {
  return ['update', 'create'].reduce((result, action) => {
    result[action] = async (...args) => {
      const promises = []
      const {_scalarFields} = _permCheckers
      for (const fieldname in _validationCheckers) {
        _validationCheckers[action][fieldname](...args)
      }
      for (const fieldname in _scalarFields) {
        const checkPromise = _scalarFields[fieldname][action](...args)
        promises.push(checkPromise)
      }
      return Promise.all(promises)
  }
    return result
  }, {})
}

function getCheckResolvers(mainResult, properties, typename) {
  const typeResult = mainResult[typename]
  const resolverFieldCheckers: any = {}
  const resolverFieldPermCheckers = typeResult._permCheckers_resolverFields
  for (const fieldname in resolverFieldPermCheckers) {
    const foreignTypeName = properties[typename][fieldname].type
    const foreignResult = mainResult[foreignTypeName]
    const checkForeignScalars = foreignResult._permCheckers._checkScalars
    resolverFieldCheckers[fieldname] = async (parent, args, context, info) => {
      for (const fieldName in resolverFieldCheckers) {
        if (!args[fieldName]) continue
        const fieldArg = args[fieldName]
        const { create } = fieldArg
        if (create) {
          if (!resolverFieldPermCheckers[fieldName].create) {
            return false
          }
          return (await Promise.all(
              [
                await resolverFieldPermCheckers.create(parent, args, context, info),
                await checkForeignScalars.create(parent, create, context, info),
                await mainResult[foreignTypeName]._checkResolvers(args, create, context, info),
              ])
            ).filter(Boolean).length === 2

        }
        const { connect } = fieldArg
        if (connect) {
          if (!resolverFieldPermCheckers.update) {
            return false
          }
          return await resolverFieldPermCheckers.update(parent, args, context, info)
        }
        const { disconnect } = fieldArg
        if (disconnect) {
          if (!resolverFieldPermCheckers.delete) {
            return false
          }
          return await resolverFieldPermCheckers.delete(parent, args, context, info)
        }
        const { set } = fieldArg
        if (set) {
          if (!(resolverFieldPermCheckers.update  && resolverFieldPermCheckers.delete)) {
            return false
          }
          return (await Promise.all(
            [await resolverFieldPermCheckers.update(parent, args, context, info),
            await resolverFieldPermCheckers.update(parent, args, context, info)])).filter(Boolean).length === 2
        }
        throw new Error('Couldn\'t find that action.')
      }
    }
  }
  return resolverFieldCheckers
}
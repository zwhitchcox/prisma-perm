import _ from 'lodash'
import { createValidators } from './createValidators';


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
        _resolvedFields: getResolvedPermCheckers(options, properties, typename),
      }
      typeResult.checkScalars = getCheckScalars(typeResult) // check validation and scalar permissions
      return mainResult
    }, {})

    for (const typename in checkers) {
      const typeResult = checkers[typename]
      typeResult._resolvedFieldCheckers = getResolvedFieldCheckers(checkers, properties, typename)
      typeResult.checkResolved = getCheckResolvedFields(checkers, properties, typename)
    }
  return checkers
}

function getCheckResolvedFields(checkers, properties, typename) {
  const { _resolvedFieldCheckers } = checkers[typename]
  const keys = Object.keys(_resolvedFieldCheckers)
  return async function checkResolvedFields(parent, args, context, info) {
    return Promise.all(keys.map(async fieldname => {
      if (!(fieldname in args.data)) return Promise.resolve()
      await _resolvedFieldCheckers(parent, args, context, info)
    }))
  }
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
    return result
  }, {})
}

function getScalarPermCheckers(options, properties, typename) {
  return ['update', 'read'].reduce((result, action) => {
    const actionResult = {}
    for (const fieldname in properties[typename].fields) {
      const crudProperties = _.get(properties,`${typename}.fields.${fieldname}.crud`)
      const auth = (crudProperties || {})[action.charAt(0)]
      if (!auth || crudProperties.resolve) continue
      const errMessage = `You do not have permission to ${action} ${typename}.${fieldname}`
      actionResult[fieldname] = getPermChecker(options, auth, errMessage)
    }

    result[action] = actionResult
    return result
  }, {})
}

function getResolvedPermCheckers(options, properties, typename) {
  const resolvePermCheckers = {}
  for (const fieldname in properties[typename].fields) {
    const fieldProperties = _.get(properties,`${typename}.fields.${fieldname}`)
    const crudProperties = fieldProperties.crud
    if (!crudProperties || !fieldProperties.resolve) continue
    const fieldPermCheckers = ['create', 'read', 'update', 'delete'].reduce((result, action) => {
      const errMessage = `You do not have permission to ${action} ${typename}.${fieldname}`
      const auth = crudProperties[action.charAt(0)]
      if (!auth) {
        result[action] = function resolveError() {
          throw new Error(errMessage)
        }
        result[action].message = errMessage
        return result
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
  return async function permChecker(parent, args, context, info) {
    const allowed = await Promise.all(
      permissionsCheckers.map(async checker => {
        return await checker(parent, args, context, info)
    }))

    if (!allowed.some(Boolean)) {
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
    const validation = validators[typeName]
    if (!validation) {
      return
    }
    const isUpdate = action === "update"
    result[action] = function validate(parent, args, context, info) {
      for (const key in validation) {
        const validator = validation[key]
        const datum = args.data[key]
        if (!datum)
          continue
        const errors = validator(datum, isUpdate)
        if (errors.length) {
          throw new Error(`There were errors trying to ${action} ${typeName} errors.join('\n'))`)
        }
      }
    }
    return result
  }, {})
}

function getCheckScalars({_permCheckers, _validationCheckers}) {
  const {_scalarFields} = _permCheckers
  return ['update', 'create'].reduce((result, action) => {
    result[action] = async function checkScalars(...args) {
      const promises = []
      _validationCheckers[action](...args)
      for (const fieldname in _scalarFields[action]) {
        const checkPromise = _scalarFields[action][fieldname](...args)
        promises.push(checkPromise)
      }
      return Promise.all(promises)
    }
    return result
  }, {})
}

function getResolvedFieldCheckers(mainResult, properties, typename) {
  const typeResult = mainResult[typename]
  const resolvedFieldCheckers: any = {}
  const resolvedFieldPermCheckers = typeResult._permCheckers._resolverFields
  for (const fieldname in resolvedFieldPermCheckers) {
    const foreignTypeName = properties[typename].fields[fieldname].type
    const foreignResult = mainResult[foreignTypeName]
    const checkForeignScalars = foreignResult._checkScalars
    resolvedFieldCheckers[fieldname] = async (parent, args, context, info) => {
      const fieldArg = args[fieldname]
      const { create } = fieldArg
      if (create) {
        return (await Promise.all(
            [
              await resolvedFieldPermCheckers.create(parent, args, context, info),
              await checkForeignScalars.create(parent, create, context, info),
              await mainResult[foreignTypeName]._checkResolved(parent, create, context, info), // TODO, probably a bug
            ])
          ).filter(Boolean).length === 2

      }
      const { connect } = fieldArg
      if (connect) {
        if (!resolvedFieldPermCheckers.update) {
          return false
        }
        return await resolvedFieldPermCheckers.update(parent, args, context, info)
      }
      const { disconnect } = fieldArg
      if (disconnect) {
        if (!resolvedFieldPermCheckers.delete) {
          return false
        }
        return await resolvedFieldPermCheckers.delete(parent, args, context, info)
      }
      const { set } = fieldArg
      if (set) {
        if (!(resolvedFieldPermCheckers.update  && resolvedFieldPermCheckers.delete)) {
          return false
        }
        return (await Promise.all(
          [await resolvedFieldPermCheckers.update(parent, args, context, info),
          await resolvedFieldPermCheckers.update(parent, args, context, info)])).filter(Boolean).length === 2
      }
      throw new Error('Couldn\'t find that action.')
    }
  }
  return resolvedFieldCheckers
}
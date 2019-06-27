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
        _type: getTypeRoleCheckers(options, properties, typename),
        _scalarFields: getScalarRoleCheckers(options, properties, typename),
        _resolvedFields: getResolvedRoleCheckers(options, properties, typename),
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
      let data
      if (typeof parent === "string") {
        data = _.get(args.data, parent)
      } else {
        data = args.data
      }
      if (!(fieldname in data)) return Promise.resolve()
      await _resolvedFieldCheckers[fieldname](parent, args, context, info)
    }))
  }
}

function getTypeRoleCheckers(options, properties, typename) {
  return ['create', 'read', 'update', 'delete'].reduce((result, action) => {
    const errMessage = `You do not have permission to ${action} ${typename}`
    const auth = (_.get(properties,`${typename}.crud.${action}`))
    if (!auth) {
      result[action] = () => {
        throw new Error(errMessage)
      }
      return result
    }
    result[action] = getRoleChecker(options, auth, errMessage)
    return result
  }, {})
}

function getScalarRoleCheckers(options, properties, typename) {
  return ['update', 'read'].reduce((result, action) => {
    const actionResult = {}
    for (const fieldname in properties[typename].fields) {
      const auth = _.get(properties,`${typename}.fields.${fieldname}`)
      const crud = (auth.crud || {})[action]
      if (!crud || auth.resolve) continue
      const errMessage = `You do not have permission to ${action} ${typename}.${fieldname}`
      actionResult[fieldname] = getRoleChecker(options, auth, errMessage)
    }

    result[action] = actionResult
    return result
  }, {})
}

function getResolvedRoleCheckers(options, properties, typename) {
  const resolveRoleCheckers = {}
  for (const fieldname in properties[typename].fields) {
    const fieldProperties = _.get(properties,`${typename}.fields.${fieldname}`)
    const crudioProperties = fieldProperties.crudio
    if (!crudioProperties || !fieldProperties.resolve) continue
    const fieldRoleCheckers = ['create', 'read', 'update', 'delete', 'disconnect', 'connect'].reduce((result, action) => {
      const errMessage = `You do not have permission to ${action} ${typename}.${fieldname}`
      const auth = crudioProperties[action]
      if (!auth) {
        result[action] = function resolveError() {
          throw new Error(errMessage)
        }
        result[action].message = errMessage
        return result
      }
      result[action] = getRoleChecker(options, auth, errMessage)
      return result
    }, {})
    resolveRoleCheckers[fieldname] = fieldRoleCheckers
  }
  return resolveRoleCheckers
}

function getRoleChecker(options, checkConstants, errMessage) {
  checkConstants.forEach(checkConstant => {
    if (!options.roleCheckers[checkConstant]) {
      throw new Error(`Could not find the role ${checkConstant}.`)
    }
  })
  return async function roleChecker(...args) {
    const allowed = await Promise.all(checkConstants.map(async role => {
      return await options.roleCheckers[role](...args)
    }))
    if (!allowed.some(Boolean)) {
      throw new Error(errMessage)
    }
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
        const datum = (args.data || args)[key]
        if (!datum)
          continue
        const errors = validator(datum, isUpdate)
        if (errors.length) {
          throw new Error(`There were errors trying to ${action} ${typeName} ${errors.join('\n')}`)
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
  const resolvedFieldPermCheckers = typeResult._permCheckers._resolvedFields
  for (const fieldname in resolvedFieldPermCheckers) {
    const foreignTypeName = properties[typename].fields[fieldname].type
    const foreignResult = mainResult[foreignTypeName]
    const checkForeignScalars = foreignResult.checkScalars
    resolvedFieldCheckers[fieldname] = async (parent, args, context, info) => {
      let data
      if (typeof parent === "string") {
        data = _.get(args.data, parent)
      } else {
        data = args.data
      }
      const fieldArgs = [].concat(data[fieldname] || data)
      for (let i = 0; i < fieldArgs.length; i++) {
        const fieldArg = fieldArgs[i]
        const { create } = fieldArg
        if (create) {
          const combinedParentName = `${parent ? (parent + ".") : ""}${fieldname}.create`
          for (let i = 0; i < create.length; i++) {
            let withNum = `${combinedParentName}.${i}`
            if (!(await Promise.all(
                [
                  await resolvedFieldPermCheckers[fieldname].create(withNum, args, context, info),
                  await checkForeignScalars.create(withNum, args, context, info),
                  await mainResult[foreignTypeName]
                    .checkResolved(withNum, args, context, info),
                ])
              ).every(Boolean)) return false
          }
          return true
        }
        const { update } = fieldArg
        if (update) {
          const combinedParentName = `${parent ? (parent + ".") : ""}${fieldname}.update`
          if (Array.isArray(update)) {
            for (let i = 0; i < update.length; i++) {
              const withNum = `${combinedParentName}.${i}`
              if (!(await Promise.all(
                  [
                    await resolvedFieldPermCheckers[fieldname].update(withNum, args, context, info),
                    await checkForeignScalars.update(withNum, args, context, info),
                    await mainResult[foreignTypeName]
                      .checkResolved(withNum, args, context, info),
                  ])
                ).every(Boolean)) return false
            }
            return true
          }
          return (await Promise.all(
              [
                await resolvedFieldPermCheckers[fieldname].update(combinedParentName, args, context, info),
                await checkForeignScalars.update(combinedParentName, update, context, info),
                await mainResult[foreignTypeName]
                  .checkResolved(combinedParentName, args, context, info),
              ])
            ).every(Boolean)
        }
        const { delete:mydel } = fieldArg
        if (mydel) {
          const combinedParentName = `${parent ? (parent + ".") : ""}${fieldname}.delete`
          return await resolvedFieldPermCheckers[fieldname].delete(combinedParentName, args, context, info)
        }

        const { connect } = fieldArg
        if (connect) {
          if (!resolvedFieldPermCheckers[fieldname].connect) {
            return false
          }
          return await resolvedFieldPermCheckers[fieldname].connect(parent, args, context, info)
        }

        const { disconnect } = fieldArg
        if (disconnect) {
          if (!resolvedFieldPermCheckers[fieldname].disconnect) {
            return false
          }
          return await resolvedFieldPermCheckers[fieldname].disconnect(parent, args, context, info)
        }
        const { set } = fieldArg
        if (set) {
          if (!(resolvedFieldPermCheckers[fieldname].connect  && resolvedFieldPermCheckers[fieldname].disconnect)) {
            return false
          }
          return (await Promise.all(
            [await resolvedFieldPermCheckers[fieldname].connect(parent, args, context, info),
            await resolvedFieldPermCheckers[fieldname].disconnect(parent, args, context, info)])
          ).every(Boolean)
        }
        throw new Error('Couldn\'t find that action.')
      }
    }
  }
  return resolvedFieldCheckers
}
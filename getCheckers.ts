import _ from 'lodash'
import { createValidators } from './createValidators';

export function getCheckers(options) {
  const properties = options.properties
  if (!properties) {
    throw new Error('Please pass a properties object, see docs for more info.')
  }
  const validators = createValidators(properties)
  const checkers = {}

  Object
    .keys(properties)
    .reduce((result, typeName: string) => {
      result[typeName]._validationCheckers = getValidationCheckers(validators, typeName)
      result[typeName]._typeCheckers = getTypeCheckers(options, properties, typeName)
      return result
    }, {})

  //     const crud = (_.get(properties,`${typeName}.crud`) || {})
  //     const typeChecker:any = {}

  //     if (crud.c) {
  //       const action = "create"
  //       const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
  //       typeChecker.c = getChecker(checkers, typeName, action, validators, properties, auth, 'type', null, roleCheckers, checkPriv)
  //     }
  //     if (crud.r) {
  //       const action = "read"
  //       const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
  //       typeChecker.r = getChecker(checkers, typeName, action, validators, properties, auth, 'type', null, roleCheckers, checkPriv)
  //     }
  //     if (crud.u) {
  //       const action = "update"
  //       const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
  //       typeChecker.u = getChecker(checkers, typeName, action, validators, properties, auth, 'type', null, roleCheckers, checkPriv)
  //     }
  //     if (crud.d) {
  //       const action = "delete"
  //       const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
  //       typeChecker.d = getChecker(checkers, typeName, action, validators, properties, auth, 'type', null, roleCheckers, checkPriv)
  //     }
  //     if (!Object.keys(typeChecker).length) {
  //       return result
  //     }

  //     result[typeName] = typeChecker

  //     result[typeName].scalarFields = Object.entries(properties[typeName].fields)
  //       .reduce((result, [fieldName, field]: [string, any]) => {
  //         if (field.resolve) return result
  //         const cAuth = _.get(field, 'crud.c')
  //         if (cAuth) {
  //           result[fieldName].c = getChecker(checkers, typeName, 'create', null, properties, cAuth, 'field', fieldName, roleCheckers, checkPriv)
  //         }
  //         const rAuth =_.get(field, 'crud.r')
  //         if (rAuth) {
  //           result[fieldName].r = getChecker(checkers, typeName, 'read', null, properties, rAuth, 'field', fieldName, roleCheckers, checkPriv)
  //         }
  //         const uAuth = _.get(field, 'crud.u')
  //         if (uAuth) {
  //           result[fieldName].u = getChecker(checkers, typeName, 'update', null, properties, uAuth, 'field', fieldName, roleCheckers, checkPriv)
  //         }
  //         const dAuth = _.get(field, 'crud.d')
  //         if (dAuth) {
  //           result[fieldName].d = getChecker(checkers, typeName, 'delete', null, properties, dAuth, 'field', fieldName, roleCheckers, checkPriv)
  //         }
  //         return result
  //       }, {
  //         c: {},
  //         r: {},
  //         u: {},
  //         d: {},
  //       })

  //     result[typeName].resolverFields = Object.entries(properties[typeName].fields)
  //       .reduce((result, [fieldName, field]: [string, any]) => {
  //         if (!field.resolve) return result
  //         const resolveFields:any = {}
  //         const cAuth = _.get(field, 'crud.c')
  //         if (cAuth) {
  //           resolveFields.c = getChecker(checkers, typeName, 'create', null, properties, cAuth, 'field', fieldName, roleCheckers, checkPriv)
  //         }
  //         const rAuth =_.get(field, 'crud.r')
  //         if (rAuth) {
  //           resolveFields.r = getChecker(checkers, typeName, 'read', null, properties, rAuth, 'field', fieldName, roleCheckers, checkPriv)
  //         }
  //         const uAuth = _.get(field, 'crud.u')
  //         if (uAuth) {
  //           resolveFields.u = getChecker(checkers, typeName, 'update', null, properties, uAuth, 'field', fieldName, roleCheckers, checkPriv)
  //         }
  //         const dAuth = _.get(field, 'crud.d')
  //         if (dAuth) {
  //           resolveFields.d = getChecker(checkers, typeName, 'delete', null, properties, dAuth, 'field', fieldName, roleCheckers, checkPriv)
  //         }
  //         if (Object.keys(resolveFields.length)) {
  //           result[fieldName].resolveFields = resolveFields
  //         }
  //         return result
  //       }, {})
  //     return result
  //   }, checkers)

  // Object.entries(checkers).forEach(([typeName, typeChecker]: [string, any]) => {
  //   typeChecker.scalarFieldChecker.u = getScalarFieldChecker(typeName, properties, checkers, 'update')
  //   typeChecker.scalarFieldChecker.c = getScalarFieldChecker(typeName, properties, checkers, 'create')
  //   typeChecker.resolveFieldCheckers = getResolveFieldCheckers(typeName, properties, checkers)
  // }, {})
  return checkers
}

function getTypeCheckers(options, properties, typeName) {
  return ['create', 'read', 'update', 'delete'].reduce((result, action) => {
    result[action] = getTypeChecker(options, properties, typeName, action)
    return result
  }, {})
}
function getTypeChecker(options, properties, validators, typeName) {
  const checkerPromises = []
  const crudProperties = (_.get(properties,`${typeName}.crud`) || {})
  const cProperties = crudProperties.c
  if (!cProperties) {
    return () => {
      throw new Error("That function is forbidden")
    }
  }
  const action = "create"
  const validationChecker = getValidationChecker(validators, typeName, action)
  if (validationChecker) checkerPromises.push(validationChecker)
  const permissionsChecker = getPermissionsChecker(options, properties, typeName, action)
  if (permissionsChecker) checkerPromises.push(permissionsChecker)
}

// function getChecker(checkers, typeName, action, validators, properties, auth, resource, fieldName, roleCheckers, checkPriv) {
//   let checker = () => false
//   checker = withAuthChecker(checkers, checker, typeName, action, properties, auth, resource, fieldName, roleCheckers, checkPriv)
//   checker =  withValidationChecker(checker, typeName, action, validators, resource)
//   return checker
// }

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
        return [false, new Error(`There were errors on ${typeName} errors.join('\n'))`]
      }
    }
  }
}

function getPermissionsChecker(properties, typeName, action, options) {
  const permissionsCheckers = []
  const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
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
      throw new Error(`You do not have permission to ${action} ${typeName}`)
    }
  }
}


// function withAuthChecker(checkers, checker, typeName, action, properties, auth, resource, fieldName, roleCheckers, checkPriv) {
//   if (auth.priv) {
//     checker = withPrivChecker(auth.priv, checker, action, checkPriv, resource)
//   }
//   if (auth.role) {
//     checker = withRoleChecker(auth.role, checker, roleCheckers, resource)
//   }
//   if (auth.func) {
//     checker = withFuncChecker(auth.func, checker, action, resource)
//   }
//   return checker
// }


// function withFuncChecker(func, checker, action, resource) {
//   return async (...args) => {
//     for (let i = 0; i < func.length; i++) {
//       if (await func(...args))
//         return true
//     }
//     return await checker(...args)
//   }
// }

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

function getScalarFieldChecker(typeName, properties, checkers, action) {
  let scalarFieldCheckers;
  if (action === "update") {
    scalarFieldCheckers = checkers[typeName].scalarFields.u
  } else if (action === "create") {
    scalarFieldCheckers = checkers[typeName].scalarFields.c
  }
  return async (parent, args, context, info) => {
    for (const fieldName in scalarFieldCheckers) {
      const fieldChecker = scalarFieldCheckers[fieldName]
      fieldChecker(args[fieldName])
    }
  }
}

function getResolveFieldCheckers(typeName, properties, checkers) {
  const resolveFieldCheckers: any = {}
  const resolveFields = checkers[typeName].resolveFields
  for (const fieldName in resolveFields) {
    const resolveFieldShallow = resolveFields[fieldName]
    const foreignTypeName = properties[typeName][fieldName].type
    const {scalarFieldCheckers} = checkers[foreignTypeName]
    resolveFieldCheckers[fieldName] = async (parent, args, context, info) => {
      for (const fieldName in resolveFieldCheckers) {
        if (!args[fieldName]) continue
        const fieldArg = args[fieldName]
        const { create } = fieldArg
        if (create) {
          if (!resolveFieldCheckers[fieldName].c) {
            return false
          }
          return (await Promise.all(
              [
                await resolveFieldShallow.c(args, create, context, info),
                await resolveFieldCheckers[fieldName](args, create, context, info),
                await scalarFieldCheckers(parent, args, context, info),
              ])
            ).filter(Boolean).length === 2

        }
        const { connect } = fieldArg
        if (connect) {
          if (!resolveFieldShallow.u) {
            return false
          }
          return await resolveFieldShallow.u(parent, args, context, info)
        }
        const { disconnect } = fieldArg
        if (disconnect) {
          if (!resolveFieldShallow.d) {
            return false
          }
          return await resolveFieldShallow.d(parent, args, context, info)
        }
        const { set } = fieldArg
        if (set) {
          if (!resolveFieldShallow.u || !resolveFieldShallow.d) {
            return false
          }
          return (await Promise.all(
            [await resolveFieldShallow.u(parent, args, context, info),
            await resolveFieldShallow.d(parent, args, context, info)])).filter(Boolean).length === 2
        }
        throw new Error('Couldn\'t find that action.')
      }
    }
  }
  return resolveFieldCheckers
}
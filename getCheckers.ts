import _ from 'lodash'
import { createValidators } from './createValidators';

export function getCheckers(properties, roleCheckers, checkPriv) {
  const validators = createValidators(properties)
  const checkers = {}

  Object
    .keys(properties)
    .reduce((result, typeName: string) => {
      const crud = (_.get(properties,`${typeName}.crud`) || {})
      result[typeName] = {}

      if (crud.c) {
        const action = "create"
        const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
       result[typeName].c = getChecker(checkers, typeName, action, validators, properties, auth, 'type', null, roleCheckers, checkPriv)
      }
      if (crud.r) {
        const action = "read"
        const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
        result[typeName].r = getChecker(checkers, typeName, action, validators, properties, auth, 'type', null, roleCheckers, checkPriv)
      }
      if (crud.u) {
        const action = "update"
        const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
        result[typeName].u = getChecker(checkers, typeName, action, validators, properties, auth, 'type', null, roleCheckers, checkPriv)
      }
      if (crud.d) {
        const action = "delete"
        const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
        result[typeName].d = getChecker(checkers, typeName, action, validators, properties, auth, 'type', null, roleCheckers, checkPriv)
      }
      if (!Object.keys(result[typeName]).length) {
        delete result[typeName]
        return result
      }

      result[typeName].fields = Object.entries(properties[typeName].fields)
        .reduce((result, [fieldName, field]) => {
          const cAuth = _.get(field, 'crud.c')
          if (cAuth) {
            result.c[fieldName] = getChecker(checkers, typeName, 'create', null, properties, cAuth, 'field', fieldName, roleCheckers, checkPriv)
          }
          const rAuth =_.get(field, 'crud.r')
          if (rAuth) {
            result.r[fieldName] = getChecker(checkers, typeName, 'read', null, properties, rAuth, 'field', fieldName, roleCheckers, checkPriv)
          }
          const uAuth = _.get(field, 'crud.u')
          if (uAuth) {
            result.u[fieldName] = getChecker(checkers, typeName, 'update', null, properties, uAuth, 'field', fieldName, roleCheckers, checkPriv)
          }
          const dAuth = _.get(field, 'crud.d')
          if (dAuth) {
            result.d[fieldName] = getChecker(checkers, typeName, 'delete', null, properties, dAuth, 'field', fieldName, roleCheckers, checkPriv)
          }
          return result
        }, {
          c: {},
          r: {},
          u: {},
          d: {}
        })
      return result
    }, checkers)
  return checkers
}


function getChecker(checkers, typeName, action, validators, properties, auth, resource, fieldName, roleCheckers, checkPriv) {
  let checker = () => false
  checker = withAuthChecker(checkers, checker, typeName, action, properties, auth, resource, fieldName, roleCheckers, checkPriv)
  checker =  withValidationChecker(checker, typeName, action, validators, resource)
  return checker
}

function withValidationChecker(checker, name, action, validators, resource) {
  if (action === "delete" || action === "read" || resource === "field")
    return checker
  const { validation } = validators[name]
  if (!validation) {
    return checker
  }
  return async (parent, args, context, info) => {
    for (const key in validation) {
      const validator = validation[key]
      const datum = args.data[key]
      if (!datum)
        continue
      const errors = validator(datum, action === "update")
      if (errors.length) {
        throw new Error(errors.join('\n'))
      }
    }
    return await checker(parent, args, context, info)
  }
}

function withAuthChecker(checkers, checker, typeName, action, properties, auth, resource, fieldName, roleCheckers, checkPriv) {
  if (resource === "field")
    checker = withForeignChecker(checkers, checker, typeName, action, properties, auth, resource, fieldName)
  if (auth.priv) {
    checker = withPrivChecker(auth.priv, checker, action, checkPriv, resource)
  }
  if (auth.role) {
    checker = withRoleChecker(auth.role, checker, roleCheckers, resource)
  }
  if (auth.func) {
    checker = withFuncChecker(auth.func, checker, action, resource)
  }
  return checker
}

function withForeignChecker(checkers, checker, typeName, action, properties, auth, resource, fieldName) {
  const localProperties = _.get(properties, `${typeName}.fields.${fieldName}`)


  if (!localProperties.resolve)
    return checker

  if (!["update", "create"].includes(action))
    return checker

  checker = withForeignTypeChecker(checkers, checker, action, localProperties, properties, typeName, fieldName)
  checker = withForeignFieldChecker(checkers, checker, action, localProperties, properties, typeName, fieldName)

  return checker
}

function withForeignTypeChecker(checkers, checker, action, localProperties, properties, typeName, fieldName) {
  const actionChar = action.charAt(0)
  const foreignTypeProps = properties[localProperties.type]
  if (action === "update") {
    if (!foreignTypeProps.crud.u) {
      throw new Error(`There's no permission to update ${localProperties.type}, therefore, you cannot have an update permission for ${typeName}.${fieldName}`)
    }
  }
  if (action === "create") {
    if (!foreignTypeProps.crud.c) {
      throw new Error(`There's no permission to create ${localProperties.type}, therefore, you cannot have a create permission for ${typeName}.${fieldName}`)
    }
  }
  if (foreignTypeProps) {
    return async (...args) => {
      if (await checkers[localProperties.type][actionChar](...args))
        return await checker(...args)
    }
  }
}

function withForeignFieldChecker(checkers, checker, action, localProperties, properties, typeName, fieldName) {
  const foreignFieldName = getForeignFieldName(localProperties, properties)
  const foreignFieldProps = properties[localProperties.type].fields[foreignFieldName]
  if (action === "update" || action === "create") {
    if (!foreignFieldProps.crud.u) {
      throw new Error(`There's no relational permission to update ${localProperties.type}${(fieldName && ('.' + fieldName)) || ''}, therefore, you cannot have a ${action} permission for ${typeName}.${fieldName}`)
    }
  }
  if (foreignFieldName) {
    const actionChar = "u"
    return async (parent, args, context, info) => {
      if (checkers[localProperties.type].fields[foreignFieldName][actionChar](...args))

        return await checker(parent, args[fieldName], context, info)
    }
  }
  return checker
}

function getForeignFieldName(localProperties, properties) {
  const foreignFieldsProps = properties[localProperties.type].fields
  for (const foreignFieldKey in foreignFieldsProps) {
    const foreignFieldProps = foreignFieldsProps[foreignFieldKey]
    if(foreignFieldProps.type === localProperties.type &&
      (!localProperties.relation.name || localProperties.relation.name === foreignFieldProps.relation.name))
      return foreignFieldKey
  }
}

function withFuncChecker(func, checker, action, resource) {
  return async (...args) => {
    for (let i = 0; i < func.length; i++) {
      if (await func(...args))
        return true
    }
    return await checker(...args)
  }
}

function withPrivChecker(privs, checker, action, checkPriv, resource) {
  return async (parent, args, context, info) => {
    const allowed = await Promise.all(privs.map(async priv => {
      return await checkPriv(parent, args, context, info, action)
    }))
    if (allowed.some(Boolean)) {
      return await checker(parent, args, context, info)
    }
  }
}

export function withRoleChecker(roles, checker, roleCheckers, resource) {
  roles.forEach(role => {
    if (!roleCheckers[role]) {
      throw new Error("Could not find that role")
    }
  })
  return async (...args) => {
    for (let i = 0; i < roles.length; i++) {
      const checkRole = roleCheckers[roles[i]]
      const hasRole = await checkRole(...args)
      if (hasRole) return true
    }
  }
}

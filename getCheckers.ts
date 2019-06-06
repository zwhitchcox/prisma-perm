import { IFieldResult } from './generate-properties';
import _ from 'lodash'
import { createValidators } from '.createValidators';
import { withRoleChecker } from './withRoleChecker';

export async function getCheckers(properties) {
  const validators = createValidators(properties)

  return Object
    .keys(properties)
    .reduce((result, typeName: string) => {
      const crud = (_.get(properties,`${typeName}.crud`) || {})

      if (crud.c) {
        const action = "create"
        const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
       result[typeName].c = getChecker(typeName, action, validators, properties, auth, 'type')
      }
      if (crud.r) {
        const action = "read"
        const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
        result[typeName].r = getChecker(typeName, action, validators, properties, auth, 'type')
      }
      if (crud.u) {
        const action = "update"
        const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
       result[typeName].u = getChecker(typeName, action, validators, properties, auth, 'type')
      }
      if (crud.d) {
        const action = "delete"
        const auth = _.get(properties,`${typeName}.crud.${action.charAt(0)}`)
        result[typeName].d = getChecker(typeName, action, validators, properties, auth, 'type')
      }

      result[typeName].fields = Object.entries(properties[typeName].fields)
        .reduce((result, [fieldName, field]) => {
          result[fieldName] = {}
          const cAuth = _.get(field, 'crud.c')
          if (cAuth) {
            result[fieldName].c = getChecker(typeName, 'create', null, properties, cAuth, 'field', fieldName)
          }
          const rAuth =_.get(field, 'crud.r')
          if (rAuth) {
            result[fieldName].r = getChecker(typeName, 'read', null, properties, rAuth, 'field', fieldName)
          }
          const uAuth = _.get(field, 'crud.u')
          if (uAuth) {
            result[fieldName].u = getChecker(typeName, 'update', null, properties, uAuth, 'field', fieldName)
          }
          const dAuth = _.get(field, 'crud.d')
          if (dAuth) {
            result[fieldName].d = getChecker(typeName, 'delete', null, properties, dAuth, 'field', fieldName)
          }
          return result
        }, {})
      return result
    }, {Query: {}, Mutation: {}})
}


function getChecker(typeName, action, validators, properties, auth, resource, fieldName) {
  let checker = () => false
  checker = withAuthChecker(checker, typeName, action, properties, auth, resource, fieldName)
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

function withAuthChecker(checker, typeName, action, properties, auth, resource, fieldName) {
  const fieldProps = properties[typeName].fields[fieldName]
  let foreign = fieldProps.resolve
  if (auth.priv.length) {
    checker = withPrivChecker(auth.priv, checker, action)
    if (fieldProps.resolve) {
    }
  }
  if (auth.role.length) {
    checker = withRoleChecker(auth.role, checker)
  }
  if (auth.func.length) {
    checker = withFuncChecker(auth.func, checker, action)
  }
  return checker
}

function withFuncChecker(func, checker, action) {
  return async (...args) => {
    for (let i = 0; i < func.length; i++) {
      if (await func(...args))
        return true
    }
    return await checker(...args)
  }
}

function withPrivChecker(privs, checker, action) {
  return async (parent, args, context, info) => {
    const allowed = await Promise.all(privs.map(async priv => {
      return await checkPriv(parent, args, context, info, action)
    }))
    if (allowed.some(Boolean))
      return await checker(parent, args, context, info)
    }
  }
}

export async function withRoleChecker(roles, checker, roleCheckers) {
  const checkRoles = roles.forEach(role => {
    if (!roleCheckers[role]) {
      throw new Error("Could not find that role")
    }
  })
  return async (...args) => {
    for (let i = 0; i < roles.length; i++) {
      const checkRole = checkRoles[i]
      if (await checkRole(...args)) {
        return checker(...args)
      }
    }
  }
}

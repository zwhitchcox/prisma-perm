import {
    parse,
    FieldDefinitionNode,
    ObjectTypeDefinitionNode,
    DefinitionNode,
} from 'graphql';
const fs = require('fs-extra')

interface IValidArg {
  value: {
    value?: string
    values?: IListValue
    kind: string
  },
  name: {
    value: string
  }
  kind: {
    value: string
  }
}

interface IStringValue {
  value: string
  kind: string
}

interface IListValue {
  values: Array<IListValue | IStringValue>
  kind: "ListValue"
}

export interface IFieldResult {
  validation?: {
    [key: string]: string|number
  }
  crudio?: ICrudio
  type: string
  resolve?: boolean
  required?: boolean
  private?: boolean
  isList?: boolean
  relation?: IRelation
}

export interface IObjResult {
  fields?: {
    [key: string]: IFieldResult
  }
  crud?: ICrud
}

interface ICrudio {
  c?: IPerm
  r?: IPerm
  u?: IPerm
  d?: IPerm
  i?: IPerm
  o?: IPerm
}

interface ICrud {
  c?: IPerm
  r?: IPerm
  u?: IPerm
  d?: IPerm
}

interface IRelation {
  name?: string
}

interface IPerm {
  func?: string[]
  role?: string[],
  priv?: string[],
}

const scalarTypes = [
  "String",
  "Boolean",
  "Float",
  "Int",
  "DateTime",
]

export async function generate(graphqlString: string) {
  const parsed = parse(graphqlString)
  const validationProperties = parsed.definitions
    .reduce((result:any, def: DefinitionNode) => {
      let objDef: ObjectTypeDefinitionNode
      if (def.kind === "ObjectTypeDefinition") {
        objDef = def
      } else {
        return result
      }
      if (!(objDef.fields)) return result
      const objResult: IObjResult =  {}
      if (objDef.directives) {
        const crudDirectives = objDef.directives
          .filter(def => (/^[crud]+$/.test(def.name.value)))
        if (crudDirectives.length) {
          objResult.crud = getQualifiers(crudDirectives)
        }
      }
      const fieldValidation = objDef.fields.reduce((fieldsResult:any, fieldDef:FieldDefinitionNode) => {
        const type = getNamedType(fieldDef)
        if (type === "ID") return fieldsResult
        const isList = checkIsList(fieldDef)
        const fieldResult:IFieldResult= fieldsResult[fieldDef.name.value] = {
          type,
          isList,
        }
        if (!scalarTypes.includes(type)) {
          fieldResult.resolve = true
        }

        fieldResult.required = fieldDef.type.kind === "NonNullType"

        if (fieldDef.directives) {
          const validationDirective = fieldDef.directives
            .find(def => (def.name.value === "validation"))
          if (validationDirective) {
            if (validationDirective.arguments) {
              fieldResult.validation = directiveToObject(validationDirective)
            }
          }
          const crudioDirectives = fieldDef.directives
            .filter(def => /^[crudio]+$/.test(def.name.value))
          if (crudioDirectives.length) {
            fieldResult.crudio = getQualifiers(crudioDirectives)
          }
          const privateDirective = fieldDef.directives
            .find(def => (def.name.value === "private"))
          if (privateDirective) {
            fieldResult.private = true
          }
          const relationDirective = fieldDef.directives
            .find(def => (def.name.value === "relation"))
          if (relationDirective)
            fieldResult.relation = directiveToObject(relationDirective)
        }

        return fieldsResult
      }, {})
    if (Object.keys(fieldValidation).length) {
      objResult.fields = fieldValidation
    }
    if (objResult.fields || objResult.crud) {
      result[def.name.value] = objResult
    }
    return result
  }, {})
  const file = 'export const properties = ' +
    JSON.stringify(validationProperties, null, "  ")
  return file
}



function directiveToObject(directive) {
  if (directive.arguments)
    return directive.arguments
      .reduce((validRes:any, validArg) => {
        const validArg2 = (validArg as unknown as IValidArg)
        if (typeof validArg2.value.value !== "undefined") {
          let val: string|number = validArg2.value.value
          if (validArg2.kind.value === "IntValue") {
            val = parseInt(val)
          } else if (validArg2.kind.value === "FloatValue") {
            val = parseFloat(val)
          }
          validRes[validArg.name.value] = val
        } else if (Array.isArray(validArg2.value.values)) {
          validRes[validArg.name.value] = validArg2.value.values.reduce((result: Array<string|Array<string>>, argval: IStringValue | IListValue): Array<string|Array<string>> =>  {
            if (argval.kind === "ListValue") {
              result.push((argval as IListValue).values.reduce((result: string[], value: IStringValue): string[] => {
                result.push(value.value)
                return result
              }, []))
            } else {
              result.push((argval as IStringValue).value)
            }
            return result
          }, [])
        }

        return validRes
      }, {})
  else return {}
}


function getNamedType(type: any): string {
  while (type.kind !== "NamedType") {
    type = type.type
  }
  return type.name.value
}

function checkIsList(type: any): boolean {
  while (type.kind !== "NamedType") {
    if (type.kind === "ListType")
      return true
    type = type.type
  }
  return false
}


const letterActionMap = {
  c: 'create',
  r: 'read',
  u: 'update',
  d: 'delete',
  i: 'disconnect',
  o: 'connect',
}

function getQualifiers(crudDirectives) {
  return crudDirectives.reduce((result, crudDirective) => {
    const letters = crudDirective.name.value
    const qualifiers = directiveToObject(crudDirective)
    letters.split('').forEach(letter => {
      const action = letterActionMap[letter]
      result[action] = result[action] || []
      for (const qualifierKey in qualifiers) {
        if (!["role", "roles"].includes(qualifierKey)) continue
        result[action] = (result[action] || [])
          .concat(qualifiers[qualifierKey])
      }
    })
    return result
  }, {})
}


/* old */
// function filterUnique(arr) {
//   const hash = {}
//   arr = [].concat(arr)

//   return arr.filter((item: string) => {
//     if (hash[item]) return false
//     return hash[item] = true
//   })
// }


// function purge(obj) {
//   const newObj = {}
//   for (const key in obj) {
//     const prop = obj[key]
//     if (Array.isArray(prop)) {
//       if (prop.length === 0) {
//         continue
//       } else {
//         newObj[key] = prop.slice()
//       }
//     } else if (isObject(prop)) {
//       if (Object.keys(prop).length === 0) {
//         continue
//       } else {
//         newObj[key] = purge(obj)
//       }
//     } else {
//       newObj[key] = prop
//     }
//   }
//   return newObj
// }

// function isObject(obj) {
//     return obj !== null && obj.constructor.name === "Object"
// }



// function crudToSplit(privileges): ICrud {
//   const privs = {}
//   for (const key in privileges) {
//     'crud'.split('').forEach(letter => {
//       if (!privs[letter]) {
//         privs[letter] = {}
//       }
//       for (const role in privileges[key]) {
//         if (!privs[letter][role]) {
//           privs[letter][role] = []
//         }
//         privs[letter][role].push(privileges[key])
//       }
//     })
//   }
//   return privs
// }

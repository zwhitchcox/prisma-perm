import {IObjResult, IFieldResult} from './generate-properties'
import _ from 'lodash'

const letters:any = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  .reduce((prev:any, cur:any) => {
    prev[cur] = true
    return prev
  }, {})
const lowercase:any = 'abcdefghijklmnopqrstuvwxyz'.split('')
  .reduce((prev:any, cur:any) => {
    prev[cur] = true
    return prev
  }, {})
const uppercase:any = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  .reduce((prev:any, cur:any) => {
    prev[cur] = true
    return prev
  }, {})
const digits:any = '0123456789'.split('')
  .reduce((prev:any, cur:any) => {
    prev[cur] = true
    return prev
  }, {})
const symbols:any = `!@#$%^&*()_-+=[{]}\\|><.,?/"';:~\``.split('')
  .reduce((prev:any, cur:any) => {
    prev[cur] = true
    return prev
  }, {})

const charTypes:any = {
  letters,
  lowercase,
  uppercase,
  digits,
  symbols,
}

export const presets = {
  name: {
    min: 1,
    max: 40,
    validChars: ["letters", "., "],
    spellcheck: false,
  },
  username: {
    min: 3,
    max: 40,
    validChars: ["letters", "numbers", "_-"]
  },
  phone: {
    min: 10,
    max: 10,
    validChars: ["numbers"],
  },
  password: {
    mustContain: {
      letters: false,
      digits: false,
      lowercase: false,
      uppercase: false,
      symbols: false,
    },
    min: 8,
    max: 100,
  },
  email: {
    regexp: "^(([^<>()[\\]\\\\.,;:\\s@\"]+(\\.[^<>()[\\]\\\\.,;:\\s@\"]+)*)|(\".+\"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$",
    label: 'Email Address',
  },
  ein: {
    regexp: "^[1-9]\\d?-\\d{7}$",
    label: "Employee Identification number"
  }
}

export interface IValidators {
  [prop: string]: {
    [prop: string]: (input: string, isUpdate: boolean) => string[]
  }
}

interface IObjs {
  [key:string]: IObjResult
}

export function createValidators(properties: IObjs) {
  const validatorObjects = Object.entries(properties).reduce((result, [type, obj]: [string, IObjResult]): any => {
    if (!obj.fields) return result
    result[type] = Object.entries(obj.fields)
      .reduce((fieldsResult, [fieldName, field]: [string, IFieldResult]) => {
        if (field.resolve) return fieldsResult
        fieldsResult[fieldName] = createValidator(field, fieldName)
        return fieldsResult
      }, {})
    return result
  }, {})
  return validatorObjects
}

export function createValidator(field, fieldName) {
  if (presets[field]) {
    return createValidator({
      ...presets[field],
      ...(_.omit(field, 'preset'))
    }, fieldName)
  }
  const propsCopy = JSON.parse(JSON.stringify(field))
  if (propsCopy.validChars) {
    propsCopy.validChars = createValidCharHash(propsCopy.validChars)
  }
  if (!propsCopy.label) {
    propsCopy.label = camelToTitle(fieldName)
  }
  if (propsCopy.regexp) {
    return new RegExp(propsCopy.regexp)
  }
  return (input, isUpdate: boolean) => validate(propsCopy, input, isUpdate)
}

export function validate(props:any, input, isUpdate:any): string[] {
  const errors: string[] = []
  if (props.required && !isUpdate) {
    return [`${props.label} is required`]
  }

  if (props.type === "String") {
    if (input.length < props.min)
      errors.push(`${props.label} must be greater than ${props.min} characters.`)
    else if (input.length > props.max)
      errors.push(`${props.label} must be greater than ${props.max} characters.`)
  } else if (["Float", "Int"].includes(props.type)) {
    const num = props.type === "Float" ? parseFloat(input) : parseInt(input)
    if (isNaN(num)) {
      errors.push(`${props.label} must be a number`)
      return errors
    }
    if (input < props.min)
      errors.push(`${props.label} must be greater than ${props.min}.`)
    else if (input > props.max)
      errors.push(`${props.label} must be less than ${props.min}.`)
  }

  if (props.regexp) {
    if (!props.regexp.test(input))
      return [`Please enter a valid ${props.label}`]
  }

  const mustContain = (props.mustContain && JSON.parse(JSON.stringify(props.mustContain)))
  if (props.validChars || mustContain) {
    for (const char of input) {
      if (props.validChars) {
        if (!(char in props.validChars))
          errors.push(`\`${char}\` is not a valid character`)
      }
      if (mustContain) {
        for (const mustContainKey in mustContain) {
          const toCheck = charTypes[mustContainKey]
          if (char in toCheck)
            delete mustContain[mustContainKey]
        }
      }
    }
  }

  if (mustContain) {
    const mustContainKeys = Object.keys(mustContain)
    if (mustContainKeys.length) {
      errors.push(`${props.label} must contain ${arrayToList(mustContainKeys)}`)
    }
  }
  return errors
}

function createValidCharHash(validChars:any) {
  return validChars.reduce((prev:any, cur:any) => {
    if (cur in charTypes) {
      return {
        ...prev,
        ...charTypes[cur],
      }
    } else {
      return {
        ...prev,
        ...cur.split('').reduce((prev, cur) => ({...prev, [cur]: true}))
      }
    }
  }, {})
}

function arrayToList(array){
  return array
    .join(", ")
    .replace(/, ((?:.(?!, ))+)$/, ' and $1');
}

function camelToTitle (camelCase) {
  return camelCase
    .replace(/([A-Z])/g, (match) => ` ${match}`)
    .replace(/^./, (match) => match.toUpperCase())
    .trim()
}
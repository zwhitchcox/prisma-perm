import fs from 'fs-extra'
const getCrudDir = combination => `
directive @${combination} (
  role: Role,
  roles: [Role],
  priv: Privilege,
  privs: [Privilege],
  func: String,
  funcs: [String],
) on FIELD | FIELD_DEFINITION | OBJECT
`

const combinations = (str) => {
    var fn = function(active, rest, a) {
        if (!active && !rest)
            return;
        if (!rest) {
            a.push(active);
        } else {
            fn(active + rest[0], rest.slice(1), a);
            fn(active, rest.slice(1), a);
        }
        return a;
    }
    return fn("", str, []);
}

export const crudDirectives = combinations("crudio").map(getCrudDir).join("\n")
export const prismaDirectives =
`
scalar DateTime
scalar Json
directive @id on FIELD_DEFINITION
directive @createdAt on FIELD_DEFINITION
directive @updatedAt on FIELD_DEFINITION
directive @authenticated on FIELD_DEFINITION
directive @default(value: BoolVal) on FIELD_DEFINITION
directive @scalarList(
  strategy: String=""
) on FIELD_DEFINITION
directive @relation(
  name: String=""
  onDelete: String=""
  link: String=""
) on FIELD_DEFINITION
directive @rename on FIELD_DEFINITION
directive @unique on FIELD_DEFINITION
directive @validation(
  preset: String
  min: Int
  max: Int
  label: String
  description: String
) on FIELD | FIELD_DEFINITION
`
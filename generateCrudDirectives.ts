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

const crudDirectives = combinations("crud").map(getCrudDir).join("\n")

;(async () => {
  fs.writeFile('./prisma/generated/crudDirectives.graphql', crudDirectives)
})()
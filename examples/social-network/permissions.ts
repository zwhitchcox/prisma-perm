export const roleCheckers = {
  SELF: checkSelf,
  PRIVATE: checkPrivate,
  PUBLIC: checkPublic,
  AUTHENTICATED: checkAuthenticated,
}

async function checkPriv(priv, args, context, info, action) {
  const user = context.getUser()
  const { prisma } = context
  let companyname;
  if (!(action === "create")) {
    companyname = args.where.companyname
  } else {
    companyname = args.data.companyname
  }


  if (!context.priv) {
    context.priv = {}
  }
  if (!context.priv[companyname]) {
    context.priv[companyname] = {}
  }
  if (!context.priv[companyname][priv]) {
    return context.priv[companyname][priv] = await prisma.$exists.company({ companyname: companyname })
    .employees({
      where: {
        employee: {
          user: user.id,
          privilege: priv,
        }
      }
    })
  }
  return context.priv[companyname][priv]
}


async function checkSelf(parent, args, context, info) {
  const user = context.getUser()
  if ([
    user.id === args.where.id,
    user.email === args.where.email,
    user.username === args.where.username,
  ].some(Boolean))
    return true
  return false
}

async function checkPrivate() {
  return false
}

async function checkPublic(parent, args, context, info) {
  // TODO check active
  return true
}

async function checkAuthenticated(parent, args, context, info) {
  await context.getUser()
  return true
}


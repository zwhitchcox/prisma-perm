const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { APP_SECRET, getUser } = require('../utils')
const uuid = require('uuid/v4')
const {sendMail} = require('../send-mail')

export async function signup(parent:any, args:any, context:any) {
  // validatePassword(args.password)
  const password = await bcrypt.hash(args.password, 10)
  const check_user = await context.prisma.user({ email: args.email })
  if (check_user) {
    throw new Error('Email already exists')
  }
  const user = await context.prisma.createUser({ ...args, password })

  const token = jwt.sign({ userId: user.id, signInTime: (new Date).toISOString()}, APP_SECRET)

  return {
    token,
    user,
  }
}

export async function signin(parent: any, args: any, context: any) {
  const user = await context.prisma.user({ email: args.email })
  if (!user) {
    throw new Error('No such user found')
  }

  const valid = await bcrypt.compare(args.password, user.password)
  if (!valid) {
    throw new Error('Invalid password')
  }
  const signInTime = (new Date).toISOString()
  context.prisma.updateUser({
    where: {
      email: args.email
    },
    data: {
      lastSignInTime: signInTime
    }
  })

  const token = jwt.sign({ userId: user.id, signInTime }, APP_SECRET)

  return {
    token,
    user,
  }
}


export async function changePassword(parent:any, args:any, context:any) {
  // validatePassword(args.password)
  const user = await getUser(context)
  if (!user) {
    throw new Error('No such user found')
  }

  const valid = await bcrypt.compare(args.oldPassword, user.password)
  if (!valid) {
    throw new Error('Invalid password')
  }

  const lastSignOutAll = (new Date).toISOString()
  await context.prisma.updateUser({
    where: {
      id: user.id
    },
    data: {
      password: await bcrypt.hash(args.password, 10),
      lastSignOutAll
    }
  })
  return {
    token: jwt.sign({ userId: user.id, signInTime: lastSignOutAll }, APP_SECRET),
    user,
  }
}
const jwt = require('jsonwebtoken')
export const APP_SECRET = 'GraphQL-is-aw3some'

export async function getUser(context: any) {
  const Authorization = context.request.get('Authorization')
  if (Authorization) {
    const token = Authorization.replace('Bearer ', '')
    const { userId, signInTime } = jwt.verify(token, APP_SECRET)
    const user = await context.prisma.user({ id: userId })
    const { lastSignOutAll } = user
    if (((new Date(lastSignOutAll)) > (new Date(signInTime))) || typeof signInTime === 'undefined') {
      throw new Error('You have been signed out. Please sign in again.')
    }
    return user
  }
  throw new Error('Not authenticated')
}

export async function ensureAdmin(user:any, context:any) {
  if (!await context.prisma.user({ id: user.id }).admin()) {
    throw new Error('You must be an administrator to perform this action')
  }
}

export async function checkAdmin(user:any, context:any) {
  return !!(await context.prisma.user({ id: user.id }).admin())
}
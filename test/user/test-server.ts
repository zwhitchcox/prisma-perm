import { GraphQLServer } from 'graphql-yoga'
import { roleCheckers } from './permissions';
import { prisma } from './prisma/generated/prisma-client';
import { properties } from './prisma/generated/perm/properties';
import { getResolvers } from '../../getResolvers';

export async function testServer() {
  const derivedResolvers = await getResolvers({
    properties,
    prisma,
    roleCheckers
  })

  const resolvers = {
    ...derivedResolvers,
    Query: {
      ...derivedResolvers.Query,
      // ...Query,
    },
    Mutation: {
      ...derivedResolvers.Mutation,
    },
  }

  const server = new GraphQLServer({
    typeDefs: './test/user/schema.graphql',
    resolvers,
    context: request => ({
      ...request,
      prisma,
      async getUser() {
        if (!this.user) {
          this.user = await getUser(this)
        }
        if (!this.user) {
          throw new Error("You do not have permission to do that.")
        }
        return this.user
      },
      _cache: {

      }
    }),
    resolverValidationOptions: {
      requireResolversForResolveType: false
    }
  })
  return await server.start({port: 0})
}



export async function getUser(context: any) {
  const Authorization = context.request.get('Authorization')
  if (Authorization) {
    const id = Authorization.replace('Bearer ', '')
    const user = await context.prisma.user({ id })
    return user
  }
  throw new Error('Not authenticated')
}
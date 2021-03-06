import { GraphQLServer } from 'graphql-yoga'
import { prisma } from '../prisma/generated/prisma-client'
import * as Mutation from './resolvers/Mutation'
import _ from 'lodash'
import { getUser } from './utils';
import { properties } from '../prisma/generated/perm/properties';
import { getResolvers } from '../../..';
import { roleCheckers, checkPriv } from './permissions';

// const prisma2 = prisma

;(async () => {
const derivedResolvers = await getResolvers(properties, prisma, roleCheckers, checkPriv)


const resolvers = {
  Query: {
    ...derivedResolvers.Query,
    // ...Query,
  },
  Mutation: {
    ...derivedResolvers.Mutation,
    ...Mutation,
  },
}


const server = new GraphQLServer({
  typeDefs: __dirname + '/schema.graphql',
  resolvers,
  context: request => ({
    ...request,
    prisma,
    async getUser() {
      if (!this.user) {
        this.user = await getUser(this.context)
      }
      if (!this.user) {
        throw new Error("You do not have permission to do that.")
      }
      return this.user
    },
  }),
})


})().catch(console.error)
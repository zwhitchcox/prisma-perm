import { GraphQLServer } from 'graphql-yoga'
import { prisma } from '../prisma/generated/prisma-client/index'
import * as Mutation from './resolvers/Mutation'
// import * as Query from './resolvers/Query'
import { properties } from '../prisma/generated/properties';
import _ from 'lodash'
import { getUser } from './utils';

const prisma2 = prisma
const derivedResolvers = getResolvers(properties, prisma)


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

server.start(() => console.log(`Server is running on http://localhost:4000`))
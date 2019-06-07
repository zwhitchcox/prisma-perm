import { prisma } from "./prisma/generated/prisma-client";
import uuid from 'uuid/v4'
import { getResolvers } from './../../getResolvers';
import { roleCheckers, checkPriv } from "./permissions";
import expect from 'expect'
import { properties } from './prisma/generated/perm/properties';

let resolvers



;(async () => {
  resolvers = await getResolvers(properties, prisma, roleCheckers, checkPriv)
  const user1 = await createTestUser()
  const user2 = await createTestUser()
  await updateUserFirstName("Zane", user1, user1.id)
  let updatedUser1 = await prisma.user({id: user1.id})
  expect(updatedUser1.firstName).toBe("Zane")
  await updateUserFirstName("Zane2", user1, user2.id)
  updatedUser1 = await prisma.user({id: user1.id})
  expect(updatedUser1.firstName).toBe("Zane")
})().catch(console.error)

async function updateUserFirstName(firstName, requestingUser, userToUpdateId) {
  const context = {
    getUser() {
      return requestingUser
    },
    prisma
  }
  const args = {
    where: {
      id: userToUpdateId
    },
    data: {
      firstName
    }
  }
  await resolvers.Mutation.updateUser(null, args, context, null)
}

async function createTestUser() {
  const firstName = createRandomName()
  const lastName = createRandomName()
  const username = firstName.toLowerCase()
  const email =  `${username}@gmail.com`
  const password = uuid()
  return await prisma.createUser({
    firstName,
    lastName,
    username,
    email,
    password,
  })
}


function createRandomName() {
  const name = uuid().split('').filter(char => /[a-z]/.test(char)).join('')
  const capitalName = name.charAt(0).toUpperCase() + name.slice(1)
  return capitalName
}

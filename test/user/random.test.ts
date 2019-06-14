import { testServer } from "./test-server";
import fetch from 'node-fetch'
import { prisma } from "./prisma/generated/prisma-client";
import uuid from 'uuid/v4'
import { promisify } from "util";
import expect from 'expect'
import { after, test, runTests } from './test'


const UPDATE_FIRST_NAME_MUTATION = `
  mutation UpdateFirstName($where: UserWhereUniqueInput!, $data: UserUpdateInput!) {
    updateUser(where: $where, data: $data) {
      id
    }
  }
`

let server, port;
after(closeServer)

async function closeServer() {
  if (server) {
    await promisify(server.close).call(server)
  }
}

test('Update user graphql-yoga', async () => {
  server = await testServer()
  port = server.address().port

  const user1 = await createTestUser()
  const user2 = await createTestUser()
  await sendRequestAsUser(UPDATE_FIRST_NAME_MUTATION, {
    where: {
      id: user1.id
    },
    data: {
      firstName: 'Zane',
    }
  }, user1)

  let updatedUser1 = await prisma.user({id: user1.id})
  expect(updatedUser1.firstName).toBe("Zane")

  await expect(
    sendRequestAsUser(UPDATE_FIRST_NAME_MUTATION, {
        where: {
          id: user1.id
        },
        data: {
          firstName: 'Zane2',
        }
      }, user2)
  ).rejects.toThrow('You do not have permission to do update User')

  updatedUser1 = await prisma.user({id: user1.id})
  expect(updatedUser1.firstName).toBe("Zane")
})

test('post to wall', async () => {

})


function sendRequestAsUser(query, variables, user?) {
  return fetch(`http://localhost:${port}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.id}`
    },
    body: JSON.stringify({
      query,
      variables
    })
  })
    .then(resp => resp.json())
    .then(resp => {
      if (resp.errors) {
        resp.errors.forEach(console.log)

        for (const error in resp.errors) {
          console.log(error)
        }
        throw new Error(resp.errors.map(err => err.message).join('\n'))
      } else {
        return resp.data
      }
    })
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
    wall: {
      create: {
        posts: {
          create: []
        }
      }
    }
  })
}


function createRandomName() {
  const name = uuid().split('').filter(char => /[a-z]/.test(char)).join('')
  const capitalName = name.charAt(0).toUpperCase() + name.slice(1)
  return capitalName
}
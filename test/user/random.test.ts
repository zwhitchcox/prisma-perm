import { testServer } from "./test-server";
import fetch from 'node-fetch'
import { prisma } from "./prisma/generated/prisma-client";
import uuid from 'uuid/v4'
import { promisify } from "util";
import expect from 'expect'
import { after, test, before } from './test'



let server, port;
after(closeServer)
before(async () => {
  server = await testServer()
  port = server.address().port
})

async function closeServer() {
  if (server) {
    await deleteAllUsers()
    await promisify(server.close).call(server)
  }
}

async function deleteAllUsers() {
  await prisma.deleteManyUsers({
      id_not: 0
  })

}

const UPDATE_FIRST_NAME_MUTATION = `
  mutation UpdateFirstName($where: UserWhereUniqueInput!, $data: UserUpdateInput!) {
    updateUser(where: $where, data: $data) {
      id
    }
  }
`
test('Update user', async () => {
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
  ).rejects.toThrow('You do not have permission to update User')

  updatedUser1 = await prisma.user({id: user1.id})
  expect(updatedUser1.firstName).toBe("Zane")
})


const GET_USER_INFO_QUERY = `
  query GetUserInfo($where: UserWhereUniqueInput!) {
    user(where: $where) {
      id
      email
    }
  }
`
test.only('read own data', async () => {
  const user1 = await createTestUser()
  const user2 = await createTestUser()
  const result = await sendRequestAsUser(GET_USER_INFO_QUERY, {
    where: {
      id: user1.id
    }
  }, user1)

  await expect(
    sendRequestAsUser(GET_USER_INFO_QUERY, {
        where: {
          id: user1.id
        },
      }, user2)
  ).rejects.toThrow('You do not have permission to read User')
  console.log('result', JSON.stringify(result))

})

const ADD_POST_MUTATION = `
  mutation UpdateFirstName($where: UserWhereUniqueInput!, $data: UserUpdateInput!) {
    updateUser(where: $where, data: $data) {
      id
    }
  }
`
test.skip('post to own wall', async () => {
  const user1 = await createTestUser()
  // await sendRequestAsUser()

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
        for (const error of resp.errors) {
          console.log(error.message)
        }
        throw new Error(resp.errors.map(err => err.message).join('\n'))
      } else {
        return resp.data
      }
    })
}

async function createTestUser(info? = {}) {
  const firstName = createRandomName()
  const lastName = createRandomName()
  const username = firstName.toLowerCase()
  const email =  `${username}@gmail.com`
  const wall = {
    create: {
      posts: {
        create: []
      }
    }
  }
  const password = uuid()
  const defaultInfo = {
    firstName,
    lastName,
    username,
    email,
    password,
    wall,
  }
  return await prisma.createUser({
    ...defaultInfo,
    ...info
  })
}


function createRandomName() {
  const name = uuid().split('').filter(char => /[a-z]/.test(char)).join('')
  const capitalName = name.charAt(0).toUpperCase() + name.slice(1)
  return capitalName
}
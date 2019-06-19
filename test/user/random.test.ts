import { testServer } from "./test-server";
import fetch from 'node-fetch'
import { prisma } from "./prisma/generated/prisma-client";
import uuid from 'uuid/v4'
import { promisify } from "util";
import expect from 'expect'
import { after, test, before, describe } from './test'



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
  try {
    await prisma.deleteManyFriendRequests({
        id_not: 0
    })
    await prisma.deleteManyUsers({
        id_not: 0
    })
  } catch (e) {
    console.log(`Couldn't delete users`)
    console.log(`${e.message}`)
  }
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
test('read own data', async () => {
  const user1 = await createTestUser()
  const user2 = await createTestUser()
  const result = await sendRequestAsUser(GET_USER_INFO_QUERY, {
    where: {
      id: user1.id
    }
  }, user1)
  expect(result.user.email).toBe(user1.email)

  await expect(
    sendRequestAsUser(GET_USER_INFO_QUERY, {
        where: {
          id: user1.id
        },
      }, user2)
  ).rejects.toThrow('You do not have permission to read User')
})


describe.only('friend requests', () => {
  let user1, user2, user3;
  before(async () => {
    user1 = await createTestUser({}, "user1")
    user2 = await createTestUser({}, "user2")
    user3 = await createTestUser({}, "user3")
  })

  const SEND_FRIEND_REQUEST_MUTATION = `
    mutation SendFriendRequest($data: FriendRequestCreateInput!) {
      createFriendRequest(data: $data) {
        id
      }
    }
  `
  let createFriendRequestId;
  test('send friend request', async () => {
    const { createFriendRequest } =
      await sendRequestAsUser(SEND_FRIEND_REQUEST_MUTATION, {
        data: {
          sender: {
            connect: {id: user1.id}
          },
          recipient: {
            connect: {id: user2.id},
          },
        },
      }, user1)
    createFriendRequestId = createFriendRequest.id
  })

  const FRIEND_REQUEST_INFO_QUERY = `
    query FriendRequestInfo($where: FriendRequestWhereUniqueInput!) {
      friendRequest(where: $where) {
        sender {
          id
          username
        }
        recipient {
          id
          username
        }
      }
    }

  `
  test('get friend request info', async () => {
    const {friendRequest} = await sendRequestAsUser(FRIEND_REQUEST_INFO_QUERY, {
      where: {
        id: createFriendRequestId
      }
    }, user1)
    expect(friendRequest.sender.id).toBe(user1.id)
    expect(friendRequest.sender.username).toBe(user1.username)
    expect(friendRequest.recipient.username).toBe(user2.username)
    expect(friendRequest.recipient.id).toBe(user2.id)

    const {friendRequest: friendRequest2} = await sendRequestAsUser(FRIEND_REQUEST_INFO_QUERY, {
      where: {
        id: createFriendRequestId
      }
    }, user2)
    expect(friendRequest2.sender.id).toBe(user1.id)
    expect(friendRequest2.sender.username).toBe(user1.username)
    expect(friendRequest2.recipient.username).toBe(user2.username)
    expect(friendRequest2.recipient.id).toBe(user2.id)
    await expect(sendRequestAsUser(FRIEND_REQUEST_INFO_QUERY, {
      where: {
        id: createFriendRequestId
      }
    }, user3)).rejects.toThrow('You do not have permission to read FriendRequest')
  })

  const ACCEPT_FRIEND_REQUEST_MUTATION = `
    mutation AcceptFriendRequest ($where: UserWhereUniqueInput!, $data: UserUpdateInput!) {
      updateUser(where: $where, data: $data) {
      id
      username
      firstName
      lastName
    }
  }
  `
  test('accept friend request', async () => {
    await sendRequestAsUser(ACCEPT_FRIEND_REQUEST_MUTATION, {
      where: {
        id: user2.id
      },
      data: {
        friends: {
          connect: {id: user1.id}
        }
      }
    }, user2)
  })
})

const ADD_POST_MUTATION = `
  mutation UpdateFirstName($where: UserWhereUniqueInput!, $data: UserUpdateInput!) {
    updateUser(where: $where, data: $data) {
      id
    }
  }
`
test.skip('post to own board', async () => {
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

async function createTestUser(info = {}, prefix?) {
  const firstName = createRandomName()
  const lastName = createRandomName()
  const username = prefix + firstName.toLowerCase()
  const email =  prefix + `${username}@gmail.com`
  const board = {
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
    board,
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
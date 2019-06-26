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
  try {
    server = await testServer()
    port = server.address().port
  } catch (e) {
    throw new Error(`Couldn't start server ${e.stack}`)
  }

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


describe('friend requests', () => {
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

  // const SEND_FRIEND_REQUEST_AND_ACCESS_INFO_MUTATION = ` // TODO
  //   mutation SendFriendRequest($data: FriendRequestCreateInput!) {
  //     createFriendRequest(data: $data) {
  //       id
  //       recipient {

  //       }
  //     }
  //   }
  // `

  // test("can't access sender information on create friend request", async () => {
  //   const { createFriendRequest } =
  //     await sendRequestAsUser(SEND_FRIEND_REQUEST_AND_ACCESS_INFO_MUTATION, {
  //       data: {
  //         sender: {
  //           connect: {id: user1.id}
  //         },
  //         recipient: {
  //           connect: {id: user2.id},
  //         },
  //       },
  //     }, user1)
  //   createFriendRequestId = createFriendRequest.id
  // })

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

describe('Post to board', () => {
  let user1, user2, user3;
  before(async () => {
    user1 = await createTestUser({}, "user1")
    user2 = await createTestUser({}, "user2")
    user3 = await createTestUser({}, "user3")
  })

  const GET_BOARD_QUERY = `
    query GetBoard($where: UserWhereUniqueInput!) {
      user(where: $where) {
        board {
          id
        }
      }
    }
  `
  test('get own board id', async () => {
    const result = await sendRequestAsUser(GET_BOARD_QUERY, {
      where: {
        id: user1.id
      }
    }, user1)
    const realBoard = await prisma.user({id: user1.id}).board()
    expect(result.user.board.id).toBe(realBoard.id)
  })

  const ADD_POST_MUTATION = `
    mutation AddPost($data: PostCreateInput!) {
      createPost(data: $data) {
        id
      }
    }
  `
  test('post to own board', async () => {
    const postText = "This is my first post!"
    const {id:boardId } = await prisma.user({id: user1.id}).board()
    const result = await sendRequestAsUser(ADD_POST_MUTATION, {
      data: {
        text: postText,
        board: { connect: {id: boardId } },
        author: { connect: { id: user1.id } },
        public: false,
      }
    }, user1)
    const posts = await prisma.user({id: user1.id}).posts()
    expect(posts[0].text).toBe(postText)
  })

  const GET_FRIENDS_QUERY = `
    query GetUserFriends($where: UserWhereUniqueInput!) {
      user(where: $where) {
        friends {
          id
        }
      }
    }
  `
  test('view friend\'s friends list', async () => {
    await expect(sendRequestAsUser(GET_FRIENDS_QUERY, {
      where: {
        id: user1.id
      }
    }, user2)).rejects.toThrow('You do not have permission to read User')
    await makeFriends(user1, user2)
    const { user } = await sendRequestAsUser(GET_FRIENDS_QUERY, {
      where: {
        id: user1.id
      }
    }, user2)
  })

  const GET_POSTS_QUERY = `
    query GetPosts($where: UserWhereUniqueInput!) {
      user(where: $where) {
        board {
          posts {
            id
            text
          }
        }
      }
    }
  `
  test('view own posts', async () => {
    const user1 = await createTestUser({}, "user1")
    const postText = "This is my second post"
    const board = await prisma.user({id: user1.id}).board()
    await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: postText,
      public: false,
    })

    await createTestUser({}, "user2")
    const result = await sendRequestAsUser(GET_POSTS_QUERY, {
      where: {
        id: user1.id
      },
    }, user1)
    expect(result.user.board.posts[0].text).toBe(postText)
  })

  const GET_PUBLIC_POSTS_QUERY = `
    query GetPosts($where: UserWhereUniqueInput!, $wherePublic: PostWhereInput!) {
      user(where: $where) {
        board {
          posts (where: $wherePublic) {
            id
            text
          }
        }
      }
    }
  `
  test("can view non friend's posts if public", async () => {
    const postText = "This is my 4asdfa post"
    const user1 = await createTestUser({
      public: true,
      board: {
        create: {
          posts: {},
          public: true,
        }
      }
    }, "user1")
    const user2 = await createTestUser({}, "user2")
    const board = await prisma.user({id: user1.id}).board()
    await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: postText,
      public: true,
    })

    const result = await sendRequestAsUser(GET_PUBLIC_POSTS_QUERY, {
      where: {
        id: user1.id
      },
      wherePublic: {
        public: true,
      }
    }, user2)
    expect(result.user.board.posts[0].text).toBe(postText)
  })

  test("can't view non friend's posts if not public", async () => {
    const user1 = await createTestUser({public: false}, "user1")
    const user2 = await createTestUser({}, "user2")
    const postText = "This is my second post"
    const board = await prisma.user({id: user1.id}).board()
    await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: postText,
      public: false,
    })

    await expect(sendRequestAsUser(GET_POSTS_QUERY, {
      where: {
        id: user1.id
      }
    }, user2)).rejects.toThrow('You do not have permission to read User')
    // expect(result.user.board.posts[0].text).toBe(postText)
  })

  test("can't view public non friend's private board posts", async () => {
    const user1 = await createTestUser({
      public: true,
      board:{
        create: {
          posts: {create: []},
          public: false
        }
      }
    }, "user1")
    const user2 = await createTestUser({}, "user2")
    const postText = "This is my 3rd post"
    const board = await prisma.user({id: user1.id}).board()
    await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: postText,
      public: false,
    })

    await expect(sendRequestAsUser(GET_POSTS_QUERY, {
      where: {
        id: user1.id
      }
    }, user2)).rejects.toThrow('You do not have permission to read User.board')
  })

  test("can view public non friend's public board posts", async () => {
    const user1 = await createTestUser({
      public: true,
      board:{
        create: {
          posts: {create: []},
          public: true
        }
      }
    }, "user1")
    const user2 = await createTestUser({}, "user2")
    const postText = "This is my 4th post"
    const board = await prisma.user({id: user1.id}).board()
    await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: postText,
      public: true,
    })
    await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: `This should not fetch.`,
      public: false,
    })

    const result = await sendRequestAsUser(GET_PUBLIC_POSTS_QUERY, {
      where: {
        id: user1.id
      },
      wherePublic: {
        public: true
      }
    }, user2)
    expect(result.user.board.posts[0].text).toBe(postText)
    expect(result.user.board.posts.length).toBe(1) //TODO
  })
})


const UPDATE_USER_MUTATION = `
mutation UpdateUser($where: UserWhereUniqueInput!, $data: UserUpdateInput!) {
  updateUser(where: $where, data: $data) {
    id
    firstName
  }
}
`
describe.only('deep update', () => {
  test('can deep update own post to private', async () => {
    const user1 = await createTestUser({}, "user1")
    const user2 = await createTestUser({}, "user2")
    const postText = "This is my 4th post"
    const board = await prisma.user({id: user1.id}).board()
    const post = await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: postText,
      public: true,
    })
    await sendRequestAsUser(UPDATE_USER_MUTATION, {
      where: {
        id: user1.id
      },
      data: {
        board: {
          update: {
            posts: {
              update: {
                where: {
                  id: post.id
                },
                data: {
                  public: false
                }
              }
            }
          }
        }
      }
    }, user1)
    const result  = await prisma.user({id: user1.id}).posts()
    expect(result[0].text).toBe(postText)
  })

  test('can deep create post', async () => {
    const user1 = await createTestUser({}, "user1")
    const user2 = await createTestUser({}, "user2")
    const postText = "This is my 5th post"
    const board = await prisma.user({id: user1.id}).board()
    await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: postText,
      public: true,
    })
    await sendRequestAsUser(UPDATE_USER_MUTATION, {
      where: {
        id: user1.id
      },
      data: {
        board: {
          update: {
            posts: {
              create: {
                text: postText,
                public: true,
                author: {connect: {id: user1.id}} //TEST THIS
              }
            }
          }
        }
      }
    }, user1)
    const posts  = await prisma.user({id: user1.id}).posts()
    expect(posts[0].text).toBe(postText)
  })

  test.only(`can't create with different author`, async () => {
    const user1 = await createTestUser({}, "user1")
    const user2 = await createTestUser({}, "user2")
    const postText = "This is my 5th post"
    const board = await prisma.user({id: user1.id}).board()
    await prisma.createPost({
      author: {connect: {id: user1.id}},
      board: {connect: {id: board.id}},
      text: postText,
      public: true,
    })
    await sendRequestAsUser(UPDATE_USER_MUTATION, {
      where: {
        id: user1.id
      },
      data: {
        board: {
          update: {
            posts: {
              create: {
                text: postText,
                public: true,
                author: {connect: {id: user2.id}} //TEST THIS
              }
            }
          }
        }
      }
    }, user1)
    const posts  = await prisma.user({id: user1.id}).posts()
    expect(posts[0].text).toBe(postText)
  })
})

async function makeFriends(user1, user2) {
  await prisma.updateUser({
    where: {
      id: user1.id
    },
    data: {
      friends: {
        connect: {
          id: user2.id
        }
      }
    }
  })
  await prisma.updateUser({
    where: {
      id: user2.id
    },
    data: {
      friends: {
        connect: {
          id: user1.id
        }
      }
    }
  })
}



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
        create: [],
      },
      public: false,
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
    public: false,
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
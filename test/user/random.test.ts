import { testServer } from "./test-server";
import fetch from 'node-fetch'
import { prisma } from "./prisma/generated/prisma-client";
import uuid from 'uuid/v4'
import gql from 'graphql-tag'
import chalk from "chalk";
import { promisify } from "util";
import expect from 'expect'

let tests = []
let afters = []
const test = (name, fn) => tests.push([name, fn])
const after = fn => afters.push(fn)
const log = (...args) => {
  const err = new Error()
  const fileNameRegex = /\(.*\)/g

  const match = fileNameRegex.exec(err.stack.split('\n')[2])
  console.log(chalk.cyan(match[0].slice(1, match[0].length - 1)))
  console.log(...args)
}


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
  await promisify(server.close).call(server)
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
  })
}


function createRandomName() {
  const name = uuid().split('').filter(char => /[a-z]/.test(char)).join('')
  const capitalName = name.charAt(0).toUpperCase() + name.slice(1)
  return capitalName
}

;(async () => {
for (let i = 0; i < tests.length; i++) {
  const [name, fn] = tests[i]
  console.log(name)
  try {
    await fn()
    console.log(chalk.green('Passed ✓'))
  } catch (e) {
    console.log(chalk.red(e))
    console.error(chalk.red('Failed :('))
  }
}
for (let i = 0; i < afters.length; i++) {
  await afters[i]()
}
})()
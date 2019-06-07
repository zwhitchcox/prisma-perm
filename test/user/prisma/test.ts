import { prisma } from "./generated/prisma-client";
import uuid from 'uuid/v4'


;(async () => {
  const userData = await createTestUser()
  console.log(userData)
})()

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

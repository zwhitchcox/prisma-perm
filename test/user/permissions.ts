import _ from 'lodash'

export const roleCheckers = {
  SELF: checkSelf,
  PRIVATE: checkPrivate,
  PUBLIC: checkPublic,
  AUTHENTICATED: checkAuthenticated,
  AUTHOR: checkAuthor,
  AUTHOR_FRIEND: checkAuthorFriend,
  IS_SENDER: isSender,
  IS_RECIPIENT: isRecipient,
  ACCEPT_FRIEND_REQUEST: acceptFriendRequest,
  IS_FRIEND: isFriend,
}
// TODO make IS_ helper
// TODO make IS_NOT_ helper


export async function isFriend(parent, args, context, info) {
  return false // TODO
}

export async function acceptFriendRequest(parent, args, context, info) {
  const self = await context.getUser()
  const newFriends = args.data.friends.connect
  if (!(newFriends.length === 1)) {
    throw new Error('You can only add one friend at a time.')
  }
  const newFriend = newFriends[0]
  const result = await context.prisma.deleteManyFriendRequests({
    AND: [
      {recipient: {id: self.id}},
      {sender: {id: newFriend.id}}
    ]
  })
  if (result.count < 1) {
    throw new Error('You do not have a friend request from that person.')
  }
  await context.prisma.updateUser({
    where: {
      id: newFriend.id
    }, data: {
      friends: {
        connect: {id: self.id}
      }
    }
  })
  return true
}

export async function isRecipient(parent, args, context, info) {
  const user = await context.getUser()
  const {recipient} = args.where
  if (recipient) {
    return isUser(user, recipient)
  }

  const id = _.get(args, "where.id")
  if (id) {
    const recipient = await context.prisma.friendRequest({
      id
    }).recipient()
    return isUser(user, recipient)
  }
}

export async function isSender(parent, args, context, info) {
  const user = await context.getUser()
  const sender = _.get(args, 'data.sender.connect') ||
    args.where.sender
  if (sender) {
    return isUser(user, sender)
  }
  const id = _.get(args, "where.id")
  if (id) {
    const sender = await context.prisma.friendRequest({
      id
    }).sender()
    return isUser(user, sender)
  }
}

export async function checkAuthor(parent, args, context, info) {
  const user = await context.getUser()
  if (parent) {
    return parent.id === user.id
  }
  if (args.where && args.where.author) {
    return isUser(args.where.author, user)
  }
}

export async function checkAuthorFriend(parent, args, context, info) {
  return false
}


async function checkSelf(parent, args, context, info) {
  const user = await context.getUser()
  return isUser(args.where, user)
}

async function checkPrivate() {
  return false
}

async function checkPublic(parent, args, context, info) {
  // TODO check active
  return true
}

async function checkAuthenticated(parent, args, context, info) {
  await context.getUser()
  return true
}


function isUser(user1, user2) {
  return user1.id === user2.id ||
    user1.email === user2.email ||
    user1.username === user2.username
}
import _ from 'lodash'

export const roleCheckers = {
  SELF: checkSelf,
  PRIVATE: checkPrivate,
  PUBLIC: checkPublic,
  AUTHENTICATED: checkAuthenticated,
  AUTHOR: checkAuthor,
  AUTHOR_FRIEND: checkAuthorFriend,
  ENSURE_POSTS_PUBLIC: ensurePostsPublic,
  IS_SENDER: isSender,
  IS_RECIPIENT: isRecipient,
  ACCEPT_FRIEND_REQUEST: acceptFriendRequest,
  REMOVE_FRIEND: removeFriend,
  IS_FRIEND: isFriend,
  PASS_IS_FRIEND: passIsFriend,
  BOARD_OWNER: boardOwner,
  PROFILE_PUBLIC: checkProfilePublic,
  BOARD_PUBLIC: boardPublic,
}
// TODO make IS_ helper
// TODO make IS_NOT_ helper

export async function ensurePostsPublic(parent, args, context, info) {
  if (!_.get(args, 'where.public')) {
    args.where = {}
    return args.where.public = true
  }
}

export async function checkAuthor(parent, args, context, info) {
  const user = await context.getUser()
  if (info.parentType.name === "Board") {
    return await getBoardOwnerByBoardId(parent.id, context) === user.id
  }

  let authorId;
  if (authorId = _.get(args, 'data.author.connect.id')) {
    return authorId === user.id
  }
}

export async function checkAuthorFriend(parent, args, context, info) {
  const user = await context.getUser()
  let boardId
  if (info.parentType.name === "Board") {
    boardId = parent.id
  } else {
    throw new Error(`Couldn't find the board ID`)
  }
  const boardOwnerId = await getBoardOwnerByBoardId(boardId, context)
  const result = await context.prisma.user({id: boardOwnerId}).friends({
    where: {
      id: user.id,
    },
    first: 1,
  })
  return result.length
}

export async function boardPublic(parent, args, context, info) {
  const board = await context.prisma.user({id: parent.id}).board()
  return board.public
}

export async function checkProfilePublic(parent, args, context, info) {
  const user = await context.prisma.user({id: args.where.id})
  return user.public
}

export async function boardOwner(parent, args, context, info) {
  const user = await context.getUser()

  // get board id
  let boardId
  if (info.parentType.name === "Board") {
    boardId = parent.id
  } else if (!(boardId = _.get(args, 'data.board.connect.id'))) {
    throw new Error(`Couldn't find board id`)
  }
  return await getBoardOwnerByBoardId(boardId, context) === user.id
}

async function getBoardOwnerByBoardId(boardId, context) {
  const boardOwnerCache = context._cache.BOARD_OWNER || {}
  if (boardId in boardOwnerCache) {
    return boardOwnerCache[boardId]
  }
  const boardOwner = await context.prisma.board({id: boardId}).owner()
  boardOwnerCache[boardId] = boardOwner.id
  return boardOwner.id
}

export async function isFriend(parent, args, context, info) {
  const self = await context.getUser()
  const result = await context.prisma
    .user({ id: self.id })
    .friends({
      where: {
        id: (parent || args.where).id
      }
    })
  return result.length
}

export async function passIsFriend(parent, args, context, info) {
  if (!await isFriend(parent, args, context, info)) {
    throw new Error("You must be a friend to do that.")
  }
  return false
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
export async function removeFriend(parent, args, context, info) {
  const self = await context.getUser()
  const oldFriend = args.data.friends.disconnect[0]
  await context.prisma.updateUser({
    where: {
      id: self.id
    }, data: {
      friends: {
        disconnect: {id: oldFriend.id}
      }
    }
  })
  await context.prisma.updateUser({
    where: {
      id: oldFriend.id
    }, data: {
      friends: {
        disconnect: {id: self.id}
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



async function checkSelf(parent, args, context, info) {
  const user = await context.getUser()
  return isUser(parent || args.where, user)
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
import _ from 'lodash'
import { properties } from './prisma/generated/perm/properties';

export const roleCheckers = {
  SELF: checkSelf,
  PRIVATE: checkPrivate,
  PUBLIC: checkPublic,
  AUTHENTICATED: checkAuthenticated,
  AUTHOR: checkAuthor,
  AUTHOR_FRIEND: checkAuthorFriend,
  ENSURE_POSTS_PUBLIC: ensurePostsPublic,
  IS_SENDER: fieldIsUser('sender'),
  IS_RECIPIENT: fieldIsUser('recipient'),
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

// export async function isRecipient(parent, args, context, info) {
//   const user = await context.getUser()
//   const {recipient} = args.where
//   if (recipient) {
//     return isUser(user, recipient)
//   }

//   const id = _.get(args, "where.id")
//   if (id) {
//     const recipient = await context.prisma.friendRequest({
//       id
//     }).recipient()
//     return isUser(user, recipient)
//   }
// }


// export async function isSender(parent, args, context, info) {

//   const user = await context.getUser()
//   const sender = _.get(args, 'data.sender.connect') ||
//     _.get(args, 'where.sender')||
//     await context.prisma.
//   if (sender) {
//     return isUser(user, sender)
//   }
//   const id = _.get(args, "where.id")
//   if (id) {
//     const sender = await context.prisma.friendRequest({
//       id
//     }).sender()
//     return isUser(user, sender)
//   }
// }



async function checkSelf(parent, args, context, info) {
  const user = await context.getUser()
  return compareUniqueFields(parent || args.where, user, getUniqueFields("User"))
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

async function getUser(parent, args, context, info) {
  return await context.getUser()
}

function lowercaseFirstLetter(name) {
  return name[0].toLowerCase() + name.slice(1)
}

const _uniqueFieldsCache = {}
function getUniqueFields(typename) { // lazy load, because why not
  return _uniqueFieldsCache[typename] ||
  (_uniqueFieldsCache[typename] = Object.entries(properties[typename].fields)
    .reduce((uniqueFields, [fieldname, field]) => {
      if ((field as any).unique) uniqueFields.push(fieldname)
      return uniqueFields
    }, ['id']))
}

function fieldIsUser(fieldname) {
  return compareRetrieved(getUser, getFieldResource(fieldname))
}

function compareRetrieved(comparand1, comparand2) {
  return async function compare(parent, args, context, info) {
    const resourceName = getRequestResource(info)
    const uniqueFields = getUniqueFields(resourceName)
    return compareUniqueFields(
      await comparand1(parent, args, context, info),
      await comparand2(parent, args, context, info),
      uniqueFields
    )
  }
}

function getRequestResource(info) {
  if (info.parentType.name === "Mutation") {
    return info.returnType.ofType.name
  }
  if (info.parentType.name === "Query") {
    return info.returnType.name
  }
  return info.parentType.name
}

function compareUniqueFields(first, second, uniqueFields) {
  for (const field of uniqueFields) {
    if (first[field] === second[field])
      return true
  }
  return false
}

function getFieldResource(fieldname) {
  const fn = async function getFieldResource(parent, args, context, info) {
    let resource;
    if(resource = _.get(args, `data.${fieldname}.connect`) ||
      _.get(args, `where.${fieldname}`))
      return  resource

    if (args.where) {
      return context
        .prisma[lowercaseFirstLetter(getRequestResource(info))]
          (args.where)[fieldname]()
    }
    if (parent && parent.id) {
      return await context
        .prisma[lowercaseFirstLetter(info.parentType.name)]
          ({id: parent.id })[fieldname]()
    }
    throw new Error(`Couldn't find ${fieldname}`)
  }
  fn.fieldname = fieldname // debugging
  return fn
}
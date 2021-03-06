export const roleCheckers = {
  SELF: checkSelf,
  PRIVATE: checkPrivate,
  PUBLIC: checkPublic,
  AUTHENTICATED: checkAuthenticated,
  AUTHOR: checkAuthor,
  AUTHOR_FRIEND: checkAuthorFriend,
  IS_SENDER: isSender,
  IS_RECIPIENT: isRecipient,
  HAS_FRIEND_REQUEST: hasFriendRequest,
}
// TODO make IS_ automatically check field
// TODO make NOT_ automatic

export async function hasFriendRequest(parent, args, context, info) {
  const self = await context.getUser()
  const newFriend = args.data.friends.connect.user
  return await context.prisma.$exists.friendRequest({
    where: {
      OR: [{
        recipient: {id: self.id},
        sender: {id: newFriend.id},
        accepted: true,
      },{
        recipient: { id: newFriend.id },
        sender: { id: self.id },
        accepted: true,
      }]
    }
  })

}

export async function isRecipient(parent, args, context, info) {
  const user = await context.getUser()
  const {recipient} = args.where
  return isUser(user, recipient)
}

export async function isSender(parent, args, context, info) {
  const user = await context.getUser()
  const {sender} = args.data
  return isUser(user, sender)
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
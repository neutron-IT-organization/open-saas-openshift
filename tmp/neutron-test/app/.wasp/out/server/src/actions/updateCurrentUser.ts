import { prisma } from 'wasp/server'

import { updateCurrentUser } from '../../../../../src/user/operations'


export default async function (args, context) {
  return (updateCurrentUser as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}

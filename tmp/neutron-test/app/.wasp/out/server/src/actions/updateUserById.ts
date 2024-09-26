import { prisma } from 'wasp/server'

import { updateUserById } from '../../../../../src/user/operations'


export default async function (args, context) {
  return (updateUserById as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}

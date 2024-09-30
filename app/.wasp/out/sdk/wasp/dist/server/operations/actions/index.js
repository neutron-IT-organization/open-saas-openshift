import { prisma } from 'wasp/server';
import { createAuthenticatedOperation, } from '../wrappers.js';
import { updateCurrentUser as updateCurrentUser_ext } from 'wasp/ext-src/user/operations';
import { updateUserById as updateUserById_ext } from 'wasp/ext-src/user/operations';
import { generateGptResponse as generateGptResponse_ext } from 'wasp/ext-src/demo-ai-app/operations';
import { createTask as createTask_ext } from 'wasp/ext-src/demo-ai-app/operations';
import { deleteTask as deleteTask_ext } from 'wasp/ext-src/demo-ai-app/operations';
import { updateTask as updateTask_ext } from 'wasp/ext-src/demo-ai-app/operations';
import { generateCheckoutSession as generateCheckoutSession_ext } from 'wasp/ext-src/payment/operations';
import { createFile as createFile_ext } from 'wasp/ext-src/file-upload/operations';
// PUBLIC API
export const updateCurrentUser = createAuthenticatedOperation(updateCurrentUser_ext, {
    User: prisma.user,
});
// PUBLIC API
export const updateUserById = createAuthenticatedOperation(updateUserById_ext, {
    User: prisma.user,
});
// PUBLIC API
export const generateGptResponse = createAuthenticatedOperation(generateGptResponse_ext, {
    User: prisma.user,
    Task: prisma.task,
    GptResponse: prisma.gptResponse,
});
// PUBLIC API
export const createTask = createAuthenticatedOperation(createTask_ext, {
    Task: prisma.task,
});
// PUBLIC API
export const deleteTask = createAuthenticatedOperation(deleteTask_ext, {
    Task: prisma.task,
});
// PUBLIC API
export const updateTask = createAuthenticatedOperation(updateTask_ext, {
    Task: prisma.task,
});
// PUBLIC API
export const generateCheckoutSession = createAuthenticatedOperation(generateCheckoutSession_ext, {
    User: prisma.user,
});
// PUBLIC API
export const createFile = createAuthenticatedOperation(createFile_ext, {
    User: prisma.user,
    File: prisma.file,
});
//# sourceMappingURL=index.js.map
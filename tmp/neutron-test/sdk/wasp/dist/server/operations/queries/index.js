import { prisma } from 'wasp/server';
import { createAuthenticatedOperation, } from '../wrappers.js';
import { getPaginatedUsers as getPaginatedUsers_ext } from 'wasp/ext-src/user/operations';
import { getGptResponses as getGptResponses_ext } from 'wasp/ext-src/demo-ai-app/operations';
import { getAllTasksByUser as getAllTasksByUser_ext } from 'wasp/ext-src/demo-ai-app/operations';
import { getCustomerPortalUrl as getCustomerPortalUrl_ext } from 'wasp/ext-src/payment/operations';
import { getAllFilesByUser as getAllFilesByUser_ext } from 'wasp/ext-src/file-upload/operations';
import { getDownloadFileSignedURL as getDownloadFileSignedURL_ext } from 'wasp/ext-src/file-upload/operations';
import { getDailyStats as getDailyStats_ext } from 'wasp/ext-src/analytics/operations';
// PUBLIC API
export const getPaginatedUsers = createAuthenticatedOperation(getPaginatedUsers_ext, {
    User: prisma.user,
});
// PUBLIC API
export const getGptResponses = createAuthenticatedOperation(getGptResponses_ext, {
    User: prisma.user,
    GptResponse: prisma.gptResponse,
});
// PUBLIC API
export const getAllTasksByUser = createAuthenticatedOperation(getAllTasksByUser_ext, {
    Task: prisma.task,
});
// PUBLIC API
export const getCustomerPortalUrl = createAuthenticatedOperation(getCustomerPortalUrl_ext, {
    User: prisma.user,
});
// PUBLIC API
export const getAllFilesByUser = createAuthenticatedOperation(getAllFilesByUser_ext, {
    User: prisma.user,
    File: prisma.file,
});
// PUBLIC API
export const getDownloadFileSignedURL = createAuthenticatedOperation(getDownloadFileSignedURL_ext, {
    User: prisma.user,
    File: prisma.file,
});
// PUBLIC API
export const getDailyStats = createAuthenticatedOperation(getDailyStats_ext, {
    User: prisma.user,
    DailyStats: prisma.dailyStats,
});
//# sourceMappingURL=index.js.map
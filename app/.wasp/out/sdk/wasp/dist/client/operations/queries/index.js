import { createQuery } from './core';
// PUBLIC API
export const getPaginatedUsers = createQuery('operations/get-paginated-users', ['User']);
// PUBLIC API
export const getGptResponses = createQuery('operations/get-gpt-responses', ['User', 'GptResponse']);
// PUBLIC API
export const getAllTasksByUser = createQuery('operations/get-all-tasks-by-user', ['Task']);
// PUBLIC API
export const getCustomerPortalUrl = createQuery('operations/get-customer-portal-url', ['User']);
// PUBLIC API
export const getAllFilesByUser = createQuery('operations/get-all-files-by-user', ['User', 'File']);
// PUBLIC API
export const getDownloadFileSignedURL = createQuery('operations/get-download-file-signed-url', ['User', 'File']);
// PUBLIC API
export const getDailyStats = createQuery('operations/get-daily-stats', ['User', 'DailyStats']);
// PRIVATE API (used in SDK)
export { buildAndRegisterQuery } from './core';
//# sourceMappingURL=index.js.map
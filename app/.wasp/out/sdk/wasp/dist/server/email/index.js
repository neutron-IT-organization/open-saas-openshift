import { initEmailSender } from "./core/index.js";
const emailProvider = {
    type: "mailgun",
    apiKey: process.env.MAILGUN_API_KEY,
    domain: process.env.MAILGUN_DOMAIN,
};
// PUBLIC API
export const emailSender = initEmailSender(emailProvider);
//# sourceMappingURL=index.js.map
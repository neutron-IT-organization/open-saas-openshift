import { initEmailSender } from "./core/index.js";
import { EmailSender } from "./core/types.js";

const emailProvider = {
  type: "mailgun",
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
} as const;

// PUBLIC API
export const emailSender: EmailSender = initEmailSender(emailProvider);

// PUBLIC API
export type { Email, EmailFromField, EmailSender, SentMessageInfo } from "./core/types.js";

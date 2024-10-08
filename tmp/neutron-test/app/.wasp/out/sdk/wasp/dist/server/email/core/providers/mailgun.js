import { NodeMailgun } from "ts-mailgun";
import { getDefaultFromField } from "../helpers.js";
// PRIVATE API
export function initMailgunEmailSender(config) {
    const mailer = new NodeMailgun(config.apiKey, config.domain);
    const defaultFromField = getDefaultFromField();
    return {
        async send(email) {
            const fromField = email.from || defaultFromField;
            mailer.fromEmail = fromField.email;
            mailer.fromTitle = fromField.name;
            mailer.init();
            return mailer.send(email.to, email.subject, email.html);
        },
    };
}
//# sourceMappingURL=mailgun.js.map
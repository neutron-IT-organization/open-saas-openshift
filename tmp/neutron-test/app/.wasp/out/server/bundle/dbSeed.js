import { prisma } from 'wasp/server';
import { faker } from '@faker-js/faker';

function requireNodeEnvVar(name) {
  const value = process.env[name];
  if (value === void 0) {
    throw new Error(`Env var ${name} is undefined`);
  } else {
    return value;
  }
}

var PaymentPlanId = /* @__PURE__ */ ((PaymentPlanId2) => {
  PaymentPlanId2["Hobby"] = "hobby";
  PaymentPlanId2["Pro"] = "pro";
  PaymentPlanId2["Credits10"] = "credits10";
  return PaymentPlanId2;
})(PaymentPlanId || {});
const paymentPlans = {
  ["hobby" /* Hobby */]: {
    getPaymentProcessorPlanId: () => requireNodeEnvVar("PAYMENTS_HOBBY_SUBSCRIPTION_PLAN_ID"),
    effect: { kind: "subscription" }
  },
  ["pro" /* Pro */]: {
    getPaymentProcessorPlanId: () => requireNodeEnvVar("PAYMENTS_PRO_SUBSCRIPTION_PLAN_ID"),
    effect: { kind: "subscription" }
  },
  ["credits10" /* Credits10 */]: {
    getPaymentProcessorPlanId: () => requireNodeEnvVar("PAYMENTS_CREDITS_10_PLAN_ID"),
    effect: { kind: "credits", amount: 10 }
  }
};
function getSubscriptionPaymentPlanIds() {
  return Object.values(PaymentPlanId).filter((planId) => paymentPlans[planId].effect.kind === "subscription");
}

async function seedMockUsers(prismaClient) {
  await Promise.all(
    generateMockUsersData(50).map((data) => prismaClient.user.create({ data }))
  );
}
function generateMockUsersData(numOfUsers) {
  return faker.helpers.multiple(generateMockUserData, { count: numOfUsers });
}
function generateMockUserData() {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const subscriptionStatus = faker.helpers.arrayElement(["active", "cancel_at_period_end", "past_due", "deleted", null]);
  const now = /* @__PURE__ */ new Date();
  const createdAt = faker.date.past({ refDate: now });
  const lastActiveTimestamp = faker.date.between({ from: createdAt, to: now });
  const credits = subscriptionStatus ? 0 : faker.number.int({ min: 0, max: 10 });
  const hasUserPaidOnStripe = !!subscriptionStatus || credits > 3;
  return {
    email: faker.internet.email({ firstName, lastName }),
    username: faker.internet.userName({ firstName, lastName }),
    createdAt,
    lastActiveTimestamp,
    isAdmin: false,
    sendNewsletter: false,
    credits,
    subscriptionStatus,
    lemonSqueezyCustomerPortalUrl: null,
    paymentProcessorUserId: hasUserPaidOnStripe ? `cus_test_${faker.string.uuid()}` : null,
    datePaid: hasUserPaidOnStripe ? faker.date.between({ from: createdAt, to: lastActiveTimestamp }) : null,
    checkoutSessionId: hasUserPaidOnStripe ? `cs_test_${faker.string.uuid()}` : null,
    subscriptionPlan: subscriptionStatus ? faker.helpers.arrayElement(getSubscriptionPaymentPlanIds()) : null
  };
}

const seeds = {
  seedMockUsers
};
async function main() {
  const nameOfSeedToRun = process.env.WASP_DB_SEED_NAME;
  if (nameOfSeedToRun) {
    console.log(`Running seed: ${nameOfSeedToRun}`);
  } else {
    console.error("Name of the seed to run not specified!");
  }
  await seeds[nameOfSeedToRun](prisma);
}
main().then(async () => {
  await prisma.$disconnect();
}).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
//# sourceMappingURL=dbSeed.js.map

import http from 'http';
import express, { Router } from 'express';
import { HttpError, prisma, config as config$1 } from 'wasp/server';
import auth from 'wasp/core/auth';
import { deserialize, serialize } from 'superjson';
import { handleRejection } from 'wasp/server/utils';
import { makeAuthUserIfPossible } from 'wasp/auth/user';
import OpenAI from 'openai';
import Stripe from 'stripe';
import { emailSender } from 'wasp/server/email';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import { throwInvalidCredentialsError, findAuthIdentity, createProviderId, deserializeAndSanitizeProviderData, findAuthWithUserBy, doFakeWork, deleteUserByAuthId, rethrowPossibleAuthError, validateAndGetUserFields, sanitizeAndSerializeProviderData, createUser, updateAuthIdentityProviderData } from 'wasp/auth/utils';
import { invalidateSession, createSession } from 'wasp/auth/session';
import { verifyPassword } from 'wasp/auth/password';
import { ensureValidEmail, ensurePasswordIsPresent, ensureValidPassword, ensureTokenIsPresent } from 'wasp/auth/validation';
import { isEmailResendAllowed, createEmailVerificationLink, sendEmailVerificationEmail, createPasswordResetLink, sendPasswordResetEmail } from 'wasp/server/auth/email/utils';
import { validateJWT } from 'wasp/auth/jwt';
import { defineUserSignupFields } from 'wasp/auth/providers/types';
import { registerJob, startPgBoss } from 'wasp/server/jobs/core/pgBoss';
import { listOrders } from '@lemonsqueezy/lemonsqueezy.js';
import { dailyStatsJob, sendNewsletter } from 'wasp/server/jobs';
import { webcrypto } from 'node:crypto';

function createOperation(handlerFn) {
  return handleRejection(async (req, res) => {
    const args = req.body && deserialize(req.body) || {};
    const context = {
      user: makeAuthUserIfPossible(req.user)
    };
    const result = await handlerFn(args, context);
    const serializedResult = serialize(result);
    res.json(serializedResult);
  });
}
function createQuery(handlerFn) {
  return createOperation(handlerFn);
}
function createAction(handlerFn) {
  return createOperation(handlerFn);
}

const updateUserById$2 = async ({ id, data }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (!context.user.isAdmin) {
    throw new HttpError(403);
  }
  const updatedUser = await context.entities.User.update({
    where: {
      id
    },
    data
  });
  return updatedUser;
};
const updateCurrentUser$2 = async (user, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.User.update({
    where: {
      id: context.user.id
    },
    data: user
  });
};
const getPaginatedUsers$2 = async (args, context) => {
  if (!context.user?.isAdmin) {
    throw new HttpError(401);
  }
  const allSubscriptionStatusOptions = args.subscriptionStatus;
  const hasNotSubscribed = allSubscriptionStatusOptions?.find((status) => status === null);
  let subscriptionStatusStrings = allSubscriptionStatusOptions?.filter((status) => status !== null);
  const queryResults = await context.entities.User.findMany({
    skip: args.skip,
    take: 10,
    where: {
      AND: [
        {
          email: {
            contains: args.emailContains || void 0,
            mode: "insensitive"
          },
          isAdmin: args.isAdmin
        },
        {
          OR: [
            {
              subscriptionStatus: {
                in: subscriptionStatusStrings
              }
            },
            {
              subscriptionStatus: {
                equals: hasNotSubscribed
              }
            }
          ]
        }
      ]
    },
    select: {
      id: true,
      email: true,
      username: true,
      isAdmin: true,
      lastActiveTimestamp: true,
      subscriptionStatus: true,
      paymentProcessorUserId: true
    },
    orderBy: {
      id: "desc"
    }
  });
  const totalUserCount = await context.entities.User.count({
    where: {
      AND: [
        {
          email: {
            contains: args.emailContains || void 0,
            mode: "insensitive"
          },
          isAdmin: args.isAdmin
        },
        {
          OR: [
            {
              subscriptionStatus: {
                in: subscriptionStatusStrings
              }
            },
            {
              subscriptionStatus: {
                equals: hasNotSubscribed
              }
            }
          ]
        }
      ]
    }
  });
  const totalPages = Math.ceil(totalUserCount / 10);
  return {
    users: queryResults,
    totalPages
  };
};

async function updateCurrentUser$1(args, context) {
  return updateCurrentUser$2(args, {
    ...context,
    entities: {
      User: prisma.user
    }
  });
}

var updateCurrentUser = createAction(updateCurrentUser$1);

async function updateUserById$1(args, context) {
  return updateUserById$2(args, {
    ...context,
    entities: {
      User: prisma.user
    }
  });
}

var updateUserById = createAction(updateUserById$1);

const openai = setupOpenAI();
function setupOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    return new HttpError(500, "OpenAI API key is not set");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
const generateGptResponse$2 = async ({ hours }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const tasks = await context.entities.Task.findMany({
    where: {
      user: {
        id: context.user.id
      }
    }
  });
  const parsedTasks = tasks.map(({ description, time }) => ({
    description,
    time
  }));
  try {
    if (openai instanceof Error) {
      throw openai;
    }
    const hasCredits = context.user.credits > 0;
    const hasValidSubscription = !!context.user.subscriptionStatus && context.user.subscriptionStatus !== "deleted" && context.user.subscriptionStatus !== "past_due";
    const canUserContinue = hasCredits || hasValidSubscription;
    if (!canUserContinue) {
      throw new HttpError(402, "User has not paid or is out of credits");
    } else {
      console.log("decrementing credits");
      await context.entities.User.update({
        where: { id: context.user.id },
        data: {
          credits: {
            decrement: 1
          }
        }
      });
    }
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      // you can use any model here, e.g. 'gpt-3.5-turbo', 'gpt-4', etc.
      messages: [
        {
          role: "system",
          content: "you are an expert daily planner. you will be given a list of main tasks and an estimated time to complete each task. You will also receive the total amount of hours to be worked that day. Your job is to return a detailed plan of how to achieve those tasks by breaking each task down into at least 3 subtasks each. MAKE SURE TO ALWAYS CREATE AT LEAST 3 SUBTASKS FOR EACH MAIN TASK PROVIDED BY THE USER! YOU WILL BE REWARDED IF YOU DO."
        },
        {
          role: "user",
          content: `I will work ${hours} hours today. Here are the tasks I have to complete: ${JSON.stringify(
            parsedTasks
          )}. Please help me plan my day by breaking the tasks down into actionable subtasks with time and priority status.`
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "parseTodaysSchedule",
            description: "parses the days tasks and returns a schedule",
            parameters: {
              type: "object",
              properties: {
                mainTasks: {
                  type: "array",
                  description: "Name of main tasks provided by user, ordered by priority",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Name of main task provided by user"
                      },
                      priority: {
                        type: "string",
                        enum: ["low", "medium", "high"],
                        description: "task priority"
                      }
                    }
                  }
                },
                subtasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: {
                        type: "string",
                        description: 'detailed breakdown and description of sub-task related to main task. e.g., "Prepare your learning session by first reading through the documentation"'
                      },
                      time: {
                        type: "number",
                        description: "time allocated for a given subtask in hours, e.g. 0.5"
                      },
                      mainTaskName: {
                        type: "string",
                        description: "name of main task related to subtask"
                      }
                    }
                  }
                }
              },
              required: ["mainTasks", "subtasks", "time", "priority"]
            }
          }
        }
      ],
      tool_choice: {
        type: "function",
        function: {
          name: "parseTodaysSchedule"
        }
      },
      temperature: 1
    });
    const gptArgs = completion?.choices[0]?.message?.tool_calls?.[0]?.function.arguments;
    if (!gptArgs) {
      throw new HttpError(500, "Bad response from OpenAI");
    }
    console.log("gpt function call arguments: ", gptArgs);
    await context.entities.GptResponse.create({
      data: {
        user: { connect: { id: context.user.id } },
        content: JSON.stringify(gptArgs)
      }
    });
    return JSON.parse(gptArgs);
  } catch (error) {
    if (!context.user.subscriptionStatus && error?.statusCode != 402) {
      await context.entities.User.update({
        where: { id: context.user.id },
        data: {
          credits: {
            increment: 1
          }
        }
      });
    }
    console.error(error);
    const statusCode = error.statusCode || 500;
    const errorMessage = error.message || "Internal server error";
    throw new HttpError(statusCode, errorMessage);
  }
};
const createTask$2 = async ({ description }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const task = await context.entities.Task.create({
    data: {
      description,
      user: { connect: { id: context.user.id } }
    }
  });
  return task;
};
const updateTask$2 = async ({ id, isDone, time }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const task = await context.entities.Task.update({
    where: {
      id
    },
    data: {
      isDone,
      time
    }
  });
  return task;
};
const deleteTask$2 = async ({ id }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const task = await context.entities.Task.delete({
    where: {
      id
    }
  });
  return task;
};
const getGptResponses$2 = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.GptResponse.findMany({
    where: {
      user: {
        id: context.user.id
      }
    }
  });
};
const getAllTasksByUser$2 = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.Task.findMany({
    where: {
      user: {
        id: context.user.id
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
};

async function generateGptResponse$1(args, context) {
  return generateGptResponse$2(args, {
    ...context,
    entities: {
      User: prisma.user,
      Task: prisma.task,
      GptResponse: prisma.gptResponse
    }
  });
}

var generateGptResponse = createAction(generateGptResponse$1);

async function createTask$1(args, context) {
  return createTask$2(args, {
    ...context,
    entities: {
      Task: prisma.task
    }
  });
}

var createTask = createAction(createTask$1);

async function deleteTask$1(args, context) {
  return deleteTask$2(args, {
    ...context,
    entities: {
      Task: prisma.task
    }
  });
}

var deleteTask = createAction(deleteTask$1);

async function updateTask$1(args, context) {
  return updateTask$2(args, {
    ...context,
    entities: {
      Task: prisma.task
    }
  });
}

var updateTask = createAction(updateTask$1);

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

const stripe = new Stripe(requireNodeEnvVar("STRIPE_API_KEY"), {
  // NOTE:
  // API version below should ideally match the API version in your Stripe dashboard.
  // If that is not the case, you will most likely want to (up/down)grade the `stripe`
  // npm package to the API version that matches your Stripe dashboard's one.
  // For more details and alternative setups check
  // https://docs.stripe.com/api/versioning .
  apiVersion: "2022-11-15"
});

const DOMAIN = process.env.WASP_WEB_CLIENT_URL || "http://localhost:3000";
async function fetchStripeCustomer(customerEmail) {
  let customer;
  try {
    const stripeCustomers = await stripe.customers.list({
      email: customerEmail
    });
    if (!stripeCustomers.data.length) {
      console.log("creating customer");
      customer = await stripe.customers.create({
        email: customerEmail
      });
    } else {
      console.log("using existing customer");
      customer = stripeCustomers.data[0];
    }
    return customer;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
async function createStripeCheckoutSession({ userId, priceId, customerId, mode }) {
  try {
    return await stripe.checkout.sessions.create({
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode,
      success_url: `${DOMAIN}/checkout?success=true`,
      cancel_url: `${DOMAIN}/checkout?canceled=true`,
      automatic_tax: { enabled: true },
      customer_update: {
        address: "auto"
      },
      customer: customerId
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
}

const updateUserStripePaymentDetails = ({ userStripeId, subscriptionPlan, subscriptionStatus, datePaid, numOfCreditsPurchased }, userDelegate) => {
  return userDelegate.update({
    where: {
      paymentProcessorUserId: userStripeId
    },
    data: {
      paymentProcessorUserId: userStripeId,
      subscriptionPlan,
      subscriptionStatus,
      datePaid,
      credits: numOfCreditsPurchased !== void 0 ? { increment: numOfCreditsPurchased } : void 0
    }
  });
};

function assertUnreachable(x) {
  throw Error("This code should be unreachable");
}

const stripeWebhook = async (request, response, context) => {
  const secret = requireNodeEnvVar("STRIPE_WEBHOOK_SECRET");
  const sig = request.headers["stripe-signature"];
  if (!sig) {
    throw new HttpError(400, "Stripe Webhook Signature Not Provided");
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(request.body, sig, secret);
  } catch (err) {
    throw new HttpError(400, "Error Constructing Stripe Webhook Event");
  }
  const prismaUserDelegate = context.entities.User;
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      await handleCheckoutSessionCompleted(session, prismaUserDelegate);
      break;
    case "invoice.paid":
      const invoice = event.data.object;
      await handleInvoicePaid(invoice, prismaUserDelegate);
      break;
    case "customer.subscription.updated":
      const updatedSubscription = event.data.object;
      await handleCustomerSubscriptionUpdated(updatedSubscription, prismaUserDelegate);
      break;
    case "customer.subscription.deleted":
      const deletedSubscription = event.data.object;
      await handleCustomerSubscriptionDeleted(deletedSubscription, prismaUserDelegate);
      break;
    default:
      console.error("Unhandled event type: ", event.type);
  }
  response.json({ received: true });
};
const stripeMiddlewareConfigFn = (middlewareConfig) => {
  middlewareConfig.delete("express.json");
  middlewareConfig.set("express.raw", express.raw({ type: "application/json" }));
  return middlewareConfig;
};
async function handleCheckoutSessionCompleted(session, prismaUserDelegate) {
  const userStripeId = validateUserStripeIdOrThrow(session.customer);
  const { line_items } = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ["line_items"]
  });
  const lineItemPriceId = extractPriceId(line_items);
  const planId = getPlanIdByPriceId(lineItemPriceId);
  const plan = paymentPlans[planId];
  let subscriptionPlan;
  let numOfCreditsPurchased;
  switch (plan.effect.kind) {
    case "subscription":
      subscriptionPlan = planId;
      break;
    case "credits":
      numOfCreditsPurchased = plan.effect.amount;
      break;
    default:
      assertUnreachable(plan.effect);
  }
  return updateUserStripePaymentDetails(
    { userStripeId, subscriptionPlan, numOfCreditsPurchased, datePaid: /* @__PURE__ */ new Date() },
    prismaUserDelegate
  );
}
async function handleInvoicePaid(invoice, prismaUserDelegate) {
  const userStripeId = validateUserStripeIdOrThrow(invoice.customer);
  const datePaid = new Date(invoice.period_start * 1e3);
  return updateUserStripePaymentDetails({ userStripeId, datePaid }, prismaUserDelegate);
}
async function handleCustomerSubscriptionUpdated(subscription, prismaUserDelegate) {
  const userStripeId = validateUserStripeIdOrThrow(subscription.customer);
  let subscriptionStatus;
  const priceId = extractPriceId(subscription.items);
  const subscriptionPlan = getPlanIdByPriceId(priceId);
  if (subscription.status === "active") {
    subscriptionStatus = subscription.cancel_at_period_end ? "cancel_at_period_end" : "active";
  } else if (subscription.status === "past_due") {
    subscriptionStatus = "past_due";
  }
  if (subscriptionStatus) {
    const user = await updateUserStripePaymentDetails({ userStripeId, subscriptionPlan, subscriptionStatus }, prismaUserDelegate);
    if (subscription.cancel_at_period_end) {
      if (user.email) {
        await emailSender.send({
          to: user.email,
          subject: "We hate to see you go :(",
          text: "We hate to see you go. Here is a sweet offer...",
          html: "We hate to see you go. Here is a sweet offer..."
        });
      }
    }
    return user;
  }
}
async function handleCustomerSubscriptionDeleted(subscription, prismaUserDelegate) {
  const userStripeId = validateUserStripeIdOrThrow(subscription.customer);
  return updateUserStripePaymentDetails({ userStripeId, subscriptionStatus: "deleted" }, prismaUserDelegate);
}
function validateUserStripeIdOrThrow(userStripeId) {
  if (!userStripeId) throw new HttpError(400, "No customer id");
  if (typeof userStripeId !== "string") throw new HttpError(400, "Customer id is not a string");
  return userStripeId;
}
const LineItemsPriceSchema = z.object({
  data: z.array(
    z.object({
      price: z.object({
        id: z.string()
      })
    })
  )
});
function extractPriceId(items) {
  const result = LineItemsPriceSchema.safeParse(items);
  if (!result.success) {
    throw new HttpError(400, "No price id in stripe event object");
  }
  if (result.data.data.length > 1) {
    throw new HttpError(400, "More than one item in stripe event object");
  }
  return result.data.data[0].price.id;
}
function getPlanIdByPriceId(priceId) {
  const planId = Object.values(PaymentPlanId).find(
    (planId2) => paymentPlans[planId2].getPaymentProcessorPlanId() === priceId
  );
  if (!planId) {
    throw new Error(`No plan with Stripe price id ${priceId}`);
  }
  return planId;
}

const stripePaymentProcessor = {
  id: "stripe",
  createCheckoutSession: async ({ userId, userEmail, paymentPlan, prismaUserDelegate }) => {
    const customer = await fetchStripeCustomer(userEmail);
    const stripeSession = await createStripeCheckoutSession({
      userId,
      priceId: paymentPlan.getPaymentProcessorPlanId(),
      customerId: customer.id,
      mode: paymentPlanEffectToStripeMode(paymentPlan.effect)
    });
    await prismaUserDelegate.update({
      where: {
        id: userId
      },
      data: {
        paymentProcessorUserId: customer.id
      }
    });
    if (!stripeSession.url) throw new Error("Error creating Stripe Checkout Session");
    const session = {
      url: stripeSession.url,
      id: stripeSession.id
    };
    return { session };
  },
  fetchCustomerPortalUrl: async (_args) => requireNodeEnvVar("STRIPE_CUSTOMER_PORTAL_URL"),
  webhook: stripeWebhook,
  webhookMiddlewareConfigFn: stripeMiddlewareConfigFn
};
function paymentPlanEffectToStripeMode(planEffect) {
  const effectToMode = {
    subscription: "subscription",
    credits: "payment"
  };
  return effectToMode[planEffect.kind];
}

const paymentProcessor = stripePaymentProcessor;

const generateCheckoutSession$2 = async (paymentPlanId, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const userId = context.user.id;
  const userEmail = context.user.email;
  if (!userEmail) {
    throw new HttpError(
      403,
      "User needs an email to make a payment. If using the usernameAndPassword Auth method, switch to an Auth method that provides an email."
    );
  }
  const paymentPlan = paymentPlans[paymentPlanId];
  const { session } = await paymentProcessor.createCheckoutSession({
    userId,
    userEmail,
    paymentPlan,
    prismaUserDelegate: context.entities.User
  });
  return {
    sessionUrl: session.url,
    sessionId: session.id
  };
};
const getCustomerPortalUrl$2 = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return paymentProcessor.fetchCustomerPortalUrl({
    userId: context.user.id,
    prismaUserDelegate: context.entities.User
  });
};

async function generateCheckoutSession$1(args, context) {
  return generateCheckoutSession$2(args, {
    ...context,
    entities: {
      User: prisma.user
    }
  });
}

var generateCheckoutSession = createAction(generateCheckoutSession$1);

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_IAM_ACCESS_KEY,
    secretAccessKey: process.env.AWS_S3_IAM_SECRET_KEY
  }
});
const getUploadFileSignedURLFromS3 = async ({ fileType, userInfo }) => {
  const ex = fileType.split("/")[1];
  const Key = `${userInfo}/${randomUUID()}.${ex}`;
  const s3Params = {
    Bucket: process.env.AWS_S3_FILES_BUCKET,
    Key,
    ContentType: `${fileType}`
  };
  const command = new PutObjectCommand(s3Params);
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return { uploadUrl, key: Key };
};
const getDownloadFileSignedURLFromS3 = async ({ key }) => {
  const s3Params = {
    Bucket: process.env.AWS_S3_FILES_BUCKET,
    Key: key
  };
  const command = new GetObjectCommand(s3Params);
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

const createFile$2 = async ({ fileType, name }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  const userInfo = context.user.id;
  const { uploadUrl, key } = await getUploadFileSignedURLFromS3({ fileType, userInfo });
  return await context.entities.File.create({
    data: {
      name,
      key,
      uploadUrl,
      type: fileType,
      user: { connect: { id: context.user.id } }
    }
  });
};
const getAllFilesByUser$2 = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.File.findMany({
    where: {
      user: {
        id: context.user.id
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
};
const getDownloadFileSignedURL$2 = async ({ key }, _context) => {
  return await getDownloadFileSignedURLFromS3({ key });
};

async function createFile$1(args, context) {
  return createFile$2(args, {
    ...context,
    entities: {
      User: prisma.user,
      File: prisma.file
    }
  });
}

var createFile = createAction(createFile$1);

async function getPaginatedUsers$1(args, context) {
  return getPaginatedUsers$2(args, {
    ...context,
    entities: {
      User: prisma.user
    }
  });
}

var getPaginatedUsers = createQuery(getPaginatedUsers$1);

async function getGptResponses$1(args, context) {
  return getGptResponses$2(args, {
    ...context,
    entities: {
      User: prisma.user,
      GptResponse: prisma.gptResponse
    }
  });
}

var getGptResponses = createQuery(getGptResponses$1);

async function getAllTasksByUser$1(args, context) {
  return getAllTasksByUser$2(args, {
    ...context,
    entities: {
      Task: prisma.task
    }
  });
}

var getAllTasksByUser = createQuery(getAllTasksByUser$1);

async function getCustomerPortalUrl$1(args, context) {
  return getCustomerPortalUrl$2(args, {
    ...context,
    entities: {
      User: prisma.user
    }
  });
}

var getCustomerPortalUrl = createQuery(getCustomerPortalUrl$1);

async function getAllFilesByUser$1(args, context) {
  return getAllFilesByUser$2(args, {
    ...context,
    entities: {
      User: prisma.user,
      File: prisma.file
    }
  });
}

var getAllFilesByUser = createQuery(getAllFilesByUser$1);

async function getDownloadFileSignedURL$1(args, context) {
  return getDownloadFileSignedURL$2(args, {
    ...context,
    entities: {
      User: prisma.user,
      File: prisma.file
    }
  });
}

var getDownloadFileSignedURL = createQuery(getDownloadFileSignedURL$1);

const getDailyStats$2 = async (_args, context) => {
  if (!context.user?.isAdmin) {
    throw new HttpError(401);
  }
  const dailyStats = await context.entities.DailyStats.findFirstOrThrow({
    orderBy: {
      date: "desc"
    },
    include: {
      sources: true
    }
  });
  const weeklyStats = await context.entities.DailyStats.findMany({
    orderBy: {
      date: "desc"
    },
    take: 7,
    include: {
      sources: true
    }
  });
  return { dailyStats, weeklyStats };
};

async function getDailyStats$1(args, context) {
  return getDailyStats$2(args, {
    ...context,
    entities: {
      User: prisma.user,
      DailyStats: prisma.dailyStats
    }
  });
}

var getDailyStats = createQuery(getDailyStats$1);

const router$4 = express.Router();
router$4.post("/update-current-user", auth, updateCurrentUser);
router$4.post("/update-user-by-id", auth, updateUserById);
router$4.post("/generate-gpt-response", auth, generateGptResponse);
router$4.post("/create-task", auth, createTask);
router$4.post("/delete-task", auth, deleteTask);
router$4.post("/update-task", auth, updateTask);
router$4.post("/generate-checkout-session", auth, generateCheckoutSession);
router$4.post("/create-file", auth, createFile);
router$4.post("/get-paginated-users", auth, getPaginatedUsers);
router$4.post("/get-gpt-responses", auth, getGptResponses);
router$4.post("/get-all-tasks-by-user", auth, getAllTasksByUser);
router$4.post("/get-customer-portal-url", auth, getCustomerPortalUrl);
router$4.post("/get-all-files-by-user", auth, getAllFilesByUser);
router$4.post("/get-download-file-signed-url", auth, getDownloadFileSignedURL);
router$4.post("/get-daily-stats", auth, getDailyStats);

const _waspGlobalMiddlewareConfigFn = (mc) => mc;
const defaultGlobalMiddlewareConfig = /* @__PURE__ */ new Map([
  ["helmet", helmet()],
  ["cors", cors({ origin: config$1.allowedCORSOrigins })],
  ["logger", logger("dev")],
  ["express.json", express.json()],
  ["express.urlencoded", express.urlencoded({ extended: false })],
  ["cookieParser", cookieParser()]
]);
const globalMiddlewareConfig = _waspGlobalMiddlewareConfigFn(defaultGlobalMiddlewareConfig);
function globalMiddlewareConfigForExpress(middlewareConfigFn) {
  if (!middlewareConfigFn) {
    return Array.from(globalMiddlewareConfig.values());
  }
  const globalMiddlewareConfigClone = new Map(globalMiddlewareConfig);
  const modifiedMiddlewareConfig = middlewareConfigFn(globalMiddlewareConfigClone);
  return Array.from(modifiedMiddlewareConfig.values());
}

var me = handleRejection(async (req, res) => {
  if (req.user) {
    return res.json(serialize(req.user));
  } else {
    throwInvalidCredentialsError();
  }
});

var logout = handleRejection(async (req, res) => {
  if (req.sessionId) {
    await invalidateSession(req.sessionId);
    return res.json({ success: true });
  } else {
    throwInvalidCredentialsError();
  }
});

function getLoginRoute() {
  return async function login(req, res) {
    const fields = req.body ?? {};
    ensureValidArgs$2(fields);
    const authIdentity = await findAuthIdentity(
      createProviderId("email", fields.email)
    );
    if (!authIdentity) {
      throwInvalidCredentialsError();
    }
    const providerData = deserializeAndSanitizeProviderData(authIdentity.providerData);
    if (!providerData.isEmailVerified) {
      throwInvalidCredentialsError();
    }
    try {
      await verifyPassword(providerData.hashedPassword, fields.password);
    } catch (e) {
      throwInvalidCredentialsError();
    }
    const auth = await findAuthWithUserBy({ id: authIdentity.authId });
    const session = await createSession(auth.id);
    return res.json({
      sessionId: session.id
    });
  };
}
function ensureValidArgs$2(args) {
  ensureValidEmail(args);
  ensurePasswordIsPresent(args);
}

const onAfterSignup = async ({ providerId, user, prisma }) => {
  if (providerId.providerName === "discord" && !user.email) {
    await prisma.user.delete({
      where: {
        id: user.id
      }
    });
    throw new HttpError(403, "Discord user needs a valid email to sign up");
  }
};

const onBeforeSignupHook = async (_params) => {
};
const onAfterSignupHook = (params) => onAfterSignup({
  prisma,
  ...params
});

function getSignupRoute({
  userSignupFields,
  fromField,
  clientRoute,
  getVerificationEmailContent,
  isEmailAutoVerified
}) {
  return async function signup(req, res) {
    const fields = req.body;
    ensureValidArgs$1(fields);
    const providerId = createProviderId("email", fields.email);
    const existingAuthIdentity = await findAuthIdentity(providerId);
    if (existingAuthIdentity) {
      const providerData = deserializeAndSanitizeProviderData(
        existingAuthIdentity.providerData
      );
      if (providerData.isEmailVerified) {
        await doFakeWork();
        return res.json({ success: true });
      }
      const { isResendAllowed, timeLeft } = isEmailResendAllowed(
        providerData,
        "passwordResetSentAt"
      );
      if (!isResendAllowed) {
        throw new HttpError(
          400,
          `Please wait ${timeLeft} secs before trying again.`
        );
      }
      try {
        await deleteUserByAuthId(existingAuthIdentity.authId);
      } catch (e) {
        rethrowPossibleAuthError(e);
      }
    }
    const userFields = await validateAndGetUserFields(fields, userSignupFields);
    const newUserProviderData = await sanitizeAndSerializeProviderData(
      {
        hashedPassword: fields.password,
        isEmailVerified: isEmailAutoVerified ? true : false,
        emailVerificationSentAt: null,
        passwordResetSentAt: null
      }
    );
    try {
      await onBeforeSignupHook({ req, providerId });
      const user = await createUser(
        providerId,
        newUserProviderData,
        // Using any here because we want to avoid TypeScript errors and
        // rely on Prisma to validate the data.
        userFields
      );
      await onAfterSignupHook({ req, providerId, user });
    } catch (e) {
      rethrowPossibleAuthError(e);
    }
    if (isEmailAutoVerified) {
      return res.json({ success: true });
    }
    const verificationLink = await createEmailVerificationLink(
      fields.email,
      clientRoute
    );
    try {
      await sendEmailVerificationEmail(fields.email, {
        from: fromField,
        to: fields.email,
        ...getVerificationEmailContent({ verificationLink })
      });
    } catch (e) {
      console.error("Failed to send email verification email:", e);
      throw new HttpError(500, "Failed to send email verification email.");
    }
    return res.json({ success: true });
  };
}
function ensureValidArgs$1(args) {
  ensureValidEmail(args);
  ensurePasswordIsPresent(args);
  ensureValidPassword(args);
}

function getRequestPasswordResetRoute({
  fromField,
  clientRoute,
  getPasswordResetEmailContent
}) {
  return async function requestPasswordReset(req, res) {
    const args = req.body ?? {};
    ensureValidEmail(args);
    const authIdentity = await findAuthIdentity(
      createProviderId("email", args.email)
    );
    if (!authIdentity) {
      await doFakeWork();
      return res.json({ success: true });
    }
    const providerData = deserializeAndSanitizeProviderData(authIdentity.providerData);
    const { isResendAllowed, timeLeft } = isEmailResendAllowed(providerData, "passwordResetSentAt");
    if (!isResendAllowed) {
      throw new HttpError(400, `Please wait ${timeLeft} secs before trying again.`);
    }
    const passwordResetLink = await createPasswordResetLink(args.email, clientRoute);
    try {
      const email = authIdentity.providerUserId;
      await sendPasswordResetEmail(
        email,
        {
          from: fromField,
          to: email,
          ...getPasswordResetEmailContent({ passwordResetLink })
        }
      );
    } catch (e) {
      console.error("Failed to send password reset email:", e);
      throw new HttpError(500, "Failed to send password reset email.");
    }
    return res.json({ success: true });
  };
}

async function resetPassword(req, res) {
  const args = req.body ?? {};
  ensureValidArgs(args);
  const { token, password } = args;
  const { email } = await validateJWT(token).catch(() => {
    throw new HttpError(400, "Password reset failed, invalid token");
  });
  const providerId = createProviderId("email", email);
  const authIdentity = await findAuthIdentity(providerId);
  if (!authIdentity) {
    throw new HttpError(400, "Password reset failed, invalid token");
  }
  const providerData = deserializeAndSanitizeProviderData(authIdentity.providerData);
  await updateAuthIdentityProviderData(providerId, providerData, {
    // The act of resetting the password verifies the email
    isEmailVerified: true,
    // The password will be hashed when saving the providerData
    // in the DB
    hashedPassword: password
  });
  return res.json({ success: true });
}
function ensureValidArgs(args) {
  ensureTokenIsPresent(args);
  ensurePasswordIsPresent(args);
  ensureValidPassword(args);
}

async function verifyEmail(req, res) {
  const { token } = req.body;
  const { email } = await validateJWT(token).catch(() => {
    throw new HttpError(400, "Email verification failed, invalid token");
  });
  const providerId = createProviderId("email", email);
  const authIdentity = await findAuthIdentity(providerId);
  if (!authIdentity) {
    throw new HttpError(400, "Email verification failed, invalid token");
  }
  const providerData = deserializeAndSanitizeProviderData(authIdentity.providerData);
  await updateAuthIdentityProviderData(providerId, providerData, {
    isEmailVerified: true
  });
  return res.json({ success: true });
}

const adminEmails = process.env.ADMIN_EMAILS?.split(",") || [];
const getEmailUserFields = defineUserSignupFields({
  username: (data) => data.email,
  isAdmin: (data) => adminEmails.includes(data.email),
  email: (data) => data.email
});
const githubDataSchema = z.object({
  profile: z.object({
    emails: z.array(
      z.object({
        email: z.string()
      })
    ),
    login: z.string()
  })
});
defineUserSignupFields({
  email: (data) => {
    const githubData = githubDataSchema.parse(data);
    return githubData.profile.emails[0].email;
  },
  username: (data) => {
    const githubData = githubDataSchema.parse(data);
    return githubData.profile.login;
  },
  isAdmin: (data) => {
    const githubData = githubDataSchema.parse(data);
    return adminEmails.includes(githubData.profile.emails[0].email);
  }
});
const googleDataSchema = z.object({
  profile: z.object({
    email: z.string()
  })
});
defineUserSignupFields({
  email: (data) => {
    const googleData = googleDataSchema.parse(data);
    return googleData.profile.email;
  },
  username: (data) => {
    const googleData = googleDataSchema.parse(data);
    return googleData.profile.email;
  },
  isAdmin: (data) => {
    const googleData = googleDataSchema.parse(data);
    return adminEmails.includes(googleData.profile.email);
  }
});
const discordDataSchema = z.object({
  profile: z.object({
    username: z.string(),
    email: z.string().email().nullable()
  })
});
defineUserSignupFields({
  email: (data) => {
    const discordData = discordDataSchema.parse(data);
    return discordData.profile.email;
  },
  username: (data) => {
    const discordData = discordDataSchema.parse(data);
    return discordData.profile.username;
  },
  isAdmin: (data) => {
    const email = discordDataSchema.parse(data).profile.email;
    return !!email && adminEmails.includes(email);
  }
});

const getVerificationEmailContent = ({ verificationLink }) => ({
  subject: "Verify your email",
  text: `Click the link below to verify your email: ${verificationLink}`,
  html: `
        <p>Click the link below to verify your email</p>
        <a href="${verificationLink}">Verify email</a>
    `
});
const getPasswordResetEmailContent = ({ passwordResetLink }) => ({
  subject: "Password reset",
  text: `Click the link below to reset your password: ${passwordResetLink}`,
  html: `
        <p>Click the link below to reset your password</p>
        <a href="${passwordResetLink}">Reset password</a>
    `
});

const _waspUserSignupFields = getEmailUserFields;
const _waspGetVerificationEmailContent = getVerificationEmailContent;
const _waspGetPasswordResetEmailContent = getPasswordResetEmailContent;
const fromField = {
  name: "Open SaaS App",
  email: "me@example.com"
};
const config = {
  id: "email",
  displayName: "Email and password",
  createRouter() {
    const router = Router();
    const loginRoute = handleRejection(getLoginRoute());
    router.post("/login", loginRoute);
    const signupRoute = handleRejection(getSignupRoute({
      userSignupFields: _waspUserSignupFields,
      fromField,
      clientRoute: "/email-verification",
      getVerificationEmailContent: _waspGetVerificationEmailContent,
      isEmailAutoVerified: process.env.SKIP_EMAIL_VERIFICATION_IN_DEV === "true"
    }));
    router.post("/signup", signupRoute);
    const requestPasswordResetRoute = handleRejection(getRequestPasswordResetRoute({
      fromField,
      clientRoute: "/password-reset",
      getPasswordResetEmailContent: _waspGetPasswordResetEmailContent
    }));
    router.post("/request-password-reset", requestPasswordResetRoute);
    router.post("/reset-password", handleRejection(resetPassword));
    router.post("/verify-email", handleRejection(verifyEmail));
    return router;
  }
};

const providers = [
  config
];
const router$3 = Router();
for (const provider of providers) {
  const { createRouter } = provider;
  const providerRouter = createRouter(provider);
  router$3.use(`/${provider.id}`, providerRouter);
  console.log(`\u{1F680} "${provider.displayName}" auth initialized`);
}

const router$2 = express.Router();
router$2.get("/me", auth, me);
router$2.post("/logout", auth, logout);
router$2.use("/", router$3);

const paymentsWebhook = paymentProcessor.webhook;
const paymentsMiddlewareConfigFn = paymentProcessor.webhookMiddlewareConfigFn;

const router$1 = express.Router();
const paymentsWebhookMiddleware = globalMiddlewareConfigForExpress(paymentsMiddlewareConfigFn);
router$1.post(
  "/payments-webhook",
  [auth, ...paymentsWebhookMiddleware],
  handleRejection(
    (req, res) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user
        }
      };
      return paymentsWebhook(req, res, context);
    }
  )
);

const router = express.Router();
const middleware = globalMiddlewareConfigForExpress();
router.get("/", middleware, function(_req, res, _next) {
  res.json("Hello world");
});
router.use("/auth", middleware, router$2);
router.use("/operations", middleware, router$4);
router.use(router$1);

const app = express();
app.use("/", router);
app.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message, data: err.data });
  }
  return next(err);
});

const PLAUSIBLE_API_KEY = process.env.PLAUSIBLE_API_KEY;
const PLAUSIBLE_SITE_ID = process.env.PLAUSIBLE_SITE_ID;
const PLAUSIBLE_BASE_URL = process.env.PLAUSIBLE_BASE_URL;
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${PLAUSIBLE_API_KEY}`
};
async function getDailyPageViews() {
  const totalViews = await getTotalPageViews();
  const prevDayViewsChangePercent = await getPrevDayViewsChangePercent();
  return {
    totalViews,
    prevDayViewsChangePercent
  };
}
async function getTotalPageViews() {
  const response = await fetch(
    `${PLAUSIBLE_BASE_URL}/v1/stats/aggregate?site_id=${PLAUSIBLE_SITE_ID}&metrics=pageviews`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PLAUSIBLE_API_KEY}`
      }
    }
  );
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const json = await response.json();
  return json.results.pageviews.value;
}
async function getPrevDayViewsChangePercent() {
  const today = /* @__PURE__ */ new Date();
  const yesterday = new Date(today.setDate(today.getDate() - 1)).toISOString().split("T")[0];
  const dayBeforeYesterday = new Date((/* @__PURE__ */ new Date()).setDate((/* @__PURE__ */ new Date()).getDate() - 2)).toISOString().split("T")[0];
  const pageViewsYesterday = await getPageviewsForDate(yesterday);
  const pageViewsDayBeforeYesterday = await getPageviewsForDate(dayBeforeYesterday);
  console.table({
    pageViewsYesterday,
    pageViewsDayBeforeYesterday,
    typeY: typeof pageViewsYesterday,
    typeDBY: typeof pageViewsDayBeforeYesterday
  });
  let change = 0;
  if (pageViewsYesterday === 0 || pageViewsDayBeforeYesterday === 0) {
    return "0";
  } else {
    change = (pageViewsYesterday - pageViewsDayBeforeYesterday) / pageViewsDayBeforeYesterday * 100;
  }
  return change.toFixed(0);
}
async function getPageviewsForDate(date) {
  const url = `${PLAUSIBLE_BASE_URL}/v1/stats/aggregate?site_id=${PLAUSIBLE_SITE_ID}&period=day&date=${date}&metrics=pageviews`;
  const response = await fetch(url, {
    method: "GET",
    headers
  });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const data = await response.json();
  return data.results.pageviews.value;
}
async function getSources() {
  const url = `${PLAUSIBLE_BASE_URL}/v1/stats/breakdown?site_id=${PLAUSIBLE_SITE_ID}&property=visit:source&metrics=visitors`;
  const response = await fetch(url, {
    method: "GET",
    headers
  });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const data = await response.json();
  return data.results;
}

const calculateDailyStats = async (_args, context) => {
  const nowUTC = new Date(Date.now());
  nowUTC.setUTCHours(0, 0, 0, 0);
  const yesterdayUTC = new Date(nowUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);
  try {
    const yesterdaysStats = await context.entities.DailyStats.findFirst({
      where: {
        date: {
          equals: yesterdayUTC
        }
      }
    });
    const userCount = await context.entities.User.count({});
    const paidUserCount = await context.entities.User.count({
      where: {
        subscriptionStatus: "active"
      }
    });
    let userDelta = userCount;
    let paidUserDelta = paidUserCount;
    if (yesterdaysStats) {
      userDelta -= yesterdaysStats.userCount;
      paidUserDelta -= yesterdaysStats.paidUserCount;
    }
    let totalRevenue;
    switch (paymentProcessor.id) {
      case "stripe":
        totalRevenue = await fetchTotalStripeRevenue();
        break;
      case "lemonsqueezy":
        totalRevenue = await fetchTotalLemonSqueezyRevenue();
        break;
      default:
        throw new Error(`Unsupported payment processor: ${paymentProcessor.id}`);
    }
    const { totalViews, prevDayViewsChangePercent } = await getDailyPageViews();
    let dailyStats = await context.entities.DailyStats.findUnique({
      where: {
        date: nowUTC
      }
    });
    if (!dailyStats) {
      console.log("No daily stat found for today, creating one...");
      dailyStats = await context.entities.DailyStats.create({
        data: {
          date: nowUTC,
          totalViews,
          prevDayViewsChangePercent,
          userCount,
          paidUserCount,
          userDelta,
          paidUserDelta,
          totalRevenue
        }
      });
    } else {
      console.log("Daily stat found for today, updating it...");
      dailyStats = await context.entities.DailyStats.update({
        where: {
          id: dailyStats.id
        },
        data: {
          totalViews,
          prevDayViewsChangePercent,
          userCount,
          paidUserCount,
          userDelta,
          paidUserDelta,
          totalRevenue
        }
      });
    }
    const sources = await getSources();
    for (const source of sources) {
      let visitors = source.visitors;
      if (typeof source.visitors !== "number") {
        visitors = parseInt(source.visitors);
      }
      await context.entities.PageViewSource.upsert({
        where: {
          date_name: {
            date: nowUTC,
            name: source.source
          }
        },
        create: {
          date: nowUTC,
          name: source.source,
          visitors,
          dailyStatsId: dailyStats.id
        },
        update: {
          visitors
        }
      });
    }
    console.table({ dailyStats });
  } catch (error) {
    console.error("Error calculating daily stats: ", error);
    await context.entities.Logs.create({
      data: {
        message: `Error calculating daily stats: ${error?.message}`,
        level: "job-error"
      }
    });
  }
};
async function fetchTotalStripeRevenue() {
  let totalRevenue = 0;
  let params = {
    limit: 100,
    // created: {
    //   gte: startTimestamp,
    //   lt: endTimestamp
    // },
    type: "charge"
  };
  let hasMore = true;
  while (hasMore) {
    const balanceTransactions = await stripe.balanceTransactions.list(params);
    for (const transaction of balanceTransactions.data) {
      if (transaction.type === "charge") {
        totalRevenue += transaction.amount;
      }
    }
    if (balanceTransactions.has_more) {
      params.starting_after = balanceTransactions.data[balanceTransactions.data.length - 1].id;
    } else {
      hasMore = false;
    }
  }
  return totalRevenue / 100;
}
async function fetchTotalLemonSqueezyRevenue() {
  try {
    let totalRevenue = 0;
    let hasNextPage = true;
    let currentPage = 1;
    while (hasNextPage) {
      const { data: response } = await listOrders({
        filter: {
          storeId: process.env.LEMONSQUEEZY_STORE_ID
        },
        page: {
          number: currentPage,
          size: 100
        }
      });
      if (response?.data) {
        for (const order of response.data) {
          totalRevenue += order.attributes.total;
        }
      }
      hasNextPage = !response?.meta?.page.lastPage;
      currentPage++;
    }
    return totalRevenue / 100;
  } catch (error) {
    console.error("Error fetching Lemon Squeezy revenue:", error);
    throw error;
  }
}

registerJob({
  job: dailyStatsJob,
  jobFn: calculateDailyStats
});

const emailToSend = {
  to: "",
  subject: "The SaaS App Newsletter",
  text: "Hey There! \n\nThis is just a newsletter that sends automatically via cron jobs",
  html: `<html lang="en">
          <head>
            <meta charset="UTF-8">
            <title>SaaS App Newsletter</title>
          </head>
          <body>
            <p>Hey There!</p>
            
            <p>This is just a newsletter that sends automatically via cron jobs</p>
          </body>
        </html>`
};
const checkAndQueueNewsletterEmails = async (_args, context) => {
  const currentDate = /* @__PURE__ */ new Date();
  const twoWeeksFromNow = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1e3);
  const users = await context.entities.User.findMany({
    where: {
      datePaid: {
        equals: twoWeeksFromNow
      },
      sendNewsletter: true
    }
  });
  if (users.length === 0) {
    return;
  }
  await Promise.allSettled(
    users.map(async (user) => {
      if (user.email) {
        try {
          emailToSend.to = user.email;
          await emailSender.send(emailToSend);
        } catch (error) {
          console.error("Error sending notice to user: ", user.id, error);
        }
      }
    })
  );
};

registerJob({
  job: sendNewsletter,
  jobFn: checkAndQueueNewsletterEmails
});

if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto;
}

const startServer = async () => {
  await startPgBoss();
  const port = normalizePort(config$1.port);
  app.set("port", port);
  const server = http.createServer(app);
  server.listen(port);
  server.on("error", (error) => {
    if (error.syscall !== "listen") throw error;
    const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
    switch (error.code) {
      case "EACCES":
        console.error(bind + " requires elevated privileges");
        process.exit(1);
      case "EADDRINUSE":
        console.error(bind + " is already in use");
        process.exit(1);
      default:
        throw error;
    }
  });
  server.on("listening", () => {
    const addr = server.address();
    const bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
    console.log("Server listening on " + bind);
  });
};
startServer().catch((e) => console.error(e));
function normalizePort(val) {
  const port = parseInt(val, 10);
  if (isNaN(port)) return val;
  if (port >= 0) return port;
  return false;
}
//# sourceMappingURL=server.js.map

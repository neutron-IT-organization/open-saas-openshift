import type { SubscriptionStatus } from '../plans';
import { PaymentPlanId } from '../plans';
import { PrismaClient } from '@prisma/client';
export declare const updateUserStripePaymentDetails: ({ userStripeId, subscriptionPlan, subscriptionStatus, datePaid, numOfCreditsPurchased }: {
    userStripeId: string;
    subscriptionPlan?: PaymentPlanId;
    subscriptionStatus?: SubscriptionStatus;
    numOfCreditsPurchased?: number;
    datePaid?: Date;
}, userDelegate: PrismaClient["user"]) => import(".prisma/client").Prisma.Prisma__UserClient<import("@prisma/client/runtime").GetResult<{
    id: string;
    createdAt: Date;
    email: string | null;
    username: string | null;
    lastActiveTimestamp: Date;
    isAdmin: boolean;
    paymentProcessorUserId: string | null;
    lemonSqueezyCustomerPortalUrl: string | null;
    checkoutSessionId: string | null;
    subscriptionStatus: string | null;
    subscriptionPlan: string | null;
    sendNewsletter: boolean;
    datePaid: Date | null;
    credits: number;
}, unknown> & {}, never, import("@prisma/client/runtime").DefaultArgs>;

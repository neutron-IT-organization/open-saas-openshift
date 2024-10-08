import { type MiddlewareConfigFn } from 'wasp/server';
import { type PaymentsWebhook } from 'wasp/server/api';
import { type PrismaClient } from '@prisma/client';
import { Stripe } from 'stripe';
export declare const stripeWebhook: PaymentsWebhook;
export declare const stripeMiddlewareConfigFn: MiddlewareConfigFn;
export declare function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, prismaUserDelegate: PrismaClient["user"]): Promise<import("@prisma/client/runtime").GetResult<{
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
}, unknown> & {}>;
export declare function handleInvoicePaid(invoice: Stripe.Invoice, prismaUserDelegate: PrismaClient["user"]): Promise<import("@prisma/client/runtime").GetResult<{
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
}, unknown> & {}>;
export declare function handleCustomerSubscriptionUpdated(subscription: Stripe.Subscription, prismaUserDelegate: PrismaClient["user"]): Promise<import("@prisma/client/runtime").GetResult<{
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
}, unknown> & {}>;
export declare function handleCustomerSubscriptionDeleted(subscription: Stripe.Subscription, prismaUserDelegate: PrismaClient["user"]): Promise<import("@prisma/client/runtime").GetResult<{
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
}, unknown> & {}>;

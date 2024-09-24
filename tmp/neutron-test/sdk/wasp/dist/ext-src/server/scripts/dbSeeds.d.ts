import type { PrismaClient } from '@prisma/client';
/**
 * This function, which we've imported in `app.db.seeds` in the `main.wasp` file,
 * seeds the database with mock users via the `wasp db seed` command.
 * For more info see: https://wasp-lang.dev/docs/data-model/backends#seeding-the-database
 */
export declare function seedMockUsers(prismaClient: PrismaClient): Promise<void>;

import { HttpError } from 'wasp/server';
export const getDailyStats = async (_args, context) => {
    var _a;
    if (!((_a = context.user) === null || _a === void 0 ? void 0 : _a.isAdmin)) {
        throw new HttpError(401);
    }
    const dailyStats = await context.entities.DailyStats.findFirstOrThrow({
        orderBy: {
            date: 'desc',
        },
        include: {
            sources: true,
        },
    });
    const weeklyStats = await context.entities.DailyStats.findMany({
        orderBy: {
            date: 'desc',
        },
        take: 7,
        include: {
            sources: true,
        },
    });
    return { dailyStats, weeklyStats };
};
//# sourceMappingURL=operations.js.map
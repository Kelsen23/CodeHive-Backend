const userResolvers = {
  Query: {
    getUserById: async (
      _: any,
      { id }: { id: string },
      { prisma, redisClient }: { prisma: any; redisClient: any },
    ) => {
      const cachedUser = await redisClient.get(`user:${id}`);

      if (cachedUser) return JSON.parse(cachedUser);

      const foundUser = await prisma.user.findUnique({ where: { id } });
      if (!foundUser) throw new Error("User not found");

      await redisClient.set(
        `user:${id}`,
        JSON.stringify(foundUser),
        "EX",
        60 * 60,
      );

      return foundUser;
    },
  },
};

export default userResolvers;

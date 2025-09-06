import HttpError from "../../utils/httpError.js";

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
      if (!foundUser) throw new HttpError("User not found", 404);

      const {
        password,
        profilePictureKey,
        otp,
        otpResendAvailableAt,
        otpExpireAt,
        resetPasswordOtp,
        resetPasswordOtpVerified,
        resetPasswordOtpResendAvailableAt,
        resetPasswordOtpExpireAt,
        ...userWithoutSensitiveInfo
      } = foundUser;

      await redisClient.set(
        `user:${id}`,
        JSON.stringify(userWithoutSensitiveInfo),
        "EX",
        60 * 60,
      );

      return userWithoutSensitiveInfo;
    },
  },
};

export default userResolvers;

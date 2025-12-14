import { redisClient } from "../config/redis.js";

const addUserSocket = async (userId: string, socketId: string) => {
  await redisClient.sadd(`online:users`, userId);
  await redisClient.sadd(`online:user:${userId}`, socketId);
  await redisClient.set(`socket:${socketId}`, userId);
};

const removeUserSocket = async (socketId: string) => {
  const userId = await redisClient.get(`socket:${socketId}`);

  if (userId) {
    await redisClient.srem(`online:user:${userId}`, socketId);

    const socketsLeft = await redisClient.scard(`online:user:${userId}`);

    if (socketsLeft === 0) {
      await redisClient.del(`online:user:${userId}`);
      await redisClient.srem(`online:users`, userId);
    }

    await redisClient.del(`socket:${socketId}`);
  }
};

const getUserSockets = async (userId: string) => {
  const sockets = await redisClient.smembers(`online:user:${userId}`);

  return sockets || [];
};

export { addUserSocket, removeUserSocket, getUserSockets };

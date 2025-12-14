import { io } from "../index.js";
import { getUserSockets } from "../../redis/presence.js";

const emitToUser = async (userId: string, event: string, data: any) => {
  if (!io) return;

  const socketIds = await getUserSockets(userId);

  socketIds.forEach((socketId) => {
    io.to(socketId).emit(event, data);
  });
};

export default emitToUser;

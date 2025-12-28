import { io } from "../index.js";
import { getUserSockets } from "../../redis/presence.js";
import { registerSubscriber } from "../../redis/pubsub.js";

const CHANNEL = "socket:emit";

const initSocketEmitSubscriber = () => {
  registerSubscriber(CHANNEL, async ({ userId, event, data }) => {
    const socketIds = await getUserSockets(userId);

    socketIds.forEach((socketId) => {
      io.to(socketId).emit(event, data);
    });
  });
};

export default initSocketEmitSubscriber;

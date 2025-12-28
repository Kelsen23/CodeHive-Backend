import { io } from "../index.js";
import { getUserSockets } from "../../redis/presence.js";
import { registerSubscriber } from "../../redis/pubsub.js";

const CHANNEL = "socket:disconnect";

const initSocketDisconnectSubscriber = () => {
  registerSubscriber(CHANNEL, async ({ userId }) => {
    const socketIds = await getUserSockets(userId);

    socketIds.forEach((socketId) => {
      io.sockets.sockets.get(socketId)?.disconnect(true);
    });
  });
};

export default initSocketDisconnectSubscriber;

import { redisPub } from "../redis/pubsub.js";

const publishSocketEvent = (userId: string, event: string, data: any) => {
  redisPub.publish("socket:emit", JSON.stringify({ userId, event, data }));
};

export default publishSocketEvent;

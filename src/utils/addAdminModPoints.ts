import { redisCacheClient } from "../config/redis.js";
import HttpError from "./httpError.js";

const MOD_POINTS = {
  BAN_USER_PERM: 10,
  BAN_USER_TEMP: 5,
  WARN_USER: 2,
  IGNORE: 1,
} as const;

const MOD_COOLDOWN_SECONDS = 120;
const MOD_LIMIT = 20;

async function addAdminModPoints(
  userId: string,
  actionTaken: keyof typeof MOD_POINTS,
) {
  const key = `admin:${userId}:mod_points`;
  const pointsToAdd = MOD_POINTS[actionTaken];

  const luaScript = `
    local current = redis.call("GET", KEYS[1])
    if not current then
      redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
      return ARGV[1]
    else
      local newVal = tonumber(current) + tonumber(ARGV[1])
      redis.call("SET", KEYS[1], newVal, "EX", redis.call("TTL", KEYS[1]))
      return newVal
    end
  `;

  const newPoints = await redisCacheClient.eval(
    luaScript,
    1,
    key,
    pointsToAdd,
    MOD_COOLDOWN_SECONDS,
  );

  if (Number(newPoints) > MOD_LIMIT) {
    throw new HttpError("Please slow down. Moderation cooldown active", 429);
  }

  return newPoints;
}

export default addAdminModPoints;

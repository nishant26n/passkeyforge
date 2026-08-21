import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }

  return {
    allowed: count <= limit,
    count,
    remaining: Math.max(0, limit - count),
  };
}

export async function checkAuthRateLimit(
  prefix: string,
  email: string,
  ip: string,
) {
  const [emailLimit, ipLimit] = await Promise.all([
    checkRateLimit(`${prefix}:email:${email}`, 5, 60),
    checkRateLimit(`${prefix}:ip:${ip}`, 20, 60),
  ]);

  return {
    allowed: emailLimit.allowed && ipLimit.allowed,
    emailLimit,
    ipLimit,
  };
}

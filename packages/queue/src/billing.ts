import type { Redis } from "ioredis";
import type { CaptureBilling } from "./service.js";

const RESERVE = "local expired=redis.call('ZRANGEBYSCORE', KEYS[2], 0, ARGV[1]); for _,id in ipairs(expired) do redis.call('HDEL', KEYS[3], id) end; redis.call('ZREMRANGEBYSCORE', KEYS[2], 0, ARGV[1]); if redis.call('ZSCORE', KEYS[2], ARGV[3]) then return 1 end; local balance=tonumber(redis.call('GET', KEYS[1]) or '0'); local held=0; for _,id in ipairs(redis.call('ZRANGE', KEYS[2], 0, -1)) do held=held+tonumber(redis.call('HGET', KEYS[3], id) or '1') end; local cost=tonumber(ARGV[4]); if balance-held<cost then return 0 end; redis.call('HSET', KEYS[3], ARGV[3], cost); redis.call('EXPIRE', KEYS[3], 86400); redis.call('ZADD', KEYS[2], ARGV[1]+ARGV[2], ARGV[3]); return 1";
const SETTLE = "local cost=tonumber(redis.call('HGET', KEYS[3], ARGV[1]) or '1'); local removed=redis.call('ZREM', KEYS[2], ARGV[1]); redis.call('HDEL', KEYS[3], ARGV[1]); if removed==1 and ARGV[2]=='1' then redis.call('DECRBY', KEYS[1], cost); end; return removed";

export function createRedisCaptureBilling(redis: Pick<Redis, "eval" | "set" | "get" | "del">): CaptureBilling {
  return {
    async reserveCapture(accountId, id, credits = 1) {
      if (!Number.isSafeInteger(credits) || credits < 1 || credits > 3) throw new Error("Invalid capture credit cost");
      await redis.set(`snapforge:reservation-account:${id}`, accountId, "EX", 86_400);
      return Number(await redis.eval(RESERVE, 3, `snapforge:credits:${accountId}`, `snapforge:reservations:${accountId}`, `snapforge:reservation-costs:${accountId}`, Date.now(), 86_400_000, id, credits)) === 1;
    },
    async linkReservationToJob(accountId, id, jobId) {
      await redis.set(`snapforge:job-reservation:${accountId}:${jobId}`, id, "EX", 86_400);
    },
    async reservationForJob(accountId, jobId) {
      return redis.get(`snapforge:job-reservation:${accountId}:${jobId}`);
    },
    async settleCapture(id, succeeded) {
      const accountId = await redis.get(`snapforge:reservation-account:${id}`);
      if (accountId) {
        await redis.eval(SETTLE, 3, `snapforge:credits:${accountId}`, `snapforge:reservations:${accountId}`, `snapforge:reservation-costs:${accountId}`, id, Number(succeeded));
        await redis.del(`snapforge:reservation-account:${id}`, `snapforge:job-reservation:${accountId}:${id}`);
      }
    },
    async recordCapture() {},
  };
}

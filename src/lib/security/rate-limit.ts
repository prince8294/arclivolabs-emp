import { createHash } from "node:crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import RateLimit from "@/models/RateLimit";

const WINDOW_MS = 15 * 60 * 1000;

export async function consumeRateLimit(bucket: string, subject: string, limit: number) {
  await connectToDatabase();
  const key = createHash("sha256").update(`${bucket}:${subject}`).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WINDOW_MS);

  const active = await RateLimit.findOneAndUpdate(
    { _id: key, expiresAt: { $gt: now } },
    { $inc: { attempts: 1 } },
    { new: true },
  ).lean();

  if (active) return active.attempts <= limit;

  try {
    const current = await RateLimit.findOneAndUpdate(
      { _id: key },
      { $set: { attempts: 1, expiresAt } },
      { upsert: true, new: true },
    ).select("attempts").lean();
    return Boolean(current && current.attempts <= limit);
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) throw error;
    const current = await RateLimit.findOneAndUpdate(
      { _id: key, expiresAt: { $gt: now } },
      { $inc: { attempts: 1 } },
      { new: true },
    ).select("attempts").lean();
    return Boolean(current && current.attempts <= limit);
  }
}

export async function isRateLimited(bucket: string, subject: string, limit: number) {
  await connectToDatabase();
  const key = createHash("sha256").update(`${bucket}:${subject}`).digest("hex");
  const current = await RateLimit.findOne({ _id: key, expiresAt: { $gt: new Date() } })
    .select("attempts")
    .lean();
  return Boolean(current && current.attempts >= limit);
}

export function getRequestAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return forwarded || real || "unknown";
}

import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "../src/lib/db/mongodb";
import User from "../src/models/User";

loadEnvConfig(process.cwd());

const bootstrapSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128).refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "password must be no more than 72 UTF-8 bytes",
  ),
  employeeId: z.string().trim().min(3).max(32),
});

async function main() {
  const parsed = bootstrapSchema.safeParse({
    name: process.env.BOOTSTRAP_ADMIN_NAME,
    email: process.env.BOOTSTRAP_ADMIN_EMAIL,
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    employeeId: process.env.BOOTSTRAP_ADMIN_EMPLOYEE_ID,
  });

  if (!parsed.success) {
    throw new Error(`Invalid bootstrap configuration: ${parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join("; ")}`);
  }

  await connectToDatabase();
  const normalizedEmail = parsed.data.email.toLowerCase();
  const existing = await User.findOne({
    $or: [{ email: normalizedEmail }, { employeeId: parsed.data.employeeId.toUpperCase() }],
  }).select("_id email employeeId").lean();

  if (existing) {
    throw new Error("An account already uses this email address or employee ID; no changes were made.");
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await User.create({
    employeeId: parsed.data.employeeId,
    fullName: parsed.data.name,
    email: normalizedEmail,
    passwordHash,
    role: "admin",
    designation: "Super Admin",
    status: "active",
  });

  console.log(`Super Admin account created for ${normalizedEmail}.`);
}

main()
  .catch((error: unknown) => {
    console.error("Super Admin bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

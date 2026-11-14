import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { credentialsSchema } from "@/lib/auth/validation";
import { employeeRoles } from "@/types/employee";
import { consumeRateLimit, isRateLimited } from "@/lib/security/rate-limit";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const forwardedAddress = request.headers?.["x-forwarded-for"] ?? request.headers?.["x-real-ip"];
        const address = Array.isArray(forwardedAddress)
          ? forwardedAddress[0]?.split(",")[0]?.trim() ?? "unknown"
          : forwardedAddress?.split(",")[0]?.trim() ?? "unknown";
        const email = parsed.data.email.toLowerCase();
        if (
          await isRateLimited("login-email", email, 10)
          || (address !== "unknown" && await isRateLimited("login-address", address, 50))
        ) return null;

        await connectToDatabase();
        const user = await User.findOne({ email })
          .select("+passwordHash")
          .exec();
        if (!user || user.status !== "active" || !user.passwordHash) {
          await Promise.all([
            consumeRateLimit("login-email", email, 10),
            ...(address === "unknown" ? [] : [consumeRateLimit("login-address", address, 50)]),
          ]);
          return null;
        }
        const role = employeeRoles.find((candidate) => candidate === user.role);
        if (!role) return null;

        const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordMatches) {
          await Promise.all([
            consumeRateLimit("login-email", email, 10),
            ...(address === "unknown" ? [] : [consumeRateLimit("login-address", address, 50)]),
          ]);
          return null;
        }
        user.lastLoginAt = new Date();
        await user.save();

        return {
          id: user.id,
          name: user.fullName,
          email: user.email,
          role,
          authVersion: user.authVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.authVersion = user.authVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role ?? "developer";
        session.user.authVersion = token.authVersion ?? 0;
      }
      return session;
    },
  },
};

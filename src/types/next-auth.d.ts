import type { DefaultSession } from "next-auth";
import type { EmployeeRole } from "@/types/employee";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: EmployeeRole;
      authVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    role: EmployeeRole;
    authVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: EmployeeRole;
    authVersion?: number;
  }
}

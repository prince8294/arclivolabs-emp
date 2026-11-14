import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth/authorization";

export default async function HomePage() {
  const session = await getActiveSession();
  if (!session) redirect("/login");
  redirect(session.user.role === "admin" ? "/admin/dashboard" : "/employee/dashboard");
}

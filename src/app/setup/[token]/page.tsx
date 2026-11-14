import type { Metadata } from "next";
import { SetupForm } from "@/components/auth/setup-form";

export const metadata: Metadata = { title: "Set up your account" };

export default async function AccountSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="flex min-h-screen items-center justify-center px-4 py-10"><SetupForm token={token} /></main>;
}

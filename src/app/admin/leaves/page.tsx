import type { Metadata } from "next";
import { AdminLeaves } from "@/components/admin/admin-leaves";

export const metadata: Metadata = { title: "Leave requests" };

export default function AdminLeavesPage() {
  return <AdminLeaves />;
}

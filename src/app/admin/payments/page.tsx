import type { Metadata } from "next";
import { AdminPaymentManager } from "@/components/admin/admin-payment-manager";

export const metadata: Metadata = { title: "Payments & incentives" };

export default function AdminPaymentsPage() {
  return <AdminPaymentManager />;
}

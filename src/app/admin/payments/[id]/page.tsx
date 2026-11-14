import type { Metadata } from "next";
import { PaymentDetails } from "@/components/hr/payment-details";

export const metadata: Metadata = { title: "Payment details" };

export default async function AdminPaymentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentDetails paymentId={id} admin />;
}

import type { Metadata } from "next";
import { EmployeeEarnings } from "@/components/employee/employee-earnings";

export const metadata: Metadata = { title: "My earnings" };

export default function EmployeeEarningsPage() {
  return <EmployeeEarnings />;
}

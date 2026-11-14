import type { Metadata } from "next";
import { EmployeeActivityDetail } from "@/components/admin/employee-activity-detail";

export const metadata: Metadata = { title: "Employee activity details" };

export default async function AdminEmployeeActivityPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  return <EmployeeActivityDetail employeeId={employeeId} />;
}

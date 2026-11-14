import type { Metadata } from "next";
import { EmployeeActivityDashboard } from "@/components/employee/activity-dashboard";

export const metadata: Metadata = { title: "Work activity" };

export default function EmployeeActivityPage() {
  return <EmployeeActivityDashboard />;
}

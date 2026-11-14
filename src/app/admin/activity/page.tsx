import type { Metadata } from "next";
import { AdminActivityDashboard } from "@/components/admin/activity-dashboard";
import { ActivityAttendanceNav } from "@/components/admin/activity-attendance-nav";

export const metadata: Metadata = { title: "Activity & attendance" };

export default function AdminActivityPage() {
  return <><ActivityAttendanceNav /><AdminActivityDashboard /></>;
}

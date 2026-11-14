import type { Metadata } from "next";
import { AdminAttendance } from "@/components/admin/admin-attendance";
import { ActivityAttendanceNav } from "@/components/admin/activity-attendance-nav";

export const metadata: Metadata = { title: "Attendance" };

export default function AdminAttendancePage() {
  return <><ActivityAttendanceNav /><AdminAttendance /></>;
}

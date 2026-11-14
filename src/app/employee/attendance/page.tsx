import type { Metadata } from "next";
import { EmployeeAttendance } from "@/components/employee/employee-attendance";

export const metadata: Metadata = { title: "Attendance & leave" };

export default function EmployeeAttendancePage() {
  return <EmployeeAttendance />;
}

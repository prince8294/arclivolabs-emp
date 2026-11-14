import type { Metadata } from "next";
import { EmployeeAnnouncements } from "@/components/employee/employee-announcements";

export const metadata: Metadata = { title: "Announcements" };

export default function EmployeeAnnouncementsPage() {
  return <EmployeeAnnouncements />;
}

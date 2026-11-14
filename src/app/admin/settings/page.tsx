import type { Metadata } from "next";
import { EmployeeSettings } from "@/components/admin/employee-settings";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return <EmployeeSettings />;
}

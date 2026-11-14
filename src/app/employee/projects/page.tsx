import type { Metadata } from "next";
import { EmployeeProjectList } from "@/components/employee/project-list";

export const metadata: Metadata = { title: "My projects" };

export default function EmployeeProjectsPage() {
  return <EmployeeProjectList />;
}

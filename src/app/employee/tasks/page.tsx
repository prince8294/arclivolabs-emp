import type { Metadata } from "next";
import { EmployeeTaskList } from "@/components/employee/task-list";

export const metadata: Metadata = { title: "My tasks" };

export default function EmployeeTasksPage() {
  return <EmployeeTaskList />;
}

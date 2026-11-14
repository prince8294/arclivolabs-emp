import type { Metadata } from "next";
import { EmployeeForm } from "@/components/admin/employee-form";

export const metadata: Metadata = { title: "Add employee" };

export default function NewEmployeePage() {
  return <EmployeeForm />;
}

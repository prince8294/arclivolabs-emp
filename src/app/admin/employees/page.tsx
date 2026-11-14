import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { EmployeeList } from "@/components/admin/employee-list";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Employee management" };

export default function EmployeesPage() {
  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <PageHeading title="Employee management" description="Manage Developer and Designer accounts in your team." />
        <Link href="/admin/employees/new" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/15 transition-colors hover:bg-violet-500">
          <Plus size={16} /> Add employee
        </Link>
      </div>
      <EmployeeList />
    </>
  );
}

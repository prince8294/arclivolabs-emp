import type { Metadata } from "next";
import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { EmployeeProjectDetail } from "@/components/employee/project-detail";

export const metadata: Metadata = { title: "Project details" };

export default async function EmployeeProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  return <EmployeeProjectDetail id={id} />;
}

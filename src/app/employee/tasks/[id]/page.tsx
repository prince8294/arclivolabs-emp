import type { Metadata } from "next";
import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { EmployeeTaskDetail } from "@/components/employee/task-detail";

export const metadata: Metadata = { title: "Task details" };

export default async function EmployeeTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  return <EmployeeTaskDetail id={id} />;
}

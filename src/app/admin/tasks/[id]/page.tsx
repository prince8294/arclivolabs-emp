import type { Metadata } from "next";
import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { AdminTaskDetail } from "@/components/admin/task-detail";

export const metadata: Metadata = { title: "Task details" };

export default async function AdminTaskDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  const { notice } = await searchParams;
  return <AdminTaskDetail id={id} initialNotice={notice?.slice(0, 300)} />;
}

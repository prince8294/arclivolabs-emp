import type { Metadata } from "next";
import { TaskList } from "@/components/admin/task-list";

export const metadata: Metadata = { title: "Task management" };

export default async function AdminTasksPage({ searchParams }: { searchParams: Promise<{ status?: string; notice?: string }> }) {
  const { status, notice } = await searchParams;
  return <TaskList initialStatus={status} initialNotice={notice?.slice(0, 300)} />;
}

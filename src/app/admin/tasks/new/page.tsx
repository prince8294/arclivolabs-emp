import type { Metadata } from "next";
import { TaskForm } from "@/components/admin/task-form";

export const metadata: Metadata = { title: "Create task" };

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  return <TaskForm initialProjectId={project} />;
}

import type { Metadata } from "next";
import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { TaskForm, type TaskFormData } from "@/components/admin/task-form";
import { connectToDatabase } from "@/lib/db/mongodb";
import Task from "@/models/Task";

export const metadata: Metadata = { title: "Edit task" };

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectToDatabase();
  const task = await Task.findOne({ _id: id, archivedAt: null })
    .select("taskId project title description assignedTo priority status dueDate startDate instructions acceptanceCriteria")
    .lean();
  if (!task) notFound();
  const initial: TaskFormData = {
    _id: String(task._id),
    project: String(task.project),
    title: task.title,
    description: task.description,
    assignedTo: String(task.assignedTo),
    priority: task.priority,
    dueDate: new Date(task.dueDate).toISOString(),
    startDate: task.startDate ? new Date(task.startDate).toISOString() : "",
    instructions: task.instructions,
    acceptanceCriteria: task.acceptanceCriteria,
  };
  return <TaskForm task={initial} />;
}

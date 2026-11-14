import type { Metadata } from "next";
import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { ProjectForm, type ProjectFormData } from "@/components/admin/project-form";
import { connectToDatabase } from "@/lib/db/mongodb";
import Project from "@/models/Project";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectToDatabase();
  const project = await Project.findOne({ _id: id, archivedAt: null })
    .select("projectId name description type priority status assignedEmployees startDate deadline technologies githubUrl figmaUrl notes")
    .lean();
  if (!project) notFound();

  const initial: ProjectFormData = {
    _id: String(project._id),
    name: project.name,
    description: project.description,
    type: project.type,
    priority: project.priority,
    status: project.status,
    assignedEmployees: project.assignedEmployees.map(String),
    startDate: new Date(project.startDate).toISOString(),
    deadline: new Date(project.deadline).toISOString(),
    technologies: project.technologies,
    githubUrl: project.githubUrl,
    figmaUrl: project.figmaUrl,
    notes: project.notes,
  };
  return <ProjectForm project={initial} />;
}

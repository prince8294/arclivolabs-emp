import type { Metadata } from "next";
import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/admin/project-detail";

export const metadata: Metadata = { title: "Project details" };

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  return <ProjectDetail id={id} />;
}

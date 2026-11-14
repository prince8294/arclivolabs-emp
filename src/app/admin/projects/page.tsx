import type { Metadata } from "next";
import { ProjectList } from "@/components/admin/project-list";

export const metadata: Metadata = { title: "Projects" };

export default function AdminProjectsPage() {
  return <ProjectList />;
}

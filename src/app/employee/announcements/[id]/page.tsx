import type { Metadata } from "next";
import { EmployeeAnnouncementDetail } from "@/components/employee/employee-announcement-detail";

export const metadata: Metadata = { title: "Announcement" };

export default async function EmployeeAnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeAnnouncementDetail id={id} />;
}

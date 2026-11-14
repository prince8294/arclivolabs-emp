import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeading } from "@/components/ui/page-heading";
import { adminNavigation } from "@/lib/navigation";

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const item = adminNavigation.find((entry) => entry.href === `/admin/${section}`);
  if (!item || item.available) notFound();

  return (
    <>
      <PageHeading title={item.label} description="This area is part of the ArclivoLabs internal employee workspace." />
      <EmptyState
        title={`${item.label} is not available yet`}
        description="This module is planned for a later phase. No placeholder records or sample data are displayed."
        icon={item.icon}
      />
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfilePanel } from "@/components/employee/profile-panel";
import { PageHeading } from "@/components/ui/page-heading";
import { requireRole } from "@/lib/auth/authorization";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export const metadata: Metadata = { title: "My profile" };

export default async function EmployeeProfilePage() {
  const session = await requireRole(["developer", "designer"]);
  await connectToDatabase();
  const profile = await User.findOne({ _id: session.user.id, role: { $in: ["developer", "designer"] }, status: "active" })
    .select("employeeId fullName email role designation profilePicture phoneNumber skills employmentType joiningDate status")
    .lean();
  if (!profile) notFound();

  return (
    <>
      <PageHeading title="My profile" description="Review your employee information and manage your sign-in details." />
      <ProfilePanel profile={{
        employeeId: profile.employeeId,
        fullName: profile.fullName,
        email: profile.email,
        role: profile.role,
        designation: profile.designation,
        profilePicture: profile.profilePicture,
        phoneNumber: profile.phoneNumber,
        skills: profile.skills,
        employmentType: profile.employmentType,
        joiningDate: profile.joiningDate.toISOString(),
        status: profile.status,
      }} />
    </>
  );
}

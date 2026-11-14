import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { EmployeeForm, type EmployeeFormData } from "@/components/admin/employee-form";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export const metadata: Metadata = { title: "Edit employee" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const employee = await User.findOne({ _id: id, role: { $in: ["developer", "designer"] } })
    .select("fullName email role designation joiningDate phoneNumber profilePicture skills employmentType internalNotes")
    .lean();
  if (!employee) notFound();

  return (
    <EmployeeForm
      employee={{
        _id: String(employee._id),
        fullName: employee.fullName,
        email: employee.email,
        role: employee.role,
        designation: employee.designation,
        joiningDate: employee.joiningDate.toISOString(),
        phoneNumber: employee.phoneNumber,
        profilePicture: employee.profilePicture,
        skills: employee.skills,
        employmentType: employee.employmentType,
        internalNotes: employee.internalNotes,
      } satisfies EmployeeFormData}
    />
  );
}

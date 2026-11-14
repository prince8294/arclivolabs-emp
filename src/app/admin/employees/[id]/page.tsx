import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Clock3, FileText, UserRound } from "lucide-react";
import { EmployeeActions } from "@/components/admin/employee-actions";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { PageHeading } from "@/components/ui/page-heading";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";

export const metadata: Metadata = { title: "Employee details" };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const employee = await User.findOne({ _id: id, role: { $in: ["developer", "designer"] } })
    .select("employeeId fullName email role designation profilePicture phoneNumber skills employmentType joiningDate status createdAt lastLoginAt internalNotes accountSetupCompleted")
    .lean();
  if (!employee) notFound();

  const sections = [
    {
      title: "Personal information",
      icon: UserRound,
      rows: [
        ["Name", employee.fullName],
        ["Email", employee.email],
        ["Phone", employee.phoneNumber || "Not provided"],
        ["Joining date", new Date(employee.joiningDate).toLocaleDateString()],
        ["Employment type", employee.employmentType.replace("_", " ")],
      ],
    },
    {
      title: "Professional information",
      icon: BriefcaseBusiness,
      rows: [
        ["Role", employee.role === "developer" ? "Web Developer" : "Designer"],
        ["Designation", employee.designation || "Not provided"],
        ["Skills", employee.skills.length ? employee.skills.join(", ") : "Not provided"],
        ["Account status", <StatusBadge key="status" status={employee.status} />],
      ],
    },
    {
      title: "Account information",
      icon: CalendarDays,
      rows: [
        ["Employee ID", <span key="id" className="font-mono">{employee.employeeId}</span>],
        ["Account created", new Date(employee.createdAt).toLocaleDateString()],
        ["Last login", employee.lastLoginAt ? new Date(employee.lastLoginAt).toLocaleString() : "No sign-in recorded"],
      ],
    },
  ];

  return (
    <>
      <Link href="/admin/employees" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} /> All employees</Link>
      <div className="mb-7 flex flex-col gap-5 rounded-2xl border border-white/6 bg-panel p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar name={employee.fullName} src={employee.profilePicture} className="size-14 text-base" />
          <div className="min-w-0">
            <PageHeading title={employee.fullName} description={`${employee.email} · ${employee.employeeId}`} />
            <div className="flex flex-wrap items-center gap-2"><RoleBadge role={employee.role} /><StatusBadge status={employee.status} /></div>
          </div>
        </div>
        <EmployeeActions
          id={String(employee._id)}
          name={employee.fullName}
          employeeId={employee.employeeId}
          status={employee.status}
          accountSetupCompleted={employee.accountSetupCompleted ?? employee.status !== "pending_setup"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {sections.map(({ title, icon: Icon, rows }) => (
          <DashboardCard key={title}>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-violet-200"><Icon size={17} /></span>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
            </div>
            <dl className="space-y-4">
              {rows.map(([label, value]) => (
                <div key={String(label)} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-sm">
                  <dt className="text-slate-500">{label}</dt><dd className="wrap-break-word text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
            {title === "Professional information" && employee.internalNotes && (
              <div className="mt-5 border-t border-white/6 pt-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400"><FileText size={14} /> Internal notes</p>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{employee.internalNotes}</p>
              </div>
            )}
          </DashboardCard>
        ))}
        <DashboardCard className="border-dashed bg-white/1.5 xl:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-slate-400"><Clock3 size={17} /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Future employee insights</h2>
              <p className="mt-1 text-xs text-slate-500">Task statistics, attendance, work activity, and earnings will be available in later phases.</p>
            </div>
          </div>
        </DashboardCard>
      </div>
    </>
  );
}

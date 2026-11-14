"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, Pencil, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { RoleBadge } from "@/components/ui/role-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { AccountStatus, EmployeeRole } from "@/types/employee";

interface EmployeeListItem {
  _id: string;
  employeeId: string;
  fullName: string;
  email: string;
  role: EmployeeRole;
  profilePicture?: string;
  joiningDate: string;
  status: AccountStatus;
}

interface ListResponse {
  employees: EmployeeListItem[];
  pagination: { page: number; pages: number; total: number };
}

export function EmployeeList() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingStatus, setPendingStatus] = useState<EmployeeListItem | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadEmployees = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q: query, role, status, sort, page: String(page), limit: "10" });
    try {
      const response = await fetch(`/api/admin/employees?${params}`, { signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load employees.");
      setData(result as ListResponse);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Could not load employees.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, query, role, sort, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadEmployees(controller.signal), 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadEmployees]);

  async function changeStatus() {
    if (!pendingStatus) return;
    setSavingStatus(true);
    try {
      const newStatus = pendingStatus.status === "active" ? "inactive" : "active";
      const response = await fetch(`/api/admin/employees/${pendingStatus._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not update account status.");
      setPendingStatus(null);
      await loadEmployees();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update account status.");
    } finally {
      setSavingStatus(false);
    }
  }

  function setFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <>
      <DashboardCard className="mb-5 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_170px_150px]">
          <label className="relative block">
            <span className="sr-only">Search employees</span>
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setFilter(setQuery, event.target.value)}
              placeholder="Search name, email or ID"
              className="h-11 w-full rounded-xl border border-white/10 bg-[#111827] pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent"
            />
          </label>
          <select aria-label="Filter by role" value={role} onChange={(event) => setFilter(setRole, event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-slate-200 outline-none focus:border-accent">
            <option value="">All roles</option>
            <option value="developer">Developers</option>
            <option value="designer">Designers</option>
          </select>
          <select aria-label="Filter by account status" value={status} onChange={(event) => setFilter(setStatus, event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-slate-200 outline-none focus:border-accent">
            <option value="">All statuses</option>
            <option value="pending_setup">Pending setup</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select aria-label="Sort by joining date" value={sort} onChange={(event) => setFilter(setSort, event.target.value)} className="h-11 rounded-xl border border-white/10 bg-[#111827] px-3 text-sm text-slate-200 outline-none focus:border-accent">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </DashboardCard>

      {error && <p role="alert" className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200">{error}</p>}

      {loading && !data ? (
        <DashboardCard><p className="py-12 text-center text-sm text-slate-400">Loading employees…</p></DashboardCard>
      ) : data?.employees.length ? (
        <>
          <DashboardCard className="hidden overflow-hidden p-0 md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b border-white/[0.06] bg-white/[0.02]">
                  <tr>{["Employee", "Employee ID", "Role", "Joining date", "Status", "Actions"].map((heading) => <th key={heading} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{heading}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {data.employees.map((employee) => (
                    <tr key={employee._id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={employee.fullName} src={employee.profilePicture} className="size-10 text-xs" />
                          <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-100">{employee.fullName}</p><p className="mt-1 truncate text-xs text-slate-500">{employee.email}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-300">{employee.employeeId}</td>
                      <td className="px-5 py-4"><RoleBadge role={employee.role} /></td>
                      <td className="px-5 py-4 text-sm text-slate-400">{new Date(employee.joiningDate).toLocaleDateString()}</td>
                      <td className="px-5 py-4"><StatusBadge status={employee.status} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Link aria-label={`View ${employee.fullName}`} href={`/admin/employees/${employee._id}`} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><Eye size={16} /></Link>
                          <Link aria-label={`Edit ${employee.fullName}`} href={`/admin/employees/${employee._id}/edit`} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06] hover:text-white"><Pencil size={15} /></Link>
                          {employee.status !== "pending_setup" && (
                            <button type="button" aria-label={`${employee.status === "active" ? "Deactivate" : "Activate"} ${employee.fullName}`} onClick={() => setPendingStatus(employee)} className="rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/[0.06] hover:text-white">
                              {employee.status === "active" ? "Deactivate" : "Activate"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardCard>
          <div className="space-y-3 md:hidden">
            {data.employees.map((employee) => (
              <DashboardCard key={employee._id} className="p-4">
                <div className="flex items-start gap-3">
                  <UserAvatar name={employee.fullName} src={employee.profilePicture} className="size-11 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{employee.fullName}</p>
                    <p className="mt-1 truncate text-xs text-slate-400">{employee.email}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">{employee.employeeId}</p>
                  </div>
                  <StatusBadge status={employee.status} />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                  <div className="flex items-center gap-3"><RoleBadge role={employee.role} /><span className="text-xs text-slate-500">{new Date(employee.joiningDate).toLocaleDateString()}</span></div>
                  <div className="flex gap-1">
                    <Link href={`/admin/employees/${employee._id}`} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06]"><Eye size={16} /></Link>
                    <Link href={`/admin/employees/${employee._id}/edit`} className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.06]"><Pencil size={15} /></Link>
                    {employee.status !== "pending_setup" && <button type="button" onClick={() => setPendingStatus(employee)} className="px-2 text-xs text-slate-400">{employee.status === "active" ? "Deactivate" : "Activate"}</button>}
                  </div>
                </div>
              </DashboardCard>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>{data.pagination.total} employee{data.pagination.total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="px-1">{page} / {Math.max(1, data.pagination.pages)}</span>
              <Button variant="secondary" size="sm" disabled={page >= data.pagination.pages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          title={query || role || status ? "No matching employees" : "No employees yet"}
          description={query || role || status ? "Try changing the search or filters." : "Create a Developer or Designer account to get started."}
          icon={Users}
        />
      )}

      <ConfirmationDialog
        open={Boolean(pendingStatus)}
        title={pendingStatus?.status === "active" ? "Deactivate employee?" : "Activate employee?"}
        description={pendingStatus?.status === "active"
          ? `${pendingStatus.fullName} will be signed out and will no longer be able to access the employee portal.`
          : `${pendingStatus?.fullName} will be able to sign in to the employee portal.`}
        confirmLabel={savingStatus ? "Updating…" : pendingStatus?.status === "active" ? "Deactivate" : "Activate"}
        onCancel={() => { if (!savingStatus) setPendingStatus(null); }}
        onConfirm={() => void changeStatus()}
      />
    </>
  );
}

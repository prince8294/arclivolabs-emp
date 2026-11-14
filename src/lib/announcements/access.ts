import type { EmployeeRole } from "@/types/employee";

export function employeeAnnouncementFilter(employeeId: string, role: EmployeeRole, now = new Date()) {
  const audience = role === "developer" ? "developers" : "designers";
  return {
    status: "published",
    publishAt: { $lte: now },
    $and: [
      { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ audience: "all_employees" }, { audience }, { audience: "selected_employees", selectedEmployees: employeeId }] },
    ],
  };
}

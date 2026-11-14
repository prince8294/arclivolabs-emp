export const employeeRoles = ["admin", "developer", "designer"] as const;

export type EmployeeRole = (typeof employeeRoles)[number];
export type AccountStatus = "pending_setup" | "active" | "inactive";
export type EmploymentType = "full_time" | "part_time" | "intern";

export interface EmployeeIdentity {
  id: string;
  name: string;
  email: string;
  role: EmployeeRole;
}

export const roleLabels: Record<EmployeeRole, string> = {
  admin: "Super Admin",
  developer: "Web Developer",
  designer: "Designer",
};

export const statusLabels: Record<AccountStatus, string> = {
  pending_setup: "Pending setup",
  active: "Active",
  inactive: "Inactive",
};

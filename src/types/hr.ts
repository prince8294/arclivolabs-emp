export const leaveTypes = ["casual", "sick", "unpaid", "other"] as const;
export const leaveStatuses = ["pending", "approved", "rejected", "cancelled"] as const;
export const attendanceCorrectionStatuses = ["pending", "approved", "rejected"] as const;
export const compensationTypes = ["monthly_fixed", "monthly_part_time", "internship_stipend"] as const;
export const incentiveStatuses = ["pending", "approved", "cancelled"] as const;
export const paymentStatuses = ["draft", "approved", "paid"] as const;
export const paymentMethods = ["bank_transfer", "upi", "cash", "other"] as const;

export type LeaveType = (typeof leaveTypes)[number];
export type LeaveStatus = (typeof leaveStatuses)[number];
export type AttendanceCorrectionStatus = (typeof attendanceCorrectionStatuses)[number];
export type CompensationType = (typeof compensationTypes)[number];
export type IncentiveStatus = (typeof incentiveStatuses)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type PaymentMethod = (typeof paymentMethods)[number];

export const leaveTypeLabels: Record<LeaveType, string> = {
  casual: "Casual Leave",
  sick: "Sick Leave",
  unpaid: "Unpaid Leave",
  other: "Other",
};

export const leaveStatusLabels: Record<LeaveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const compensationTypeLabels: Record<CompensationType, string> = {
  monthly_fixed: "Monthly Fixed Pay",
  monthly_part_time: "Monthly Part-Time Pay",
  internship_stipend: "Internship Stipend",
};

export const incentiveStatusLabels: Record<IncentiveStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  cancelled: "Cancelled",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: "Bank Transfer",
  upi: "UPI",
  cash: "Cash",
  other: "Other",
};

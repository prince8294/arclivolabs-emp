import PortalSettings from "@/models/PortalSettings";
import User from "@/models/User";
import { getEmployeeSettings } from "@/lib/employees/settings";

export async function generateEmployeeId() {
  await getEmployeeSettings();

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const result = await PortalSettings.findOneAndUpdate(
      { key: "employee" },
      { $inc: { nextEmployeeNumber: 1 } },
      { new: true },
    ).lean();
    if (!result) throw new Error("Unable to allocate an employee ID.");
    const number = result.nextEmployeeNumber - 1;
    const employeeId = `${result.employeeIdPrefix}-${String(number).padStart(4, "0")}`;
    if (!(await User.exists({ employeeId }))) return employeeId;
  }
  throw new Error("Unable to allocate a unique employee ID.");
}

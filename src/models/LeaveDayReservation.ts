import { model, models, Schema, type InferSchemaType } from "mongoose";

const leaveDayReservationSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
    leaveRequest: { type: Schema.Types.ObjectId, ref: "LeaveRequest", required: true },
  },
  { timestamps: true, versionKey: false },
);

leaveDayReservationSchema.index({ employee: 1, date: 1 }, { unique: true });
leaveDayReservationSchema.index({ leaveRequest: 1 });

export type LeaveDayReservationDocument = InferSchemaType<typeof leaveDayReservationSchema>;
const LeaveDayReservation = models.LeaveDayReservation || model("LeaveDayReservation", leaveDayReservationSchema);
export default LeaveDayReservation;

import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  isActive: boolean;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"], required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);



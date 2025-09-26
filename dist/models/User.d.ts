import { Document, Model } from "mongoose";
export type UserRole = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";
export interface IUser extends Document {
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    isActive: boolean;
}
export declare const User: Model<IUser>;
//# sourceMappingURL=User.d.ts.map
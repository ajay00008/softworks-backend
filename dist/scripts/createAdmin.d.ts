import mongoose from "mongoose";
declare function createAdminUser(email: string, password: string, name: string): Promise<{
    success: boolean;
    message: string;
    user: mongoose.Document<unknown, {}, import("../models/User").IUser, {}, {}> & import("../models/User").IUser & Required<{
        _id: unknown;
    }> & {
        __v: number;
    };
    error?: never;
} | {
    success: boolean;
    message: string;
    user: {
        id: unknown;
        email: string;
        name: string;
        role: import("../models/User").UserRole;
    };
    error?: never;
} | {
    success: boolean;
    message: string;
    error: any;
    user?: never;
}>;
export { createAdminUser };
//# sourceMappingURL=createAdmin.d.ts.map
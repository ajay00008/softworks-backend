import mongoose, { Document, Model } from "mongoose";
export type AccessLevel = "READ_ONLY" | "READ_WRITE" | "FULL_ACCESS";
export interface IStaffAccess extends Document {
    staffId: mongoose.Types.ObjectId;
    assignedBy: mongoose.Types.ObjectId;
    classAccess: {
        classId: mongoose.Types.ObjectId;
        className: string;
        accessLevel: AccessLevel;
        canUploadSheets: boolean;
        canMarkAbsent: boolean;
        canMarkMissing: boolean;
        canOverrideAI: boolean;
    }[];
    subjectAccess: {
        subjectId: mongoose.Types.ObjectId;
        subjectName: string;
        accessLevel: AccessLevel;
        canCreateQuestions: boolean;
        canUploadSyllabus: boolean;
    }[];
    globalPermissions: {
        canViewAllClasses: boolean;
        canViewAllSubjects: boolean;
        canAccessAnalytics: boolean;
        canPrintReports: boolean;
        canSendNotifications: boolean;
    };
    isActive: boolean;
    expiresAt?: Date;
    notes?: string;
}
export declare const StaffAccess: Model<IStaffAccess>;
//# sourceMappingURL=StaffAccess.d.ts.map
import mongoose, { Schema, Document, Model } from "mongoose";
const StaffAccessSchema = new Schema({
    staffId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    assignedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    classAccess: [{
            classId: {
                type: Schema.Types.ObjectId,
                ref: "Class",
                required: true
            },
            className: {
                type: String,
                required: true,
                trim: true
            },
            accessLevel: {
                type: String,
                enum: ["READ_ONLY", "READ_WRITE", "FULL_ACCESS"],
                required: true
            },
            canUploadSheets: {
                type: Boolean,
                default: true
            },
            canMarkAbsent: {
                type: Boolean,
                default: true
            },
            canMarkMissing: {
                type: Boolean,
                default: true
            },
            canOverrideAI: {
                type: Boolean,
                default: false
            }
        }],
    subjectAccess: [{
            subjectId: {
                type: Schema.Types.ObjectId,
                ref: "Subject",
                required: true
            },
            subjectName: {
                type: String,
                required: true,
                trim: true
            },
            accessLevel: {
                type: String,
                enum: ["READ_ONLY", "READ_WRITE", "FULL_ACCESS"],
                required: true
            },
            canCreateQuestions: {
                type: Boolean,
                default: false
            },
            canUploadSyllabus: {
                type: Boolean,
                default: false
            }
        }],
    globalPermissions: {
        canViewAllClasses: {
            type: Boolean,
            default: false
        },
        canViewAllSubjects: {
            type: Boolean,
            default: false
        },
        canAccessAnalytics: {
            type: Boolean,
            default: false
        },
        canPrintReports: {
            type: Boolean,
            default: true
        },
        canSendNotifications: {
            type: Boolean,
            default: false
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date
    },
    notes: {
        type: String,
        trim: true
    }
}, { timestamps: true });
// Indexes for efficient queries
StaffAccessSchema.index({ staffId: 1, isActive: 1 });
StaffAccessSchema.index({ assignedBy: 1, createdAt: -1 });
StaffAccessSchema.index({ "classAccess.classId": 1, isActive: 1 });
StaffAccessSchema.index({ "subjectAccess.subjectId": 1, isActive: 1 });
StaffAccessSchema.index({ expiresAt: 1, isActive: 1 });
export const StaffAccess = mongoose.models.StaffAccess || mongoose.model("StaffAccess", StaffAccessSchema);
//# sourceMappingURL=StaffAccess.js.map
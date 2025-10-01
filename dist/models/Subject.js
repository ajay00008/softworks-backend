import mongoose, { Schema, Document, Model } from "mongoose";
const SubjectSchema = new Schema({
    code: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        match: [/^[A-Z0-9_]+$/, "Subject code must contain only uppercase letters, numbers, and underscores"]
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: {
        type: String,
        required: true,
        trim: true
    },
    shortName: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ["SCIENCE", "MATHEMATICS", "LANGUAGES", "SOCIAL_SCIENCES", "COMMERCE", "ARTS", "PHYSICAL_EDUCATION", "COMPUTER_SCIENCE", "OTHER"],
        uppercase: true
    },
    classIds: [{
            type: Schema.Types.ObjectId,
            ref: 'Class',
            required: true
        }],
    isActive: {
        type: Boolean,
        default: true
    },
    description: {
        type: String,
        trim: true
    },
    color: {
        type: String,
        trim: true,
        match: [/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color code"]
    },
    referenceBook: {
        fileName: { type: String, trim: true },
        originalName: { type: String, trim: true },
        filePath: { type: String, trim: true },
        fileSize: { type: Number, min: 0 },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "User" }
    }
}, { timestamps: true });
// Index for efficient queries
SubjectSchema.index({ adminId: 1, code: 1 }, { unique: true });
SubjectSchema.index({ adminId: 1, category: 1 });
SubjectSchema.index({ adminId: 1, isActive: 1 });
export const Subject = mongoose.models.Subject || mongoose.model("Subject", SubjectSchema);
//# sourceMappingURL=Subject.js.map
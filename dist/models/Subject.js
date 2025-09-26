import mongoose, { Schema, Document, Model } from "mongoose";
const SubjectSchema = new Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        match: [/^[A-Z0-9_]+$/, "Subject code must contain only uppercase letters, numbers, and underscores"]
    },
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
    level: [{
            type: Number,
            required: true,
            min: 1,
            max: 12
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
    }
}, { timestamps: true });
// Index for efficient queries
SubjectSchema.index({ code: 1 });
SubjectSchema.index({ category: 1 });
SubjectSchema.index({ level: 1 });
SubjectSchema.index({ isActive: 1 });
export const Subject = mongoose.models.Subject || mongoose.model("Subject", SubjectSchema);
//# sourceMappingURL=Subject.js.map
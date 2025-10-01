import mongoose, { Schema, Document, Model } from "mongoose";
const ClassSchema = new Schema({
    name: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    displayName: {
        type: String,
        required: true,
        trim: true
    },
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    section: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
    },
    isActive: {
        type: Boolean,
        default: true
    },
    description: {
        type: String,
        trim: true
    }
}, { timestamps: true });
// Index for efficient queries
ClassSchema.index({ adminId: 1, name: 1 }, { unique: true });
ClassSchema.index({ adminId: 1, level: 1, section: 1 });
ClassSchema.index({ adminId: 1, isActive: 1 });
export const Class = mongoose.models.Class || mongoose.model("Class", ClassSchema);
//# sourceMappingURL=Class.js.map
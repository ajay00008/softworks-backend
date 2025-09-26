import mongoose, { Schema, Document, Model } from "mongoose";
const NotificationSchema = new Schema({
    type: {
        type: String,
        enum: ["MISSING_SHEET", "ABSENT_STUDENT", "AI_CORRECTION_COMPLETE", "MANUAL_REVIEW_REQUIRED", "SYSTEM_ALERT"],
        required: true,
        index: true
    },
    priority: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
        default: "MEDIUM",
        index: true
    },
    status: {
        type: String,
        enum: ["UNREAD", "READ", "ACKNOWLEDGED", "DISMISSED"],
        default: "UNREAD",
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    recipientId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    relatedEntityId: {
        type: Schema.Types.ObjectId,
        index: true
    },
    relatedEntityType: {
        type: String,
        trim: true
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    isActive: {
        type: Boolean,
        default: true
    },
    readAt: {
        type: Date
    },
    acknowledgedAt: {
        type: Date
    },
    dismissedAt: {
        type: Date
    }
}, { timestamps: true });
// Indexes for efficient queries
NotificationSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, priority: 1, status: 1 });
NotificationSchema.index({ relatedEntityId: 1, relatedEntityType: 1 });
NotificationSchema.index({ isActive: 1, createdAt: -1 });
export const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
//# sourceMappingURL=Notification.js.map
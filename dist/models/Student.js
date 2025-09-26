import mongoose, { Schema, Document, Model } from "mongoose";
const StudentSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
    rollNumber: {
        type: String,
        required: true,
        index: true,
        trim: true,
        uppercase: true
    },
    classId: {
        type: Schema.Types.ObjectId,
        ref: "Class",
        required: true,
        index: true
    },
    fatherName: {
        type: String,
        trim: true
    },
    motherName: {
        type: String,
        trim: true
    },
    dateOfBirth: {
        type: String,
        trim: true,
        match: [/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"]
    },
    parentsPhone: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s\-\(\)]+$/, "Invalid phone number format"]
    },
    parentsEmail: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
    },
    address: {
        type: String,
        trim: true
    },
    whatsappNumber: {
        type: String,
        trim: true,
        match: [/^\+?[\d\s\-\(\)]+$/, "Invalid WhatsApp number format"]
    },
}, { timestamps: true });
StudentSchema.index({ classId: 1, rollNumber: 1 }, { unique: true });
export const Student = mongoose.models.Student || mongoose.model("Student", StudentSchema);
//# sourceMappingURL=Student.js.map
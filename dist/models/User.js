import mongoose, { Schema, Document, Model } from "mongoose";
const UserSchema = new Schema({
    email: { type: String, required: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"], required: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
export const User = mongoose.models.User || mongoose.model("User", UserSchema);
//# sourceMappingURL=User.js.map
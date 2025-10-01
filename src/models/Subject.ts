import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISubject extends Document {
  code: string; // e.g., "MATH", "PHYSICS", "CHEMISTRY"
  name: string; // e.g., "Mathematics", "Physics", "Chemistry"
  shortName: string; // e.g., "Math", "Phy", "Chem"
  category: string; // e.g., "SCIENCE", "MATHEMATICS", "LANGUAGES", "SOCIAL_SCIENCES"
  adminId: mongoose.Types.ObjectId; // references User with role ADMIN who created this subject
  classIds: mongoose.Types.ObjectId[]; // References to actual Class documents
  isActive: boolean;
  description?: string;
  color?: string; // For UI display purposes
  referenceBook?: {
    fileName: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    uploadedAt: Date;
    uploadedBy: mongoose.Types.ObjectId;
  };
}

const SubjectSchema = new Schema<ISubject>(
  {
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
  },
  { timestamps: true }
);

// Index for efficient queries
SubjectSchema.index({ adminId: 1, code: 1 }, { unique: true });
SubjectSchema.index({ adminId: 1, category: 1 });
SubjectSchema.index({ adminId: 1, isActive: 1 });

export const Subject: Model<ISubject> = mongoose.models.Subject || mongoose.model<ISubject>("Subject", SubjectSchema);

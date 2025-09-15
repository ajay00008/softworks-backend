import mongoose, { Schema, Document, Model } from "mongoose";

export interface IClass extends Document {
  name: string; // e.g., "10A", "9B", "12C"
  displayName: string; // e.g., "Class 10A", "Grade 9B"
  level: number; // e.g., 10, 9, 12
  section: string; // e.g., "A", "B", "C"
  academicYear: string; // e.g., "2024-25"
  isActive: boolean;
  description?: string;
}

const ClassSchema = new Schema<IClass>(
  {
    name: { 
      type: String, 
      required: true, 
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[0-9]+[A-Z]$/, "Class name must be in format like 10A, 9B, 12C"]
    },
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
      match: [/^[A-Z]$/, "Section must be a single letter"]
    },
    academicYear: { 
      type: String, 
      required: true,
      trim: true,
      match: [/^\d{4}-\d{2}$/, "Academic year must be in format YYYY-YY"]
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    description: { 
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

// Index for efficient queries
ClassSchema.index({ name: 1, academicYear: 1 }, { unique: true });
ClassSchema.index({ level: 1, section: 1, academicYear: 1 });
ClassSchema.index({ isActive: 1 });

export const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>("Class", ClassSchema);

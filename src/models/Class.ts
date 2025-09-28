import mongoose, { Schema, Document, Model } from "mongoose";

export interface IClass extends Document {
  name: string; // e.g., "10A", "9B", "12C"
  displayName: string; // e.g., "Class 10A", "Grade 9B"
  level: number; // e.g., 10, 9, 12
  section: string; // e.g., "A", "B", "C"
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
ClassSchema.index({ name: 1 }, { unique: true });
ClassSchema.index({ level: 1, section: 1 });
ClassSchema.index({ isActive: 1 });

export const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>("Class", ClassSchema);

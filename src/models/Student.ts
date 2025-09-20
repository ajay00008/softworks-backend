import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStudent extends Document {
  userId: mongoose.Types.ObjectId; // references User with role STUDENT
  rollNumber: string;
  classId: mongoose.Types.ObjectId; // references Class model
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  parentsPhone?: string;
  parentsEmail?: string;
  address?: string;
  whatsappNumber?: string;
}

const StudentSchema = new Schema<IStudent>(
  {
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
      validate: {
        validator: function(v: string) {
          if (!v || v === '') return true; // Allow empty values
          return /^\d{4}-\d{2}-\d{2}$/.test(v);
        },
        message: "Date of birth must be in YYYY-MM-DD format or empty"
      }
    },
    parentsPhone: { 
      type: String,
      trim: true
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
      trim: true
    },
  },
  { timestamps: true }
);

StudentSchema.index({ classId: 1, rollNumber: 1 }, { unique: true });

export const Student: Model<IStudent> = mongoose.models.Student || mongoose.model<IStudent>("Student", StudentSchema);



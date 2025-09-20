import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITeacher extends Document {
  userId: mongoose.Types.ObjectId; // references User with role TEACHER
  subjectIds: mongoose.Types.ObjectId[]; // references Subject model
  classIds: mongoose.Types.ObjectId[]; // references Class model - classes teacher is assigned to
  permissions: {
    createQuestions: boolean;
    viewResults: boolean;
    manageStudents: boolean;
    accessAnalytics: boolean;
  };
  phone?: string;
  address?: string;
  qualification?: string;
  experience?: string; // Changed from number to string to match form data
  department?: string;
}

const TeacherSchema = new Schema<ITeacher>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
    subjectIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: "Subject"
    }],
    classIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: "Class"
    }],
    permissions: {
      createQuestions: { type: Boolean, default: false },
      viewResults: { type: Boolean, default: false },
      manageStudents: { type: Boolean, default: false },
      accessAnalytics: { type: Boolean, default: false }
    },
    phone: { 
      type: String,
      trim: true
    },
    address: { 
      type: String,
      trim: true
    },
    qualification: { 
      type: String,
      trim: true
    },
    experience: { 
      type: String,
      trim: true
    },
  },
  { timestamps: true }
);

// Pre-save validation removed - teachers can now be created without subjects or classes

export const Teacher: Model<ITeacher> = mongoose.models.Teacher || mongoose.model<ITeacher>("Teacher", TeacherSchema);



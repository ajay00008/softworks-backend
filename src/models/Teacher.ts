import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITeacher extends Document {
  userId: mongoose.Types.ObjectId; // references User with role TEACHER
  adminId: mongoose.Types.ObjectId; // references User with role ADMIN who created this teacher
  subjectIds: mongoose.Types.ObjectId[]; // references Subject model
  classIds: mongoose.Types.ObjectId[]; // references Class model - classes teacher is assigned to
  phone?: string;
  address?: string;
  qualification?: string;
  experience?: string; // Changed from number to string to match form data
  department?: string;
}

const TeacherSchema = new Schema<ITeacher>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subjectIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: "Subject"
    }],
    classIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: "Class"
    }],
    phone: { 
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-\(\)]+$/, "Invalid phone number format"]
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
      type: Number,
    },
  },
  { timestamps: true }
);

// Pre-save validation to ensure at least one subject is assigned
TeacherSchema.pre('save', function(next) {
  console.log('🔍 Teacher pre-save validation:', {
    subjectIds: this.subjectIds,
    classIds: this.classIds,
    subjectIdsLength: this.subjectIds?.length,
    classIdsLength: this.classIds?.length
  });
  
  if (this.subjectIds && this.subjectIds.length === 0) {
    console.log('❌ Teacher validation failed: No subjects assigned');
    next(new Error('Teacher must be assigned to at least one subject'));
  } else {
    console.log('✅ Teacher validation passed');
    next();
  }
});

export const Teacher: Model<ITeacher> = mongoose.models.Teacher || mongoose.model<ITeacher>("Teacher", TeacherSchema);



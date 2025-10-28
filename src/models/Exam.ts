import mongoose, { Schema, Document, Model } from "mongoose";

export type ExamStatus = "DRAFT" | "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED";
export type ExamType = "UNIT_TEST" | "MID_TERM" | "FINAL" | "QUIZ" | "ASSIGNMENT" | "PRACTICAL" | "DAILY" | "WEEKLY" | "MONTHLY" | "UNIT_WISE" | "PAGE_WISE" | "TERM_TEST" | "ANNUAL_EXAM";

export interface IExam extends Document {
  title: string;
  description?: string;
  examType: ExamType;
  subjectIds: mongoose.Types.ObjectId[]; // Array of subject IDs for multi-subject exams
  classId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId; // references User with role ADMIN who created this exam
  duration: number; // in minutes
  status: ExamStatus;
  scheduledDate: Date;
  endDate?: Date;
  createdBy: mongoose.Types.ObjectId; // Teacher/Admin who created it
  questions: mongoose.Types.ObjectId[]; // References to Question model
  questionPaperId?: mongoose.Types.ObjectId; // Reference to QuestionPaper model
  questionDistribution: {
    unit: string;
    bloomsLevel: string;
    difficulty: string;
    percentage: number;
    twistedPercentage?: number;
  }[];
  instructions?: string;
  isActive: boolean;
  allowLateSubmission: boolean;
  lateSubmissionPenalty?: number; // percentage deduction
}

const ExamSchema = new Schema<IExam>(
  {
    title: { 
      type: String, 
      required: true,
      trim: true
    },
    description: { 
      type: String,
      trim: true
    },
    examType: { 
      type: String, 
      enum: ["UNIT_TEST", "MID_TERM", "FINAL", "QUIZ", "ASSIGNMENT", "PRACTICAL", "DAILY", "WEEKLY", "MONTHLY", "UNIT_WISE", "PAGE_WISE", "TERM_TEST", "ANNUAL_EXAM"],
      required: true
    },
    subjectIds: [{ 
      type: Schema.Types.ObjectId, 
      ref: "Subject", 
      required: true
    }],
    classId: { 
      type: Schema.Types.ObjectId, 
      ref: "Class", 
      required: true,
      index: true
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    duration: { 
      type: Number, 
      required: true,
      min: 15,
      max: 480 // 8 hours max
    },
    status: { 
      type: String, 
      enum: ["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"],
      default: "DRAFT"
    },
    scheduledDate: { 
      type: Date, 
      required: true
    },
    endDate: { 
      type: Date
    },
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    questions: [{ 
      type: Schema.Types.ObjectId, 
      ref: "Question"
    }],
    questionPaperId: { 
      type: Schema.Types.ObjectId, 
      ref: "QuestionPaper",
      index: true
    },
    questionDistribution: [{
      unit: { type: String, required: true },
      bloomsLevel: { type: String, required: true },
      difficulty: { type: String, required: true },
      percentage: { type: Number, required: true, min: 0, max: 100 },
      twistedPercentage: { type: Number, min: 0, max: 100 }
    }],
    instructions: { 
      type: String,
      trim: true
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    allowLateSubmission: { 
      type: Boolean, 
      default: false
    },
    lateSubmissionPenalty: { 
      type: Number,
      min: 0,
      max: 100
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
ExamSchema.index({ subjectId: 1, classId: 1 });
ExamSchema.index({ status: 1, scheduledDate: 1 });
ExamSchema.index({ createdBy: 1, isActive: 1 });
ExamSchema.index({ examType: 1, classId: 1 });

export const Exam: Model<IExam> = mongoose.models.Exam || mongoose.model<IExam>("Exam", ExamSchema);

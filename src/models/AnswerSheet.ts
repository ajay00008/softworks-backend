import mongoose, { Schema, Document, Model } from "mongoose";

export type AnswerSheetStatus = "UPLOADED" | "PROCESSING" | "AI_CORRECTED" | "MANUALLY_REVIEWED" | "COMPLETED" | "MISSING" | "ABSENT";
export type ScanQuality = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNREADABLE";

export interface IAnswerSheet extends Document {
  examId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId; // Teacher who uploaded
  originalFileName: string;
  cloudStorageUrl: string;
  cloudStorageKey: string;
  status: AnswerSheetStatus;
  scanQuality: ScanQuality;
  isAligned: boolean;
  rollNumberDetected: string;
  rollNumberConfidence: number; // 0-100
  confidence?: number; // Overall AI confidence score
  aiCorrectionResults?: {
    answerSheetId: string;
    status: string;
    confidence: number;
    totalMarks: number;
    obtainedMarks: number;
    percentage: number;
    questionWiseResults: Array<{
      questionNumber: number;
      correctAnswer: string;
      studentAnswer: string;
      isCorrect: boolean;
      marksObtained: number;
      maxMarks: number;
      feedback: string;
      confidence: number;
    }>;
    overallFeedback: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    processingTime: number;
    errors?: string[];
  };
  manualOverrides?: {
    questionId: mongoose.Types.ObjectId;
    correctedAnswer: string;
    correctedMarks: number;
    reason: string;
    correctedBy: mongoose.Types.ObjectId;
    correctedAt: Date;
  }[];
  isMissing: boolean;
  missingReason?: string;
  isAbsent: boolean;
  absentReason?: string;
  acknowledgedBy?: mongoose.Types.ObjectId; // Admin who acknowledged missing/absent
  acknowledgedAt?: Date;
  uploadedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  language: string; // For multilingual support
  isActive: boolean;
}

const AnswerSheetSchema = new Schema<IAnswerSheet>(
  {
    examId: { 
      type: Schema.Types.ObjectId, 
      ref: "Exam", 
      required: true,
      index: true
    },
    studentId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    uploadedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    originalFileName: { 
      type: String, 
      required: true,
      trim: true
    },
    cloudStorageUrl: { 
      type: String, 
      required: true
    },
    cloudStorageKey: { 
      type: String, 
      required: true,
      unique: true
    },
    status: { 
      type: String, 
      enum: ["UPLOADED", "PROCESSING", "AI_CORRECTED", "MANUALLY_REVIEWED", "COMPLETED", "MISSING", "ABSENT"],
      default: "UPLOADED"
    },
    scanQuality: { 
      type: String, 
      enum: ["EXCELLENT", "GOOD", "FAIR", "POOR", "UNREADABLE"],
      default: "GOOD"
    },
    isAligned: { 
      type: Boolean, 
      default: true
    },
    rollNumberDetected: { 
      type: String,
      trim: true
    },
    rollNumberConfidence: { 
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    confidence: { 
      type: Number,
      min: 0,
      max: 1
    },
    aiCorrectionResults: {
      answerSheetId: { type: String },
      status: { type: String },
      confidence: { type: Number, min: 0, max: 1 },
      totalMarks: { type: Number, min: 0 },
      obtainedMarks: { type: Number, min: 0 },
      percentage: { type: Number, min: 0, max: 100 },
      questionWiseResults: [{
        questionNumber: { type: Number, required: true },
        correctAnswer: { type: String, required: true },
        studentAnswer: { type: String, required: true },
        isCorrect: { type: Boolean, required: true },
        marksObtained: { type: Number, required: true, min: 0 },
        maxMarks: { type: Number, required: true, min: 0 },
        feedback: { type: String, required: true },
        confidence: { type: Number, required: true, min: 0, max: 1 }
      }],
      overallFeedback: { type: String },
      strengths: [{ type: String }],
      weaknesses: [{ type: String }],
      suggestions: [{ type: String }],
      processingTime: { type: Number, min: 0 },
      errors: [{ type: String }]
    },
    manualOverrides: [{
      questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
      correctedAnswer: { type: String, required: true },
      correctedMarks: { type: Number, required: true, min: 0 },
      reason: { type: String, required: true },
      correctedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
      correctedAt: { type: Date, required: true }
    }],
    isMissing: { 
      type: Boolean, 
      default: false,
      index: true
    },
    missingReason: { 
      type: String,
      trim: true
    },
    isAbsent: { 
      type: Boolean, 
      default: false,
      index: true
    },
    absentReason: { 
      type: String,
      trim: true
    },
    acknowledgedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User"
    },
    acknowledgedAt: { 
      type: Date
    },
    uploadedAt: { 
      type: Date, 
      default: Date.now
    },
    processedAt: { 
      type: Date
    },
    completedAt: { 
      type: Date
    },
    language: { 
      type: String, 
      default: "ENGLISH",
      enum: ["ENGLISH", "TAMIL", "HINDI", "MALAYALAM", "TELUGU", "KANNADA", "FRENCH"]
    },
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
AnswerSheetSchema.index({ examId: 1, studentId: 1 }, { unique: true });
AnswerSheetSchema.index({ status: 1, uploadedAt: 1 });
AnswerSheetSchema.index({ isMissing: 1, isAbsent: 1 });
AnswerSheetSchema.index({ uploadedBy: 1, status: 1 });
AnswerSheetSchema.index({ acknowledgedBy: 1, acknowledgedAt: 1 });
AnswerSheetSchema.index({ cloudStorageKey: 1 });

export const AnswerSheet: Model<IAnswerSheet> = mongoose.models.AnswerSheet || mongoose.model<IAnswerSheet>("AnswerSheet", AnswerSheetSchema);

import mongoose, { Schema, Document, Model } from "mongoose";

export type AnswerSheetStatus = "UPLOADED" | "PROCESSING" | "AI_CORRECTED" | "MANUALLY_REVIEWED" | "COMPLETED" | "MISSING" | "ABSENT" | "FLAGGED";
export type ScanQuality = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNREADABLE";
export type FlagType = "UNMATCHED_ROLL" | "POOR_QUALITY" | "MISSING_PAGES" | "ALIGNMENT_ISSUE" | "DUPLICATE_UPLOAD" | "INVALID_FORMAT" | "SIZE_TOO_LARGE" | "CORRUPTED_FILE" | "MANUAL_REVIEW_REQUIRED";
export type FlagSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProcessingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "FLAGGED";

export interface IAnswerSheetFlag {
  type: FlagType;
  severity: FlagSeverity;
  description: string;
  detectedAt: Date;
  detectedBy?: mongoose.Types.ObjectId; // AI system or user who flagged
  resolved: boolean;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolutionNotes?: string;
  autoResolved: boolean;
}

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
  
  // Enhanced flagging system
  flags: IAnswerSheetFlag[];
  processingStatus: ProcessingStatus;
  flagCount: number; // Computed field for quick access
  hasCriticalFlags: boolean; // Computed field for quick access
  lastFlaggedAt?: Date;
  flagResolutionRate?: number; // Percentage of flags resolved
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
      required: false, // Allow null for unmatched answer sheets
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
      enum: ["UPLOADED", "PROCESSING", "AI_CORRECTED", "MANUALLY_REVIEWED", "COMPLETED", "MISSING", "ABSENT", "FLAGGED"],
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
    aiProcessingResults: {
      rollNumberDetection: {
        rollNumber: { type: String },
        confidence: { type: Number, min: 0, max: 1 },
        boundingBox: {
          x: { type: Number },
          y: { type: Number },
          width: { type: Number },
          height: { type: Number }
        },
        alternatives: [{
          rollNumber: { type: String },
          confidence: { type: Number, min: 0, max: 1 }
        }],
        imageQuality: { type: String, enum: ["EXCELLENT", "GOOD", "FAIR", "POOR"] },
        processingTime: { type: Number, min: 0 }
      },
      studentMatching: {
        matchedStudent: {
          id: { type: String },
          name: { type: String },
          rollNumber: { type: String },
          email: { type: String }
        },
        confidence: { type: Number, min: 0, max: 1 },
        alternatives: [{
          student: {
            id: { type: String },
            name: { type: String },
            rollNumber: { type: String }
          },
          confidence: { type: Number, min: 0, max: 1 }
        }],
        processingTime: { type: Number, min: 0 }
      },
      imageAnalysis: {
        quality: { type: String, enum: ["EXCELLENT", "GOOD", "FAIR", "POOR"] },
        isAligned: { type: Boolean }
      },
      issues: [{ type: String }],
      suggestions: [{ type: String }],
      processingTime: { type: Number, min: 0 }
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
    },
    
    // Enhanced flagging system
    flags: [{
      type: { 
        type: String, 
        enum: ["UNMATCHED_ROLL", "POOR_QUALITY", "MISSING_PAGES", "ALIGNMENT_ISSUE", "DUPLICATE_UPLOAD", "INVALID_FORMAT", "SIZE_TOO_LARGE", "CORRUPTED_FILE", "MANUAL_REVIEW_REQUIRED"],
        required: true
      },
      severity: { 
        type: String, 
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        required: true
      },
      description: { 
        type: String, 
        required: true,
        trim: true
      },
      detectedAt: { 
        type: Date, 
        required: true,
        default: Date.now
      },
      detectedBy: { 
        type: Schema.Types.ObjectId, 
        ref: "User"
      },
      resolved: { 
        type: Boolean, 
        default: false
      },
      resolvedBy: { 
        type: Schema.Types.ObjectId, 
        ref: "User"
      },
      resolvedAt: { 
        type: Date
      },
      resolutionNotes: { 
        type: String,
        trim: true
      },
      autoResolved: { 
        type: Boolean, 
        default: false
      }
    }],
    processingStatus: { 
      type: String, 
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "FLAGGED"],
      default: "PENDING"
    },
    flagCount: { 
      type: Number, 
      default: 0,
      min: 0
    },
    hasCriticalFlags: { 
      type: Boolean, 
      default: false
    },
    lastFlaggedAt: { 
      type: Date
    },
    flagResolutionRate: { 
      type: Number, 
      min: 0, 
      max: 100,
      default: 0
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
// Unique index only when studentId is not null and isActive is true (prevents duplicate answer sheets per student)
// MongoDB allows multiple null values in unique indexes, so unmatched sheets won't conflict
// Excludes soft-deleted documents (isActive: false)
AnswerSheetSchema.index({ examId: 1, studentId: 1 }, { 
  unique: true,
  partialFilterExpression: { 
    studentId: { $ne: null },
    isActive: { $ne: false }
  },
  name: 'examId_studentId_unique_when_not_null_and_active'
});
AnswerSheetSchema.index({ status: 1, uploadedAt: 1 });
AnswerSheetSchema.index({ isMissing: 1, isAbsent: 1 });
AnswerSheetSchema.index({ uploadedBy: 1, status: 1 });
AnswerSheetSchema.index({ acknowledgedBy: 1, acknowledgedAt: 1 });
AnswerSheetSchema.index({ cloudStorageKey: 1 });

// Flag system indexes
AnswerSheetSchema.index({ processingStatus: 1, uploadedAt: 1 });
AnswerSheetSchema.index({ flagCount: 1, hasCriticalFlags: 1 });
AnswerSheetSchema.index({ lastFlaggedAt: 1 });
AnswerSheetSchema.index({ "flags.type": 1, "flags.severity": 1 });
AnswerSheetSchema.index({ "flags.resolved": 1, "flags.resolvedAt": 1 });

// Middleware to update computed fields
AnswerSheetSchema.pre('save', function(next) {
  // Update flag count
  this.flagCount = this.flags.length;
  
  // Update hasCriticalFlags
  this.hasCriticalFlags = this.flags.some(flag => flag.severity === 'CRITICAL' && !flag.resolved);
  
  // Update lastFlaggedAt
  if (this.flags.length > 0) {
    const unresolvedFlags = this.flags.filter(flag => !flag.resolved);
    if (unresolvedFlags.length > 0) {
      this.lastFlaggedAt = new Date(Math.max(...unresolvedFlags.map(flag => flag.detectedAt.getTime())));
    }
  }
  
  // Update flag resolution rate
  if (this.flags.length > 0) {
    const resolvedFlags = this.flags.filter(flag => flag.resolved).length;
    this.flagResolutionRate = Math.round((resolvedFlags / this.flags.length) * 100);
  }
  
  // Update processing status based on flags
  if (this.flags.some(flag => flag.severity === 'CRITICAL' && !flag.resolved)) {
    this.processingStatus = 'FLAGGED';
    this.status = 'FLAGGED';
  } else if (this.processingStatus === 'FLAGGED' && !this.flags.some(flag => flag.severity === 'CRITICAL' && !flag.resolved)) {
    this.processingStatus = 'COMPLETED';
  }
  
  next();
});

export const AnswerSheet: Model<IAnswerSheet> = mongoose.models.AnswerSheet || mongoose.model<IAnswerSheet>("AnswerSheet", AnswerSheetSchema);

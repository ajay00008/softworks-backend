import mongoose, { Schema, Document, Model } from "mongoose";

export type BloomsTaxonomyLevel = "REMEMBER" | "UNDERSTAND" | "APPLY" | "ANALYZE" | "EVALUATE" | "CREATE";
export type QuestionDifficulty = "EASY" | "MODERATE" | "TOUGHEST";
export type QuestionType = 
  | "MULTIPLE_CHOICE" 
  | "FILL_BLANKS" 
  | "ONE_WORD_ANSWER" 
  | "TRUE_FALSE" 
  | "MULTIPLE_ANSWERS" 
  | "MATCHING_PAIRS" 
  | "DRAWING_DIAGRAM" 
  | "MARKING_PARTS"
  | "SHORT_ANSWER" 
  | "LONG_ANSWER";

export interface IQuestion extends Document {
  questionText: string;
  questionType: QuestionType;
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId; // references User with role ADMIN who created this question
  unit: string;
  bloomsTaxonomyLevel: BloomsTaxonomyLevel;
  difficulty: QuestionDifficulty;
  isTwisted: boolean;
  options?: string[]; // For multiple choice questions
  correctAnswer: string;
  explanation?: string;
  
  // Additional fields for new question types
  matchingPairs?: { left: string; right: string }[]; // For matching pairs
  multipleCorrectAnswers?: string[]; // For multiple correct answers
  drawingInstructions?: string; // For drawing questions
  markingInstructions?: string; // For marking questions
  visualAids?: string[]; // URLs or descriptions of visual aids
  interactiveElements?: string[]; // Interactive elements for the question
  marks: number;
  timeLimit?: number; // in minutes
  createdBy: mongoose.Types.ObjectId; // Teacher who created it
  isActive: boolean;
  tags?: string[];
  language: string; // For multi-language support
}

const QuestionSchema = new Schema<IQuestion>(
  {
    questionText: { 
      type: String, 
      required: true,
      trim: true
    },
    questionType: { 
      type: String, 
      enum: ["MULTIPLE_CHOICE", "FILL_BLANKS", "ONE_WORD_ANSWER", "TRUE_FALSE", "MULTIPLE_ANSWERS", "MATCHING_PAIRS", "DRAWING_DIAGRAM", "MARKING_PARTS", "SHORT_ANSWER", "LONG_ANSWER"],
      required: true
    },
    subjectId: { 
      type: Schema.Types.ObjectId, 
      ref: "Subject", 
      required: true,
      index: true
    },
    classId: { 
      type: Schema.Types.ObjectId, 
      ref: "Class", 
      required: true,
      index: true
    },
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    unit: { 
      type: String, 
      required: true,
      trim: true
    },
    bloomsTaxonomyLevel: { 
      type: String, 
      enum: ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"],
      required: true
    },
    difficulty: { 
      type: String, 
      enum: ["EASY", "MODERATE", "TOUGHEST"],
      required: true
    },
    isTwisted: { 
      type: Boolean, 
      default: false
    },
    options: [{ 
      type: String,
      trim: true
    }],
    correctAnswer: { 
      type: String, 
      required: true,
      trim: true
    },
    explanation: { 
      type: String,
      trim: true
    },
    
    // Additional fields for new question types
    matchingPairs: [{
      left: { type: String, trim: true },
      right: { type: String, trim: true }
    }],
    multipleCorrectAnswers: [{ 
      type: String,
      trim: true
    }],
    drawingInstructions: { 
      type: String,
      trim: true
    },
    markingInstructions: { 
      type: String,
      trim: true
    },
    visualAids: [{ 
      type: String,
      trim: true
    }],
    interactiveElements: [{ 
      type: String,
      trim: true
    }],
    marks: { 
      type: Number, 
      required: true,
      min: 1,
      max: 100
    },
    timeLimit: { 
      type: Number,
      min: 1,
      max: 300 // 5 hours max
    },
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    tags: [{ 
      type: String,
      trim: true
    }],
    language: { 
      type: String, 
      default: "ENGLISH",
      enum: ["ENGLISH", "TAMIL", "HINDI", "MALAYALAM", "TELUGU", "KANNADA"]
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
QuestionSchema.index({ adminId: 1, subjectId: 1, classId: 1 });
QuestionSchema.index({ adminId: 1, bloomsTaxonomyLevel: 1, difficulty: 1 });
QuestionSchema.index({ adminId: 1, unit: 1, subjectId: 1 });
QuestionSchema.index({ adminId: 1, createdBy: 1, isActive: 1 });

export const Question: Model<IQuestion> = mongoose.models.Question || mongoose.model<IQuestion>("Question", QuestionSchema);

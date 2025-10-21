import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestionPaperTemplate extends Document {
  title: string;
  description?: string;
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  
  // Template file information
  templateFile: {
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedAt: Date;
    downloadUrl: string;
  };
  
  // Template analysis data (extracted from the uploaded PDF)
  analysis: {
    totalQuestions: number;
    questionTypes: string[];
    markDistribution: {
      oneMark: number;
      twoMark: number;
      threeMark: number;
      fiveMark: number;
      totalMarks: number;
    };
    difficultyLevels: string[];
    bloomsDistribution: {
      remember: number;
      understand: number;
      apply: number;
      analyze: number;
      evaluate: number;
      create: number;
    };
    timeDistribution: {
      totalTime: number;
      perQuestion: number;
    };
    sections: Array<{
      name: string;
      questions: number;
      marks: number;
    }>;
  };
  
  // Template settings for AI generation
  aiSettings: {
    useTemplate: boolean;
    followPattern: boolean;
    maintainStructure: boolean;
    customInstructions?: string;
  };
  
  isActive: boolean;
  version: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionPaperTemplateSchema = new Schema<IQuestionPaperTemplate>(
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
    adminId: { 
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
    templateFile: {
      fileName: { type: String, required: true },
      filePath: { type: String, required: true },
      fileSize: { type: Number, required: true },
      uploadedAt: { type: Date, default: Date.now },
      downloadUrl: { type: String, required: true }
    },
    analysis: {
      totalQuestions: { type: Number, default: 0 },
      questionTypes: [{ type: String }],
      markDistribution: {
        oneMark: { type: Number, default: 0 },
        twoMark: { type: Number, default: 0 },
        threeMark: { type: Number, default: 0 },
        fiveMark: { type: Number, default: 0 },
        totalMarks: { type: Number, default: 0 }
      },
      difficultyLevels: [{ type: String }],
      bloomsDistribution: {
        remember: { type: Number, default: 0 },
        understand: { type: Number, default: 0 },
        apply: { type: Number, default: 0 },
        analyze: { type: Number, default: 0 },
        evaluate: { type: Number, default: 0 },
        create: { type: Number, default: 0 }
      },
      timeDistribution: {
        totalTime: { type: Number, default: 0 },
        perQuestion: { type: Number, default: 0 }
      },
      sections: [{
        name: { type: String, required: true },
        questions: { type: Number, required: true },
        marks: { type: Number, required: true }
      }]
    },
    aiSettings: {
      useTemplate: { type: Boolean, default: true },
      followPattern: { type: Boolean, default: true },
      maintainStructure: { type: Boolean, default: true },
      customInstructions: { type: String }
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    version: { 
      type: String, 
      default: "1.0",
      trim: true
    },
    language: { 
      type: String, 
      default: "ENGLISH",
      enum: ["ENGLISH", "TAMIL", "HINDI", "MALAYALAM", "TELUGU", "KANNADA"]
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
QuestionPaperTemplateSchema.index({ subjectId: 1, classId: 1, isActive: 1 });
QuestionPaperTemplateSchema.index({ adminId: 1, isActive: 1 });
QuestionPaperTemplateSchema.index({ uploadedBy: 1, isActive: 1 });

export default mongoose.model<IQuestionPaperTemplate>('QuestionPaperTemplate', QuestionPaperTemplateSchema);
import mongoose, { Document, Schema } from 'mongoose';

export interface ISamplePaper extends Document {
  title: string;
  description?: string;
  subjectId: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  
  // Sample paper file information
  sampleFile: {
    fileName: string;
    filePath: string;
    fileSize: number;
    uploadedAt: Date;
    downloadUrl: string;
  };
  
  // Sample paper analysis data (extracted from the uploaded PDF)
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
    designPattern: {
      layout: string;
      formatting: string;
      questionNumbering: string;
      sectionHeaders: string[];
    };
  };
  
  // Settings for using this sample as a template
  templateSettings: {
    useAsTemplate: boolean;
    followDesign: boolean;
    maintainStructure: boolean;
    customInstructions?: string;
  };
  
  isActive: boolean;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

const SamplePaperSchema = new Schema<ISamplePaper>(
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
    sampleFile: {
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
      }],
      designPattern: {
        layout: { type: String, default: 'standard' },
        formatting: { type: String, default: 'standard' },
        questionNumbering: { type: String, default: 'sequential' },
        sectionHeaders: [{ type: String }]
      }
    },
    templateSettings: {
      useAsTemplate: { type: Boolean, default: true },
      followDesign: { type: Boolean, default: true },
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
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
SamplePaperSchema.index({ subjectId: 1, isActive: 1 });
SamplePaperSchema.index({ adminId: 1, isActive: 1 });
SamplePaperSchema.index({ uploadedBy: 1, isActive: 1 });

export default mongoose.model<ISamplePaper>('SamplePaper', SamplePaperSchema);

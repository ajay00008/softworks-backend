import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEvaluationSettings extends Document {
  examId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId; // Admin who created these settings
  
  // Minus marks configuration
  minusMarksSettings: {
    spellingMistakesPenalty: number; // Percentage deduction (0-100)
    stepMistakesPenalty: number; // For subjects like Mathematics, Chemistry
    diagramMistakesPenalty: number; // For diagrams, graphs, charts
    missingKeywordsPenalty: number; // For missing important compulsory words
    handwritingQualityPenalty: number; // For poor handwriting
    lateSubmissionPenalty: number; // For late submissions
    incompleteAnswerPenalty: number; // For incomplete answers
  };
  
  // Step-by-step marking settings
  stepMarkingSettings: {
    enabled: boolean;
    subjects: string[]; // Subjects that require step marking
    stepWeightDistribution: {
      understanding: number; // Understanding the problem
      method: number; // Choosing correct method
      calculation: number; // Calculation accuracy
      finalAnswer: number; // Final answer correctness
    };
    partialCreditEnabled: boolean;
    alternativeMethodsAccepted: boolean;
  };
  
  // Language-specific settings
  languageSettings: {
    supportedLanguages: string[]; // ['ENGLISH', 'TAMIL', 'HINDI', etc.]
    spellingCorrectionEnabled: boolean; // Whether to correct spelling
    grammarCorrectionEnabled: boolean; // Whether to correct grammar
    preserveOriginalLanguage: boolean; // Keep student's original language
    alternativeAnswersAccepted: boolean; // Accept alternative correct answers
  };
  
  // AI correction settings
  aiCorrectionSettings: {
    confidenceThreshold: number; // Minimum confidence for AI correction
    humanReviewRequired: boolean; // Whether human review is mandatory
    autoLearningEnabled: boolean; // Whether AI learns from manual corrections
    customInstructions: string; // Custom instructions for AI
    subjectSpecificPrompts: {
      [subjectName: string]: string; // Subject-specific AI prompts
    };
  };
  
  // Quality assessment settings
  qualityAssessmentSettings: {
    handwritingQualityWeight: number; // Weight for handwriting quality
    presentationWeight: number; // Weight for presentation
    diagramQualityWeight: number; // Weight for diagram quality
    organizationWeight: number; // Weight for answer organization
  };
  
  // Feedback settings
  feedbackSettings: {
    detailedFeedbackEnabled: boolean;
    strengthsHighlightEnabled: boolean;
    improvementSuggestionsEnabled: boolean;
    performanceAnalysisEnabled: boolean;
    customFeedbackTemplates: {
      [gradeRange: string]: string; // Custom feedback for different grade ranges
    };
  };
  
  // Cloud storage settings
  cloudStorageSettings: {
    retentionPeriod: number; // Retention period in days (365 for 1 year)
    autoDeleteEnabled: boolean;
    backupEnabled: boolean;
    compressionEnabled: boolean;
  };
  
  // Printing settings
  printingSettings: {
    individualPrintEnabled: boolean;
    batchPrintEnabled: boolean;
    printFormat: 'PDF' | 'DOCX' | 'BOTH';
    includeFeedback: boolean;
    includePerformanceAnalysis: boolean;
    customPrintTemplate?: string;
  };
  
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EvaluationSettingsSchema = new Schema<IEvaluationSettings>(
  {
    examId: { 
      type: Schema.Types.ObjectId, 
      ref: "Exam", 
      required: true,
      index: true
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
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    
    // Minus marks configuration
    minusMarksSettings: {
      spellingMistakesPenalty: { 
        type: Number, 
        default: 5, 
        min: 0, 
        max: 100 
      },
      stepMistakesPenalty: { 
        type: Number, 
        default: 10, 
        min: 0, 
        max: 100 
      },
      diagramMistakesPenalty: { 
        type: Number, 
        default: 15, 
        min: 0, 
        max: 100 
      },
      missingKeywordsPenalty: { 
        type: Number, 
        default: 8, 
        min: 0, 
        max: 100 
      },
      handwritingQualityPenalty: { 
        type: Number, 
        default: 5, 
        min: 0, 
        max: 100 
      },
      lateSubmissionPenalty: { 
        type: Number, 
        default: 10, 
        min: 0, 
        max: 100 
      },
      incompleteAnswerPenalty: { 
        type: Number, 
        default: 20, 
        min: 0, 
        max: 100 
      }
    },
    
    // Step-by-step marking settings
    stepMarkingSettings: {
      enabled: { 
        type: Boolean, 
        default: true 
      },
      subjects: [{ 
        type: String 
      }], // ['MATHEMATICS', 'PHYSICS', 'CHEMISTRY', etc.]
      stepWeightDistribution: {
        understanding: { 
          type: Number, 
          default: 25, 
          min: 0, 
          max: 100 
        },
        method: { 
          type: Number, 
          default: 35, 
          min: 0, 
          max: 100 
        },
        calculation: { 
          type: Number, 
          default: 25, 
          min: 0, 
          max: 100 
        },
        finalAnswer: { 
          type: Number, 
          default: 15, 
          min: 0, 
          max: 100 
        }
      },
      partialCreditEnabled: { 
        type: Boolean, 
        default: true 
      },
      alternativeMethodsAccepted: { 
        type: Boolean, 
        default: true 
      }
    },
    
    // Language-specific settings
    languageSettings: {
      supportedLanguages: [{ 
        type: String,
        enum: ['ENGLISH', 'TAMIL', 'HINDI', 'MALAYALAM', 'TELUGU', 'KANNADA', 'FRENCH']
      }],
      spellingCorrectionEnabled: { 
        type: Boolean, 
        default: false // Don't correct spelling by default
      },
      grammarCorrectionEnabled: { 
        type: Boolean, 
        default: false 
      },
      preserveOriginalLanguage: { 
        type: Boolean, 
        default: true 
      },
      alternativeAnswersAccepted: { 
        type: Boolean, 
        default: true 
      }
    },
    
    // AI correction settings
    aiCorrectionSettings: {
      confidenceThreshold: { 
        type: Number, 
        default: 0.7, 
        min: 0, 
        max: 1 
      },
      humanReviewRequired: { 
        type: Boolean, 
        default: false 
      },
      autoLearningEnabled: { 
        type: Boolean, 
        default: true 
      },
      customInstructions: { 
        type: String,
        trim: true
      },
      subjectSpecificPrompts: { 
        type: Map, 
        of: String 
      }
    },
    
    // Quality assessment settings
    qualityAssessmentSettings: {
      handwritingQualityWeight: { 
        type: Number, 
        default: 5, 
        min: 0, 
        max: 100 
      },
      presentationWeight: { 
        type: Number, 
        default: 10, 
        min: 0, 
        max: 100 
      },
      diagramQualityWeight: { 
        type: Number, 
        default: 15, 
        min: 0, 
        max: 100 
      },
      organizationWeight: { 
        type: Number, 
        default: 10, 
        min: 0, 
        max: 100 
      }
    },
    
    // Feedback settings
    feedbackSettings: {
      detailedFeedbackEnabled: { 
        type: Boolean, 
        default: true 
      },
      strengthsHighlightEnabled: { 
        type: Boolean, 
        default: true 
      },
      improvementSuggestionsEnabled: { 
        type: Boolean, 
        default: true 
      },
      performanceAnalysisEnabled: { 
        type: Boolean, 
        default: true 
      },
      customFeedbackTemplates: { 
        type: Map, 
        of: String 
      }
    },
    
    // Cloud storage settings
    cloudStorageSettings: {
      retentionPeriod: { 
        type: Number, 
        default: 365, // 1 year
        min: 30, 
        max: 1095 // 3 years max
      },
      autoDeleteEnabled: { 
        type: Boolean, 
        default: true 
      },
      backupEnabled: { 
        type: Boolean, 
        default: true 
      },
      compressionEnabled: { 
        type: Boolean, 
        default: true 
      }
    },
    
    // Printing settings
    printingSettings: {
      individualPrintEnabled: { 
        type: Boolean, 
        default: true 
      },
      batchPrintEnabled: { 
        type: Boolean, 
        default: true 
      },
      printFormat: { 
        type: String, 
        enum: ['PDF', 'DOCX', 'BOTH'],
        default: 'PDF'
      },
      includeFeedback: { 
        type: Boolean, 
        default: true 
      },
      includePerformanceAnalysis: { 
        type: Boolean, 
        default: true 
      },
      customPrintTemplate: { 
        type: String,
        trim: true
      }
    },
    
    isActive: { 
      type: Boolean, 
      default: true 
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
EvaluationSettingsSchema.index({ examId: 1, subjectId: 1, classId: 1 });
EvaluationSettingsSchema.index({ createdBy: 1, createdAt: -1 });
EvaluationSettingsSchema.index({ isActive: 1 });

export const EvaluationSettings: Model<IEvaluationSettings> = mongoose.models.EvaluationSettings || mongoose.model<IEvaluationSettings>("EvaluationSettings", EvaluationSettingsSchema);

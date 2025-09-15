import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISyllabus extends Document {
  title: string;
  description?: string;
  subjectId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  academicYear: string;
  units: {
    unitNumber: number;
    unitName: string;
    topics: {
      topicName: string;
      subtopics?: string[];
      learningObjectives?: string[];
      estimatedHours?: number;
    }[];
    totalHours?: number;
  }[];
  totalHours: number;
  uploadedBy: mongoose.Types.ObjectId; // Teacher/Admin who uploaded
  fileUrl?: string; // If syllabus is uploaded as a file
  isActive: boolean;
  version: string;
  language: string;
}

const SyllabusSchema = new Schema<ISyllabus>(
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
    academicYear: { 
      type: String, 
      required: true,
      trim: true
    },
    units: [{
      unitNumber: { 
        type: Number, 
        required: true,
        min: 1
      },
      unitName: { 
        type: String, 
        required: true,
        trim: true
      },
      topics: [{
        topicName: { 
          type: String, 
          required: true,
          trim: true
        },
        subtopics: [{ 
          type: String,
          trim: true
        }],
        learningObjectives: [{ 
          type: String,
          trim: true
        }],
        estimatedHours: { 
          type: Number,
          min: 0
        }
      }],
      totalHours: { 
        type: Number,
        min: 0
      }
    }],
    totalHours: { 
      type: Number, 
      required: true,
      min: 0
    },
    uploadedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    fileUrl: { 
      type: String,
      trim: true
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
SyllabusSchema.index({ subjectId: 1, classId: 1, academicYear: 1 });
SyllabusSchema.index({ uploadedBy: 1, isActive: 1 });
SyllabusSchema.index({ academicYear: 1, isActive: 1 });

export const Syllabus: Model<ISyllabus> = mongoose.models.Syllabus || mongoose.model<ISyllabus>("Syllabus", SyllabusSchema);

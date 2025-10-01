import mongoose, { Document, Model } from "mongoose";
export interface ISyllabus extends Document {
    title: string;
    description?: string;
    subjectId: mongoose.Types.ObjectId;
    classId: mongoose.Types.ObjectId;
    adminId: mongoose.Types.ObjectId;
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
    uploadedBy: mongoose.Types.ObjectId;
    fileUrl?: string;
    isActive: boolean;
    version: string;
    language: string;
}
export declare const Syllabus: Model<ISyllabus>;
//# sourceMappingURL=Syllabus.d.ts.map
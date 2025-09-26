import mongoose, { Document, Model } from "mongoose";
export type AnswerSheetStatus = "UPLOADED" | "PROCESSING" | "AI_CORRECTED" | "MANUALLY_REVIEWED" | "COMPLETED" | "MISSING" | "ABSENT";
export type ScanQuality = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "UNREADABLE";
export interface IAnswerSheet extends Document {
    examId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    uploadedBy: mongoose.Types.ObjectId;
    originalFileName: string;
    cloudStorageUrl: string;
    cloudStorageKey: string;
    status: AnswerSheetStatus;
    scanQuality: ScanQuality;
    isAligned: boolean;
    rollNumberDetected: string;
    rollNumberConfidence: number;
    aiCorrectionResults?: {
        totalMarks: number;
        answers: {
            questionId: mongoose.Types.ObjectId;
            detectedAnswer: string;
            isCorrect: boolean;
            marksObtained: number;
            confidence: number;
            reasoning: string;
            corrections: string[];
        }[];
        strengths: string[];
        weakAreas: string[];
        unansweredQuestions: mongoose.Types.ObjectId[];
        irrelevantAnswers: string[];
        overallFeedback: string;
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
    acknowledgedBy?: mongoose.Types.ObjectId;
    acknowledgedAt?: Date;
    uploadedAt: Date;
    processedAt?: Date;
    completedAt?: Date;
    language: string;
    isActive: boolean;
}
export declare const AnswerSheet: Model<IAnswerSheet>;
//# sourceMappingURL=AnswerSheet.d.ts.map
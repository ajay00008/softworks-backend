import mongoose, { Document, Model } from "mongoose";
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
    detectedBy?: mongoose.Types.ObjectId;
    resolved: boolean;
    resolvedBy?: mongoose.Types.ObjectId;
    resolvedAt?: Date;
    resolutionNotes?: string;
    autoResolved: boolean;
}
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
    confidence?: number;
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
    acknowledgedBy?: mongoose.Types.ObjectId;
    acknowledgedAt?: Date;
    uploadedAt: Date;
    processedAt?: Date;
    completedAt?: Date;
    language: string;
    isActive: boolean;
    flags: IAnswerSheetFlag[];
    processingStatus: ProcessingStatus;
    flagCount: number;
    hasCriticalFlags: boolean;
    lastFlaggedAt?: Date;
    flagResolutionRate?: number;
}
export declare const AnswerSheet: Model<IAnswerSheet>;
//# sourceMappingURL=AnswerSheet.d.ts.map
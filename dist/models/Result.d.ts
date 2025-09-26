import mongoose, { Document, Model } from "mongoose";
export type SubmissionStatus = "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "LATE_SUBMISSION" | "ABSENT" | "MISSING_SHEET";
export interface IResult extends Document {
    examId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    answers: {
        questionId: mongoose.Types.ObjectId;
        answer: string;
        isCorrect: boolean;
        marksObtained: number;
        timeSpent?: number;
    }[];
    totalMarksObtained: number;
    percentage: number;
    grade?: string;
    submissionStatus: SubmissionStatus;
    submittedAt?: Date;
    startedAt?: Date;
    timeSpent?: number;
    isAbsent: boolean;
    isMissingSheet: boolean;
    absentReason?: string;
    missingSheetReason?: string;
    markedBy?: mongoose.Types.ObjectId;
    markedAt?: Date;
    remarks?: string;
    isActive: boolean;
}
export declare const Result: Model<IResult>;
//# sourceMappingURL=Result.d.ts.map
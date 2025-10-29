import mongoose, { Document, Model } from "mongoose";
export interface IEvaluationSettings extends Document {
    examId: mongoose.Types.ObjectId;
    subjectId: mongoose.Types.ObjectId;
    classId: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    minusMarksSettings: {
        spellingMistakesPenalty: number;
        stepMistakesPenalty: number;
        diagramMistakesPenalty: number;
        missingKeywordsPenalty: number;
        handwritingQualityPenalty: number;
        lateSubmissionPenalty: number;
        incompleteAnswerPenalty: number;
    };
    stepMarkingSettings: {
        enabled: boolean;
        subjects: string[];
        stepWeightDistribution: {
            understanding: number;
            method: number;
            calculation: number;
            finalAnswer: number;
        };
        partialCreditEnabled: boolean;
        alternativeMethodsAccepted: boolean;
    };
    languageSettings: {
        supportedLanguages: string[];
        spellingCorrectionEnabled: boolean;
        grammarCorrectionEnabled: boolean;
        preserveOriginalLanguage: boolean;
        alternativeAnswersAccepted: boolean;
    };
    aiCorrectionSettings: {
        confidenceThreshold: number;
        humanReviewRequired: boolean;
        autoLearningEnabled: boolean;
        customInstructions: string;
        subjectSpecificPrompts: {
            [subjectName: string]: string;
        };
    };
    qualityAssessmentSettings: {
        handwritingQualityWeight: number;
        presentationWeight: number;
        diagramQualityWeight: number;
        organizationWeight: number;
    };
    feedbackSettings: {
        detailedFeedbackEnabled: boolean;
        strengthsHighlightEnabled: boolean;
        improvementSuggestionsEnabled: boolean;
        performanceAnalysisEnabled: boolean;
        customFeedbackTemplates: {
            [gradeRange: string]: string;
        };
    };
    cloudStorageSettings: {
        retentionPeriod: number;
        autoDeleteEnabled: boolean;
        backupEnabled: boolean;
        compressionEnabled: boolean;
    };
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
export declare const EvaluationSettings: Model<IEvaluationSettings>;
//# sourceMappingURL=EvaluationSettings.d.ts.map
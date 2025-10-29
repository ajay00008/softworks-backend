export interface AICorrectionRequest {
    answerSheetId: string;
    examId: string;
    studentId: string;
    questionPaper: {
        questions: Array<{
            questionNumber: number;
            questionText: string;
            correctAnswer: string;
            maxMarks: number;
            questionType: string;
            subjectType?: 'MATHEMATICS' | 'SCIENCE' | 'LANGUAGE' | 'SOCIAL_STUDIES' | 'OTHER';
            requiresSteps?: boolean;
        }>;
        totalMarks: number;
        subjectName?: string;
        syllabus?: string;
    };
    answerSheetImage: string;
    language?: 'ENGLISH' | 'TAMIL' | 'HINDI' | 'MALAYALAM' | 'TELUGU' | 'KANNADA' | 'FRENCH';
    evaluationSettings?: {
        spellingMistakesPenalty: number;
        stepMistakesPenalty: number;
        diagramMistakesPenalty: number;
        missingKeywordsPenalty: number;
        handwritingQualityWeight: number;
        partialCreditEnabled: boolean;
        alternativeAnswersAccepted: boolean;
    };
}
export interface StepMarks {
    stepNumber: number;
    stepDescription: string;
    marksAwarded: number;
    maxMarks: number;
    feedback: string;
}
export interface AICorrectionResult {
    answerSheetId: string;
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
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
        stepMarks?: StepMarks[];
        deductions: {
            spellingMistakes: number;
            stepMistakes: number;
            diagramMistakes: number;
            missingKeywords: number;
            handwritingQuality: number;
        };
        alternativeAnswers?: string[];
        handwritingQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
        languageDetected: string;
        spellingErrors: string[];
        grammarErrors: string[];
    }>;
    overallFeedback: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    performanceAnalysis: {
        subjectMastery: number;
        problemSolvingSkills: number;
        conceptualUnderstanding: number;
        applicationSkills: number;
        areasOfExcellence: string[];
        areasNeedingImprovement: string[];
        unansweredQuestions: number[];
        partiallyAnsweredQuestions: number[];
        irrelevantAnswers: number[];
    };
    processingTime: number;
    errors?: string[];
    warnings?: string[];
}
export declare class EnhancedAICorrectionService {
    private static genAI;
    private static model;
    private static languageConfigs;
    /**
     * Initialize the enhanced AI correction service
     */
    static initialize(): void;
    /**
     * Process answer sheet with enhanced AI correction
     */
    static processAnswerSheet(request: AICorrectionRequest): Promise<AICorrectionResult>;
    /**
     * Create comprehensive prompt for enhanced answer sheet correction
     */
    private static createEnhancedCorrectionPrompt;
    /**
     * Parse enhanced AI response into structured correction result
     */
    private static parseEnhancedCorrectionResponse;
    /**
     * Learn from manual corrections to improve future AI corrections
     */
    static learnFromManualCorrection(answerSheetId: string, manualCorrection: any, originalAICorrection: AICorrectionResult): Promise<void>;
    /**
     * Generate enhanced mock correction for testing
     */
    static generateEnhancedMockCorrection(request: AICorrectionRequest): Promise<AICorrectionResult>;
}
//# sourceMappingURL=enhancedAICorrectionService.d.ts.map
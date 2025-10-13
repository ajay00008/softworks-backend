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
        }>;
        totalMarks: number;
    };
    answerSheetImage: string;
    language?: string;
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
    }>;
    overallFeedback: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    processingTime: number;
    errors?: string[];
}
export declare class AICorrectionService {
    private static genAI;
    private static model;
    /**
     * Initialize the AI correction service
     */
    static initialize(): void;
    /**
     * Process answer sheet with AI correction
     */
    static processAnswerSheet(request: AICorrectionRequest): Promise<AICorrectionResult>;
    /**
     * Create comprehensive prompt for answer sheet correction
     */
    private static createCorrectionPrompt;
    /**
     * Parse AI response into structured correction result
     */
    private static parseCorrectionResponse;
    /**
     * Generate mock correction for testing
     */
    static generateMockCorrection(request: AICorrectionRequest): Promise<AICorrectionResult>;
}
//# sourceMappingURL=aiCorrectionService.d.ts.map
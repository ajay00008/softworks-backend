export interface AICheckingResult {
    answerSheetId: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
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
        partialCredit?: number;
        handwritingQuality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
        languageDetected?: string;
    }>;
    overallFeedback: string;
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
    processingTime: number;
    errors?: string[];
    rollNumberDetected?: string;
    rollNumberConfidence?: number;
    handwritingAnalysis?: {
        overallQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
        legibilityScore: number;
        consistencyScore: number;
        pressureAnalysis: 'LIGHT' | 'MEDIUM' | 'HEAVY';
        speedAnalysis: 'SLOW' | 'NORMAL' | 'FAST';
    };
    academicInsights?: {
        subjectMastery: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_IMPROVEMENT';
        conceptualUnderstanding: number;
        problemSolvingAbility: number;
        timeManagement: number;
        attentionToDetail: number;
    };
}
export declare class AIAnswerCheckerService {
    private static instance;
    static getInstance(): AIAnswerCheckerService;
    /**
     * Main method to check answer sheet with AI
     */
    checkAnswerSheet(answerSheetId: string): Promise<AICheckingResult>;
    /**
     * Process answer sheet with AI analysis
     */
    private processAnswerSheet;
    /**
     * Analyze individual question with AI
     */
    private analyzeQuestion;
    /**
     * Extract student answer from answer sheet (simulated OCR)
     */
    private extractStudentAnswer;
    /**
     * Check if answer is correct using AI
     */
    private checkCorrectness;
    /**
     * Calculate partial marks for subjective questions
     */
    private calculatePartialMarks;
    /**
     * Calculate semantic similarity between answers
     */
    private calculateSemanticSimilarity;
    /**
     * Calculate confidence for individual question
     */
    private calculateQuestionConfidence;
    /**
     * Assess answer clarity
     */
    private assessAnswerClarity;
    /**
     * Calculate overall confidence
     */
    private calculateOverallConfidence;
    /**
     * Generate comprehensive feedback
     */
    private generateComprehensiveFeedback;
    /**
     * Generate question-specific feedback
     */
    private generateQuestionFeedback;
    /**
     * Assess handwriting quality
     */
    private assessHandwritingQuality;
    /**
     * Detect language of the answer
     */
    private detectLanguage;
    /**
     * Analyze handwriting characteristics
     */
    private analyzeHandwriting;
    /**
     * Generate academic insights
     */
    private generateAcademicInsights;
    /**
     * Simulate AI processing time
     */
    private simulateAIProcessing;
    /**
     * Update answer sheet with AI results
     */
    private updateAnswerSheetWithResults;
    /**
     * Batch process multiple answer sheets
     */
    batchCheckAnswerSheets(answerSheetIds: string[]): Promise<AICheckingResult[]>;
    /**
     * Get AI checking statistics
     */
    getAIStats(examId: string): Promise<any>;
}
//# sourceMappingURL=aiAnswerChecker.d.ts.map
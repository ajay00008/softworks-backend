export interface EnhancedQuestionGenerationRequest {
    subjectId: string;
    classId: string;
    subjectName: string;
    className: string;
    examTitle: string;
    markDistribution: {
        oneMark: number;
        twoMark: number;
        threeMark: number;
        fiveMark: number;
        totalQuestions: number;
        totalMarks: number;
    };
    bloomsDistribution: Array<{
        level: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
        percentage: number;
    }>;
    questionTypeDistribution: Array<{
        type: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
        percentage: number;
    }>;
    useSubjectBook: boolean;
    customInstructions?: string;
    difficultyLevel: 'EASY' | 'MODERATE' | 'TOUGHEST';
    twistedQuestionsPercentage: number;
    language: 'ENGLISH' | 'TAMIL' | 'HINDI' | 'MALAYALAM' | 'TELUGU' | 'KANNADA';
    patternFilePath?: string;
}
export interface EnhancedGeneratedQuestion {
    questionText: string;
    questionType: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
    marks: number;
    bloomsLevel: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
    difficulty: 'EASY' | 'MODERATE' | 'TOUGHEST';
    isTwisted: boolean;
    options?: string[];
    correctAnswer: string;
    explanation?: string;
    matchingPairs?: {
        left: string;
        right: string;
    }[];
    multipleCorrectAnswers?: string[];
    drawingInstructions?: string;
    markingInstructions?: string;
    visualAids?: string[];
    tags?: string[];
}
export interface AIConfig {
    provider: 'OPENAI' | 'GEMINI' | 'ANTHROPIC' | 'MOCK';
    apiKey: string;
    model: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
}
export declare class EnhancedAIService {
    private static config;
    /**
     * Initialize AI service with configuration
     */
    static initialize(config?: Partial<AIConfig>): void;
    /**
     * Generate comprehensive question paper using AI
     */
    static generateQuestionPaper(request: EnhancedQuestionGenerationRequest): Promise<EnhancedGeneratedQuestion[]>;
    /**
     * Create comprehensive prompt for question paper generation
     */
    private static createQuestionPaperPrompt;
    /**
     * Get human-readable question type name
     */
    private static getQuestionTypeName;
    /**
     * Generate questions using Gemini API
     */
    private static generateWithGemini;
    /**
     * Generate questions using OpenAI API
     */
    private static generateWithOpenAI;
    /**
     * Generate questions using Anthropic API
     */
    private static generateWithAnthropic;
    /**
     * Generate mock question paper for testing
     */
    private static generateMockQuestionPaper;
    /**
     * Create a mock question for testing
     */
    private static createMockQuestion;
    /**
     * Enforce mark-based question types after AI generation
     */
    private static enforceMarkBasedQuestionTypes;
    /**
     * Parse generated questions from AI response
     */
    private static parseGeneratedQuestions;
}
//# sourceMappingURL=enhancedAIService.d.ts.map
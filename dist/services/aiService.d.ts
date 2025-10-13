export interface QuestionGenerationRequest {
    subjectId: string;
    classId: string;
    unit: string;
    questionDistribution: Array<{
        bloomsLevel: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
        difficulty: 'EASY' | 'MODERATE' | 'TOUGHEST';
        percentage: number;
        twistedPercentage: number;
    }>;
    totalQuestions: number;
    language: 'ENGLISH' | 'TAMIL' | 'HINDI' | 'MALAYALAM' | 'TELUGU' | 'KANNADA';
    subjectName?: string;
    className?: string;
}
export interface GeneratedQuestion {
    questionText: string;
    questionType: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
    options?: string[];
    correctAnswer: string;
    explanation: string;
    marks: number;
    timeLimit?: number;
    tags?: string[];
    matchingPairs?: {
        left: string;
        right: string;
    }[];
    multipleCorrectAnswers?: string[];
    drawingInstructions?: string;
    markingInstructions?: string;
    visualAids?: string[];
    interactiveElements?: string[];
}
export interface AIConfig {
    provider: 'OPENAI' | 'GEMINI' | 'ANTHROPIC' | 'MOCK';
    apiKey: string;
    model: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
}
export declare class AIService {
    private static config;
    /**
     * Initialize AI service with configuration
     */
    static initialize(config?: Partial<AIConfig>): void;
    /**
     * Generate questions using the configured AI provider
     */
    static generateQuestions(request: QuestionGenerationRequest): Promise<GeneratedQuestion[]>;
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
     * Generate mock questions for testing
     */
    private static generateMockQuestions;
    /**
     * Create a comprehensive prompt for question generation
     */
    private static createQuestionGenerationPrompt;
    /**
     * Parse the generated questions from AI response
     */
    private static parseGeneratedQuestions;
    /**
     * Generate a single question for testing
     */
    static generateSingleQuestion(subject: string, unit: string, bloomsLevel: string, difficulty: string, language?: string): Promise<GeneratedQuestion>;
    /**
     * Get current AI configuration
     */
    static getConfig(): AIConfig;
    /**
     * Update AI configuration
     */
    static updateConfig(newConfig: Partial<AIConfig>): void;
}
export default AIService;
//# sourceMappingURL=aiService.d.ts.map
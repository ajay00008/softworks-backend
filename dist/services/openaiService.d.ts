export interface QuestionGenerationRequest {
    subjectId: string;
    classId: string;
    unit: string;
    questionDistribution: Array<{
        bloomsLevel: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
        difficulty: 'EASY' | 'MODERATE' | 'TOUGHEST';
        percentage: number;
        twistedPercentage?: number;
    }>;
    totalQuestions: number;
    language: 'ENGLISH' | 'TAMIL' | 'HINDI' | 'MALAYALAM' | 'TELUGU' | 'KANNADA';
    subjectName?: string;
    className?: string;
}
export interface GeneratedQuestion {
    questionText: string;
    questionType: 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'LONG_ANSWER' | 'TRUE_FALSE' | 'FILL_BLANKS';
    options?: string[];
    correctAnswer: string;
    explanation: string;
    marks: number;
    timeLimit?: number;
    tags?: string[];
}
export declare class OpenAIService {
    /**
     * Generate questions using OpenAI API
     */
    static generateQuestions(request: QuestionGenerationRequest): Promise<GeneratedQuestion[]>;
    /**
     * Create a comprehensive prompt for question generation
     */
    private static createQuestionGenerationPrompt;
    /**
     * Parse the generated questions from OpenAI response
     */
    private static parseGeneratedQuestions;
    /**
     * Generate a single question for testing
     */
    static generateSingleQuestion(subject: string, unit: string, bloomsLevel: string, difficulty: string, language?: string): Promise<GeneratedQuestion>;
}
export default OpenAIService;
//# sourceMappingURL=openaiService.d.ts.map
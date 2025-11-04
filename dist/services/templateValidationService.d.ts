export interface TemplateValidationResult {
    isValid: boolean;
    confidence: number;
    detectedSubject?: string;
    detectedClass?: string;
    detectedExamType?: string;
    validationErrors: string[];
    suggestions: string[];
    extractedPattern?: {
        totalQuestions: number;
        markDistribution: {
            oneMark: number;
            twoMark: number;
            threeMark: number;
            fiveMark: number;
            totalMarks: number;
        };
        questionTypes: string[];
        difficultyLevels: string[];
        bloomsDistribution: {
            remember: number;
            understand: number;
            apply: number;
            analyze: number;
            evaluate: number;
            create: number;
        };
        sections?: Array<{
            name: string;
            questions: number;
            marks: number;
        }>;
    };
}
export declare class TemplateValidationService {
    constructor();
    /**
     * Validates an uploaded template PDF against the specified subject and exam type
     */
    validateTemplate(filePath: string, expectedSubjectId: string, expectedExamType: string): Promise<TemplateValidationResult>;
    /**
     * Analyzes the PDF content to extract pattern information
     */
    private analyzeTemplateContent;
    /**
     * Detects subject from PDF text
     */
    private detectSubjectFromText;
    /**
     * Detects exam type from PDF text
     */
    private detectExamTypeFromText;
    /**
     * Extracts pattern information from PDF text
     */
    private extractPatternFromText;
    /**
     * Extracts mark distribution from text
     */
    private extractMarkDistribution;
    /**
     * Extracts total question count from text
     */
    private extractQuestionCount;
    /**
     * Extracts question types from text
     */
    private extractQuestionTypes;
    /**
     * Extracts difficulty levels from text
     */
    private extractDifficultyLevels;
    /**
     * Extracts Blooms taxonomy distribution from text
     */
    private extractBloomsDistribution;
    /**
     * Extracts sections from PDF text
     */
    private extractSections;
    /**
     * Validates the analysis result against expected parameters
     */
    private validateAgainstExpected;
}
//# sourceMappingURL=templateValidationService.d.ts.map
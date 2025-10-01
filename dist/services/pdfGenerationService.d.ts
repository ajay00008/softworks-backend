export interface GeneratedQuestion {
    questionText: string;
    questionType: string;
    marks: number;
    bloomsLevel: string;
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
}
export declare class PDFGenerationService {
    private static readonly PUBLIC_FOLDER;
    private static readonly QUESTION_PAPERS_FOLDER;
    /**
     * Initialize the service by creating necessary directories
     */
    static initialize(): void;
    /**
     * Generate PDF for a question paper
     */
    static generateQuestionPaperPDF(questionPaperId: string, questions: GeneratedQuestion[], subjectName: string, className: string, examTitle: string, totalMarks: number, duration: number): Promise<{
        fileName: string;
        filePath: string;
        downloadUrl: string;
    }>;
    /**
     * Add header to the PDF
     */
    private static addHeader;
    /**
     * Add instructions to the PDF
     */
    private static addInstructions;
    /**
     * Add a question to the PDF
     */
    private static addQuestion;
    /**
     * Add multiple choice options
     */
    private static addMultipleChoiceOptions;
    /**
     * Add True/False options
     */
    private static addTrueFalseOptions;
    /**
     * Add matching pairs
     */
    private static addMatchingPairs;
    /**
     * Add drawing instructions
     */
    private static addDrawingInstructions;
    /**
     * Add marking instructions
     */
    private static addMarkingInstructions;
    /**
     * Add fill in the blanks instructions
     */
    private static addFillBlanksInstructions;
    /**
     * Add one word answer instructions
     */
    private static addOneWordAnswerInstructions;
    /**
     * Add answer space based on marks
     */
    private static addAnswerSpace;
    /**
     * Add drawing space
     */
    private static addDrawingSpace;
    /**
     * Add footer to the PDF
     */
    private static addFooter;
    /**
     * Get download URL for a question paper PDF
     */
    static getDownloadUrl(fileName: string): string;
    /**
     * Delete a question paper PDF file
     */
    static deleteQuestionPaperPDF(fileName: string): Promise<boolean>;
}
//# sourceMappingURL=pdfGenerationService.d.ts.map
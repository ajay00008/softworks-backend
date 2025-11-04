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
    visualAids?: string[];
}
export declare class PDFGenerationService {
    private static readonly PUBLIC_FOLDER;
    private static readonly QUESTION_PAPERS_FOLDER;
    static initialize(): void;
    static generateQuestionPaperPDF(questionPaperId: string, questions: GeneratedQuestion[], subjectName: string, className: string, examTitle: string, totalMarks: number, duration: number): Promise<{
        fileName: string;
        filePath: string;
        downloadUrl: string;
    }>;
    /**
     * Extract text content from a PDF file
     * For now, this is a mock implementation that returns sample text
     * In production, you would use a proper PDF text extraction library
     */
    static extractTextFromPDF(filePath: string): Promise<string>;
    private static addHeader;
    private static addInstructions;
    private static addQuestion;
    private static addFooter;
    static deleteQuestionPaperPDF(fileName: string): Promise<void>;
}
//# sourceMappingURL=pdfGenerationService.d.ts.map
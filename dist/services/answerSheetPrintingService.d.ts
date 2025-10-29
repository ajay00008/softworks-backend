export interface PrintOptions {
    includeFeedback: boolean;
    includePerformanceAnalysis: boolean;
    includeAnswerSheetImage: boolean;
    includeStepMarks: boolean;
    includeDeductions: boolean;
    format: 'PDF' | 'DOCX';
    template?: string;
}
export interface PrintResult {
    success: boolean;
    filePath?: string;
    fileName?: string;
    fileSize?: number;
    error?: string;
}
export declare class AnswerSheetPrintingService {
    /**
     * Print individual answer sheet
     */
    static printIndividualAnswerSheet(answerSheetId: string, options?: PrintOptions): Promise<PrintResult>;
    /**
     * Print batch of answer sheets
     */
    static printBatchAnswerSheets(examId: string, studentIds?: string[], options?: PrintOptions): Promise<PrintResult>;
    /**
     * Generate PDF for individual answer sheet
     */
    private static generatePDF;
    /**
     * Generate batch PDF for multiple answer sheets
     */
    private static generateBatchPDF;
    /**
     * Generate DOCX (placeholder - would need docx library)
     */
    private static generateDOCX;
    /**
     * Generate batch DOCX (placeholder)
     */
    private static generateBatchDOCX;
    /**
     * Wrap text to fit within specified width
     */
    private static wrapText;
}
//# sourceMappingURL=answerSheetPrintingService.d.ts.map
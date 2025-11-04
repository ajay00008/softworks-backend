export interface DiagramInfo {
    type: 'diagram' | 'graph' | 'chart' | 'figure' | 'illustration';
    description: string;
    location: string;
    relatedContent?: string;
    context?: string;
}
export interface PatternAnalysisResult {
    hasDiagrams: boolean;
    diagrams: DiagramInfo[];
    diagramCount: number;
    analysisComplete: boolean;
}
export declare class PatternAnalysisService {
    private static genAI;
    private static model;
    /**
     * Initialize Gemini AI for pattern analysis
     */
    static initialize(): void;
    /**
     * Check if file is a PDF
     */
    private static isPDF;
    /**
     * Analyze pattern file for diagrams and graphs
     */
    static analyzePatternForDiagrams(patternFilePath: string): Promise<PatternAnalysisResult>;
    /**
     * Parse the AI response to extract diagram information
     */
    private static parseAnalysisResponse;
    /**
     * Get diagram information as formatted string for AI prompt
     */
    static formatDiagramsForPrompt(analysis: PatternAnalysisResult): string;
}
//# sourceMappingURL=patternAnalysisService.d.ts.map
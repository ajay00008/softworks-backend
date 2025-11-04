export interface RollNumberDetectionResult {
    rollNumber?: string;
    confidence: number;
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    alternatives?: Array<{
        rollNumber: string;
        confidence: number;
    }>;
    imageQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    processingTime: number;
}
export interface StudentMatchingResult {
    matchedStudent?: {
        id: string;
        name: string;
        rollNumber: string;
        email: string;
    };
    confidence: number;
    alternatives?: Array<{
        student: {
            id: string;
            name: string;
            rollNumber: string;
        };
        confidence: number;
    }>;
    processingTime: number;
}
export interface AIUploadResult {
    answerSheetId: string;
    originalFileName: string;
    status: string;
    rollNumberDetection: RollNumberDetectionResult;
    studentMatching: StudentMatchingResult;
    scanQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    isAligned: boolean;
    issues: string[];
    suggestions: string[];
    processingTime: number;
}
export declare class AIRollNumberDetectionService {
    private static instance;
    private static genAI;
    private static model;
    static getInstance(): AIRollNumberDetectionService;
    /**
     * Initialize Gemini AI for vision processing
     */
    private static initializeGemini;
    /**
     * Convert PDF buffer to image buffer using pdfjs-dist and canvas
     * Pure npm packages - no system dependencies required
     *
     * NOTE: This function is no longer used. We now send PDFs directly to Gemini Vision API
     * which supports PDFs natively, avoiding the need for PDF-to-image conversion.
     * Keeping this commented for reference, but it's not called anywhere.
     */
    /**
     * Detect if buffer is a PDF
     */
    private isPDF;
    /**
     * Process image buffer (ensure it's in the right format for Gemini)
     */
    private processImageBuffer;
    /**
     * Detect roll number from answer sheet using Gemini Vision API
     * Supports both PDF and image files directly (like super admin template validation)
     */
    detectRollNumber(imageBuffer: Buffer, fileName: string): Promise<RollNumberDetectionResult>;
    /**
     * Extract roll number from AI response text
     */
    private extractRollNumberFromText;
    /**
     * Analyze image quality using sharp
     */
    private analyzeImageQualityReal;
    /**
     * Match detected roll number to student in the exam's class
     */
    matchStudentToRollNumber(rollNumber: string, examId: string, confidence: number): Promise<StudentMatchingResult>;
    /**
     * Process answer sheet upload with AI roll number detection and student matching
     */
    processAnswerSheetUpload(examId: string, imageBuffer: Buffer, fileName: string, uploadedBy: string): Promise<AIUploadResult>;
    /**
     * Simulate AI processing delay
     */
    private simulateAIProcessing;
    /**
     * Generate mock roll number detection results
     */
    private generateMockRollNumberDetection;
    /**
     * Calculate similarity between two roll numbers
     */
    private calculateRollNumberSimilarity;
    /**
     * Generate status, issues, and suggestions based on processing results
     */
    private generateStatusAndSuggestions;
}
//# sourceMappingURL=aiRollNumberDetection.d.ts.map
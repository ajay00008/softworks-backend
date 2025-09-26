export interface ImageProcessingResult {
    processedImage: Buffer;
    isAligned: boolean;
    rollNumberDetected: string;
    rollNumberConfidence: number;
    scanQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNREADABLE';
    issues: string[];
    suggestions: string[];
}
export declare class ImageProcessingService {
    /**
     * Process answer sheet image for alignment and roll number detection
     */
    static processAnswerSheet(imageBuffer: Buffer, originalFileName: string): Promise<ImageProcessingResult>;
    /**
     * Analyze image quality
     */
    private static analyzeImageQuality;
    /**
     * Detect and correct image alignment
     */
    private static detectAndCorrectAlignment;
    /**
     * Detect roll number in the image
     */
    private static detectRollNumber;
    /**
     * Calculate image sharpness
     */
    private static calculateSharpness;
    /**
     * Calculate image contrast
     */
    private static calculateContrast;
    /**
     * Generate issues based on processing results
     */
    private static generateIssues;
    /**
     * Generate suggestions based on issues
     */
    private static generateSuggestions;
    /**
     * Batch process multiple images
     */
    static batchProcessImages(images: Array<{
        buffer: Buffer;
        filename: string;
    }>): Promise<ImageProcessingResult[]>;
}
//# sourceMappingURL=imageProcessing.d.ts.map
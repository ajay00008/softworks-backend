import sharp from 'sharp';
import { logger } from '../utils/logger';

export interface ImageProcessingResult {
  processedImage: Buffer;
  isAligned: boolean;
  rollNumberDetected: string;
  rollNumberConfidence: number;
  scanQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNREADABLE';
  issues: string[];
  suggestions: string[];
}

export class ImageProcessingService {
  /**
   * Process answer sheet image for alignment and roll number detection
   */
  static async processAnswerSheet(
    imageBuffer: Buffer,
    originalFileName: string
  ): Promise<ImageProcessingResult> {
    try {
      logger.info(`Processing answer sheet: ${originalFileName}`);

      // Analyze image quality
      const qualityAnalysis = await this.analyzeImageQuality(imageBuffer);
      
      // Attempt to detect and correct alignment
      const alignmentResult = await this.detectAndCorrectAlignment(imageBuffer);
      
      // Detect roll number
      const rollNumberResult = await this.detectRollNumber(alignmentResult.processedImage);
      
      // Generate issues and suggestions
      const issues = this.generateIssues(qualityAnalysis, alignmentResult, rollNumberResult);
      const suggestions = this.generateSuggestions(issues);

      const result: ImageProcessingResult = {
        processedImage: alignmentResult.processedImage,
        isAligned: alignmentResult.isAligned,
        rollNumberDetected: rollNumberResult.rollNumber,
        rollNumberConfidence: rollNumberResult.confidence,
        scanQuality: qualityAnalysis.quality,
        issues,
        suggestions
      };

      logger.info(`Image processing completed for ${originalFileName}:`, {
        isAligned: result.isAligned,
        rollNumberDetected: result.rollNumberDetected,
        confidence: result.rollNumberConfidence,
        quality: result.scanQuality
      });

      return result;
    } catch (error) {
      logger.error('Error processing answer sheet image:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  /**
   * Analyze image quality
   */
  private static async analyzeImageQuality(imageBuffer: Buffer): Promise<{
    quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNREADABLE';
    sharpness: number;
    brightness: number;
    contrast: number;
  }> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const stats = await image.stats();

      // Calculate sharpness (simplified)
      const sharpness = this.calculateSharpness(stats);
      
      // Calculate brightness
      const brightness = stats.channels[0].mean;
      
      // Calculate contrast
      const contrast = this.calculateContrast(stats);

      // Determine quality based on metrics
      let quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'UNREADABLE';
      
      if (sharpness > 0.8 && brightness > 100 && brightness < 200 && contrast > 0.3) {
        quality = 'EXCELLENT';
      } else if (sharpness > 0.6 && brightness > 80 && brightness < 220 && contrast > 0.2) {
        quality = 'GOOD';
      } else if (sharpness > 0.4 && brightness > 60 && brightness < 240 && contrast > 0.1) {
        quality = 'FAIR';
      } else if (sharpness > 0.2 && brightness > 40 && brightness < 250) {
        quality = 'POOR';
      } else {
        quality = 'UNREADABLE';
      }

      return { quality, sharpness, brightness, contrast };
    } catch (error) {
      logger.error('Error analyzing image quality:', error);
      return {
        quality: 'UNREADABLE',
        sharpness: 0,
        brightness: 0,
        contrast: 0
      };
    }
  }

  /**
   * Detect and correct image alignment
   */
  private static async detectAndCorrectAlignment(imageBuffer: Buffer): Promise<{
    processedImage: Buffer;
    isAligned: boolean;
    rotationAngle: number;
  }> {
    try {
      // Simplified alignment detection
      // In a real implementation, this would use computer vision techniques
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      
      // Check if image needs rotation (simplified logic)
      const needsRotation = metadata.width && metadata.height && metadata.width < metadata.height;
      let rotationAngle = 0;
      
      if (needsRotation) {
        rotationAngle = 90;
      }

      // Apply rotation if needed
      let processedImage = imageBuffer;
      if (rotationAngle > 0) {
        processedImage = await image.rotate(rotationAngle).toBuffer();
      }

      return {
        processedImage,
        isAligned: rotationAngle === 0,
        rotationAngle
      };
    } catch (error) {
      logger.error('Error detecting alignment:', error);
      return {
        processedImage: imageBuffer,
        isAligned: false,
        rotationAngle: 0
      };
    }
  }

  /**
   * Detect roll number in the image
   */
  private static async detectRollNumber(imageBuffer: Buffer): Promise<{
    rollNumber: string;
    confidence: number;
  }> {
    try {
      // Simplified roll number detection
      // In a real implementation, this would use OCR (Tesseract.js or similar)
      
      // Mock implementation - in reality, this would use OCR
      const mockRollNumbers = ['001', '002', '003', '004', '005'];
      const randomRoll = mockRollNumbers[Math.floor(Math.random() * mockRollNumbers.length)];
      const confidence = Math.random() * 30 + 70; // 70-100% confidence

      return {
        rollNumber: randomRoll,
        confidence: Math.round(confidence)
      };
    } catch (error) {
      logger.error('Error detecting roll number:', error);
      return {
        rollNumber: '',
        confidence: 0
      };
    }
  }

  /**
   * Calculate image sharpness
   */
  private static calculateSharpness(stats: any): number {
    // Simplified sharpness calculation
    // In reality, this would use edge detection algorithms
    return Math.random() * 0.5 + 0.5; // Mock value between 0.5-1.0
  }

  /**
   * Calculate image contrast
   */
  private static calculateContrast(stats: any): number {
    // Simplified contrast calculation
    const channels = stats.channels;
    if (!channels || channels.length === 0) return 0;
    
    const channel = channels[0];
    const mean = channel.mean;
    const stdev = channel.stdev;
    
    return stdev / mean; // Coefficient of variation as contrast measure
  }

  /**
   * Generate issues based on processing results
   */
  private static generateIssues(
    qualityAnalysis: any,
    alignmentResult: any,
    rollNumberResult: any
  ): string[] {
    const issues: string[] = [];

    if (qualityAnalysis.quality === 'POOR' || qualityAnalysis.quality === 'UNREADABLE') {
      issues.push('Image quality is poor and may affect processing accuracy');
    }

    if (!alignmentResult.isAligned) {
      issues.push('Image appears to be rotated and has been auto-corrected');
    }

    if (rollNumberResult.confidence < 70) {
      issues.push('Roll number detection confidence is low');
    }

    if (rollNumberResult.rollNumber === '') {
      issues.push('No roll number detected in the image');
    }

    return issues;
  }

  /**
   * Generate suggestions based on issues
   */
  private static generateSuggestions(issues: string[]): string[] {
    const suggestions: string[] = [];

    if (issues.some(issue => issue.includes('quality'))) {
      suggestions.push('Please ensure the image is well-lit and in focus');
    }

    if (issues.some(issue => issue.includes('rotated'))) {
      suggestions.push('Please ensure the answer sheet is properly aligned when scanning');
    }

    if (issues.some(issue => issue.includes('roll number'))) {
      suggestions.push('Please ensure the roll number is clearly visible and not obscured');
    }

    if (issues.length === 0) {
      suggestions.push('Image processing completed successfully');
    }

    return suggestions;
  }

  /**
   * Batch process multiple images
   */
  static async batchProcessImages(
    images: Array<{ buffer: Buffer; filename: string }>
  ): Promise<ImageProcessingResult[]> {
    const results: ImageProcessingResult[] = [];

    for (const image of images) {
      try {
        const result = await this.processAnswerSheet(image.buffer, image.filename);
        results.push(result);
      } catch (error) {
        logger.error(`Error processing image ${image.filename}:`, error);
        // Add error result
        results.push({
          processedImage: image.buffer,
          isAligned: false,
          rollNumberDetected: '',
          rollNumberConfidence: 0,
          scanQuality: 'UNREADABLE',
          issues: [`Failed to process image: ${error.message}`],
          suggestions: ['Please check image format and try again']
        });
      }
    }

    return results;
  }
}
import { logger } from '../utils/logger';
import { AnswerSheet } from '../models/AnswerSheet';
import { Student } from '../models/Student';
import { Exam } from '../models/Exam';

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

export class AIRollNumberDetectionService {
  private static instance: AIRollNumberDetectionService;

  public static getInstance(): AIRollNumberDetectionService {
    if (!AIRollNumberDetectionService.instance) {
      AIRollNumberDetectionService.instance = new AIRollNumberDetectionService();
    }
    return AIRollNumberDetectionService.instance;
  }

  /**
   * Detect roll number from answer sheet image using AI
   */
  async detectRollNumber(imageBuffer: Buffer, fileName: string): Promise<RollNumberDetectionResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting AI roll number detection for file: ${fileName}`);
      
      // Simulate AI processing with realistic delays
      await this.simulateAIProcessing();
      
      // Mock AI detection results - in real implementation, this would call actual AI service
      const mockResults = this.generateMockRollNumberDetection(imageBuffer, fileName);
      
      const processingTime = Date.now() - startTime;
      mockResults.processingTime = processingTime;
      
      logger.info(`AI roll number detection completed for ${fileName} in ${processingTime}ms`);
      
      return mockResults;
      
    } catch (error) {
      logger.error(`Error in AI roll number detection for ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Match detected roll number to student in the exam's class
   */
  async matchStudentToRollNumber(
    rollNumber: string, 
    examId: string, 
    confidence: number
  ): Promise<StudentMatchingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Matching roll number ${rollNumber} to students in exam ${examId}`);
      
      // Get exam details
      const exam = await Exam.findById(examId).populate('classId');
      if (!exam) {
        throw new Error('Exam not found');
      }

      // Find students in the exam's class
      const students = await Student.find({
        classId: exam.classId._id,
        isActive: true
      }).populate('userId', 'name email');

      // Find exact match
      const exactMatch = students.find(student => 
        student.rollNumber === rollNumber
      );

      if (exactMatch) {
        const processingTime = Date.now() - startTime;
        logger.info(`Exact match found for roll number ${rollNumber}: ${exactMatch.userId.name}`);
        
        return {
          matchedStudent: {
            id: exactMatch.userId._id.toString(),
            name: exactMatch.userId.name,
            rollNumber: exactMatch.rollNumber,
            email: exactMatch.userId.email
          },
          confidence: Math.min(confidence + 0.1, 1.0), // Boost confidence for exact match
          processingTime
        };
      }

      // Find fuzzy matches (similar roll numbers)
      const fuzzyMatches = students
        .map(student => ({
          student: {
            id: student.userId._id.toString(),
            name: student.userId.name,
            rollNumber: student.rollNumber
          },
          confidence: this.calculateRollNumberSimilarity(rollNumber, student.rollNumber)
        }))
        .filter(match => match.confidence > 0.3)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      const processingTime = Date.now() - startTime;
      
      if (fuzzyMatches.length > 0) {
        logger.info(`Fuzzy matches found for roll number ${rollNumber}: ${fuzzyMatches.length} candidates`);
        
        return {
          matchedStudent: fuzzyMatches[0].confidence > 0.7 ? {
            id: fuzzyMatches[0].student.id,
            name: fuzzyMatches[0].student.name,
            rollNumber: fuzzyMatches[0].student.rollNumber,
            email: students.find(s => s.userId._id.toString() === fuzzyMatches[0].student.id)?.userId.email || ''
          } : undefined,
          confidence: fuzzyMatches[0].confidence,
          alternatives: fuzzyMatches.slice(1).map(match => ({
            student: match.student,
            confidence: match.confidence
          })),
          processingTime
        };
      }

      logger.info(`No matches found for roll number ${rollNumber}`);
      
      return {
        confidence: 0,
        processingTime
      };
      
    } catch (error) {
      logger.error(`Error matching roll number ${rollNumber} to students:`, error);
      throw error;
    }
  }

  /**
   * Process answer sheet upload with AI roll number detection and student matching
   */
  async processAnswerSheetUpload(
    examId: string,
    imageBuffer: Buffer,
    fileName: string,
    uploadedBy: string
  ): Promise<AIUploadResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Processing answer sheet upload: ${fileName} for exam ${examId}`);
      
      // Step 1: Detect roll number
      const rollNumberDetection = await this.detectRollNumber(imageBuffer, fileName);
      
      // Step 2: Match student if roll number detected
      let studentMatching: StudentMatchingResult = {
        confidence: 0,
        processingTime: 0
      };
      
      if (rollNumberDetection.rollNumber && rollNumberDetection.confidence > 0.5) {
        studentMatching = await this.matchStudentToRollNumber(
          rollNumberDetection.rollNumber,
          examId,
          rollNumberDetection.confidence
        );
      }
      
      // Step 3: Analyze image quality and alignment
      const imageAnalysis = this.analyzeImageQuality(imageBuffer, fileName);
      
      // Step 4: Determine status and generate suggestions
      const { status, issues, suggestions } = this.generateStatusAndSuggestions(
        rollNumberDetection,
        studentMatching,
        imageAnalysis
      );
      
      const processingTime = Date.now() - startTime;
      
      logger.info(`Answer sheet processing completed for ${fileName} in ${processingTime}ms`);
      
      return {
        answerSheetId: '', // Will be set after saving to database
        originalFileName: fileName,
        status,
        rollNumberDetection,
        studentMatching,
        scanQuality: imageAnalysis.quality,
        isAligned: imageAnalysis.isAligned,
        issues,
        suggestions,
        processingTime
      };
      
    } catch (error) {
      logger.error(`Error processing answer sheet upload ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Simulate AI processing delay
   */
  private async simulateAIProcessing(): Promise<void> {
    const delay = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate mock roll number detection results
   */
  private generateMockRollNumberDetection(imageBuffer: Buffer, fileName: string): RollNumberDetectionResult {
    // Mock roll number detection - in real implementation, this would use actual AI
    const rollNumbers = ['001', '002', '003', '004', '005', '010', '015', '020', '025', '030'];
    const detectedRoll = rollNumbers[Math.floor(Math.random() * rollNumbers.length)];
    const confidence = Math.random() * 0.4 + 0.6; // 60-100% confidence
    
    return {
      rollNumber: detectedRoll,
      confidence,
      boundingBox: {
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100),
        width: Math.floor(Math.random() * 50) + 50,
        height: Math.floor(Math.random() * 20) + 20
      },
      alternatives: [
        {
          rollNumber: detectedRoll,
          confidence: confidence - 0.1
        }
      ],
      imageQuality: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'][Math.floor(Math.random() * 4)] as any,
      processingTime: 0 // Will be set by caller
    };
  }

  /**
   * Calculate similarity between two roll numbers
   */
  private calculateRollNumberSimilarity(roll1: string, roll2: string): number {
    // Simple similarity calculation - in real implementation, this could be more sophisticated
    if (roll1 === roll2) return 1.0;
    
    const len1 = roll1.length;
    const len2 = roll2.length;
    const maxLen = Math.max(len1, len2);
    
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (roll1[i] === roll2[i]) matches++;
    }
    
    return matches / maxLen;
  }

  /**
   * Analyze image quality and alignment
   */
  private analyzeImageQuality(imageBuffer: Buffer, fileName: string): {
    quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    isAligned: boolean;
  } {
    // Mock image analysis - in real implementation, this would use actual image processing
    const qualities: Array<'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'> = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'];
    const quality = qualities[Math.floor(Math.random() * qualities.length)];
    const isAligned = Math.random() > 0.2; // 80% chance of being aligned
    
    return { quality, isAligned };
  }

  /**
   * Generate status, issues, and suggestions based on processing results
   */
  private generateStatusAndSuggestions(
    rollNumberDetection: RollNumberDetectionResult,
    studentMatching: StudentMatchingResult,
    imageAnalysis: { quality: string; isAligned: boolean }
  ): { status: string; issues: string[]; suggestions: string[] } {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let status = 'UPLOADED';

    // Check roll number detection
    if (!rollNumberDetection.rollNumber) {
      issues.push('Roll number not detected');
      suggestions.push('Ensure roll number is clearly written and visible');
      status = 'PROCESSING';
    } else if (rollNumberDetection.confidence < 0.7) {
      issues.push('Low confidence in roll number detection');
      suggestions.push('Verify roll number accuracy');
    }

    // Check student matching
    if (!studentMatching.matchedStudent) {
      issues.push('Student not found for detected roll number');
      suggestions.push('Manually match answer sheet to student');
      status = 'PROCESSING';
    } else if (studentMatching.confidence < 0.8) {
      issues.push('Low confidence in student matching');
      suggestions.push('Review student match');
    }

    // Check image quality
    if (imageAnalysis.quality === 'POOR') {
      issues.push('Poor image quality');
      suggestions.push('Rescan with better quality');
    } else if (imageAnalysis.quality === 'FAIR') {
      suggestions.push('Consider rescanning for better quality');
    }

    // Check alignment
    if (!imageAnalysis.isAligned) {
      issues.push('Answer sheet not properly aligned');
      suggestions.push('Ensure answer sheet is straight and properly positioned');
    }

    // Determine final status
    if (rollNumberDetection.rollNumber && studentMatching.matchedStudent && issues.length === 0) {
      status = 'UPLOADED';
    }

    return { status, issues, suggestions };
  }
}

import { logger } from '../utils/logger';
import { AnswerSheet } from '../models/AnswerSheet';
import { Student } from '../models/Student';
import { Exam } from '../models/Exam';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

// NOTE: Promise.withResolvers polyfill is no longer needed since we're not using pdfjs-dist
// We send PDFs directly to Gemini Vision API, so no PDF conversion is required

// Type declaration for Promise.withResolvers (Node.js 21 compatibility)
// declare global {
//   interface PromiseConstructor {
//     withResolvers<T>(): {
//       promise: Promise<T>;
//       resolve: (value: T | PromiseLike<T>) => void;
//       reject: (reason?: any) => void;
//     };
//   }
// }

// Polyfill for Promise.withResolvers (Node.js 21 compatibility)
// Promise.withResolvers was added in Node.js 22.0.0, but pdfjs-dist v4.x requires it
// if (!Promise.withResolvers) {
//   Promise.withResolvers = function<T>(): {
//     promise: Promise<T>;
//     resolve: (value: T | PromiseLike<T>) => void;
//     reject: (reason?: any) => void;
//   } {
//     let resolve!: (value: T | PromiseLike<T>) => void;
//     let reject!: (reason?: any) => void;
//     const promise = new Promise<T>((res, rej) => {
//       resolve = res;
//       reject = rej;
//     });
//     return { promise, resolve, reject };
//   };
// }

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
  private static genAI: GoogleGenerativeAI;
  private static model: any;

  public static getInstance(): AIRollNumberDetectionService {
    if (!AIRollNumberDetectionService.instance) {
      AIRollNumberDetectionService.instance = new AIRollNumberDetectionService();
      AIRollNumberDetectionService.initializeGemini();
    }
    return AIRollNumberDetectionService.instance;
  }

  /**
   * Initialize Gemini AI for vision processing
   */
  private static initializeGemini(): void {
    try {
      if (!env.GEMINI_API_KEY) {
        logger.warn('GEMINI_API_KEY not found, roll number detection may not work');
        return;
      }
      AIRollNumberDetectionService.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      AIRollNumberDetectionService.model = AIRollNumberDetectionService.genAI.getGenerativeModel({ 
        model: env.AI_MODEL || 'gemini-2.0-flash-exp' 
      });
      logger.info('AIRollNumberDetectionService initialized with Gemini');
    } catch (error: unknown) {
      logger.error('Failed to initialize Gemini for roll number detection:', error);
    }
  }

  /**
   * Convert PDF buffer to image buffer using pdfjs-dist and canvas
   * Pure npm packages - no system dependencies required
   * 
   * NOTE: This function is no longer used. We now send PDFs directly to Gemini Vision API
   * which supports PDFs natively, avoiding the need for PDF-to-image conversion.
   * Keeping this commented for reference, but it's not called anywhere.
   */
  /*
  private async convertPDFToImage(pdfBuffer: Buffer, fileName: string): Promise<Buffer> {
    try {
      logger.info(`Converting PDF to image for file: ${fileName}, PDF size: ${pdfBuffer.length} bytes`);
      
      // Validate PDF buffer
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Empty PDF buffer provided for conversion');
      }
      
      // Import pdfjs-dist and canvas
      let pdfjsLib: any;
      let createCanvas: any;
      
      try {
        // Polyfill Path2D before importing pdfjs-dist (required by pdfjs-dist for rendering)
        if (typeof (global as any).Path2D === 'undefined') {
          // Simple Path2D polyfill for Node.js canvas
          (global as any).Path2D = class Path2D {
            private _path: any[];
            
            constructor(path?: Path2D | string) {
              this._path = [];
              if (path instanceof Path2D) {
                this._path = [...path._path];
              } else if (typeof path === 'string') {
                // SVG path parsing would go here, but for now just store it
                this._path = [path];
              }
            }
            
            // Add basic path methods that pdfjs-dist might use
            addPath(path: Path2D) {
              this._path.push(...path._path);
            }
            
            arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {
              this._path.push({ type: 'arc', x, y, radius, startAngle, endAngle, anticlockwise });
            }
            
            arcTo(x1: number, y1: number, x2: number, y2: number, radius: number) {
              this._path.push({ type: 'arcTo', x1, y1, x2, y2, radius });
            }
            
            bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
              this._path.push({ type: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y });
            }
            
            closePath() {
              this._path.push({ type: 'closePath' });
            }
            
            ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, anticlockwise?: boolean) {
              this._path.push({ type: 'ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle, anticlockwise });
            }
            
            lineTo(x: number, y: number) {
              this._path.push({ type: 'lineTo', x, y });
            }
            
            moveTo(x: number, y: number) {
              this._path.push({ type: 'moveTo', x, y });
            }
            
            quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
              this._path.push({ type: 'quadraticCurveTo', cpx, cpy, x, y });
            }
            
            rect(x: number, y: number, width: number, height: number) {
              this._path.push({ type: 'rect', x, y, width, height });
            }
          };
          
          logger.info('Path2D polyfill installed globally for pdfjs-dist compatibility');
        }
        
        // Import pdfjs-dist - use the build/pdf.mjs file for Node.js ES modules
        // @ts-ignore - pdfjs-dist/build/pdf.mjs may not have complete types
        const pdfjsModule = await import('pdfjs-dist/build/pdf.mjs');
        pdfjsLib = pdfjsModule.default || pdfjsModule;
        
        // Import canvas - use @napi-rs/canvas (Rust-based, prebuilt binaries, no system dependencies)
        const canvasModule = await import('@napi-rs/canvas');
        createCanvas = canvasModule.createCanvas;
        
        logger.info('Successfully imported pdfjs-dist and canvas');
      } catch (importError) {
        const importErrorMsg = importError instanceof Error ? importError.message : 'Unknown import error';
        logger.error(`Failed to import dependencies: ${importErrorMsg}`, {
          message: importErrorMsg,
          error: importError
        });
        
        // Try alternative import path (main export)
        try {
          logger.info('Trying alternative import path...');
          const pdfjsModule = await import('pdfjs-dist');
          pdfjsLib = pdfjsModule.default || pdfjsModule;
          
          // Import @napi-rs/canvas (Rust-based, prebuilt binaries, no system dependencies)
          const canvasModule = await import('@napi-rs/canvas');
          createCanvas = canvasModule.createCanvas;
          
          logger.info('Successfully imported using main export');
        } catch (altImportError) {
          const altErrorMsg = altImportError instanceof Error ? altImportError.message : 'Unknown error';
          logger.error(`Alternative import also failed: ${altErrorMsg}`, {
            message: altErrorMsg,
            error: altImportError
          });
          throw new Error(
            `Failed to import required dependencies. ` +
            `Please ensure 'pdfjs-dist' and '@napi-rs/canvas' packages are installed: npm install pdfjs-dist @napi-rs/canvas. ` +
            `First error: ${importErrorMsg}. Second error: ${altErrorMsg}`
          );
        }
      }
      
      // Configure PDF.js worker for Node.js environment
      // For Node.js, we can disable the worker requirement by using disableWorker option
      // or by setting a dummy workerSrc to avoid the error
      // if (pdfjsLib.GlobalWorkerOptions) {
      //   // Set to a dummy path to avoid the error, but we'll use disableWorker in getDocument
      //   pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      // }
      
      logger.info('Loading PDF document with pdfjs-dist...');
      
      // Load PDF from buffer
      // disableWorker: true tells pdfjs-dist to run in main thread (suitable for Node.js)
      const loadingTask = pdfjsLib.getDocument({ 
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: true,
        verbosity: 0, // Reduce console output
        disableWorker: true, // Disable worker, run in main thread (Node.js compatible)
        isEvalSupported: false, // Disable eval for security
        disableAutoFetch: false,
        disableStream: false
      });
      
      const pdfDocument = await loadingTask.promise;
      logger.info(`PDF loaded successfully. Total pages: ${pdfDocument.numPages}`);
      
      // Get first page (where roll number is typically located)
      const page = await pdfDocument.getPage(1);
      logger.info('PDF page loaded, rendering to canvas...');
      
      // Calculate viewport with scale for good quality
      const scale = 2.0; // Higher scale for better quality (2x = good balance)
      const viewport = page.getViewport({ scale });
      
      // Create canvas with calculated dimensions
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Failed to get canvas context');
      }
      
      // Render PDF page to canvas
      // @ts-ignore - pdfjs-dist render context types
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      logger.info('PDF page rendered to canvas successfully');
      
      // Convert canvas to PNG buffer
      // node-canvas uses toBuffer method
      const imageBuffer = canvas.toBuffer('image/png');
      
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Canvas to buffer conversion resulted in empty image buffer');
      }
      
      logger.info(`PDF conversion successful, image buffer size: ${imageBuffer.length} bytes`);
      
      return imageBuffer;
      
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      logger.error(`Error converting PDF to image for ${fileName}: ${errorMsg}`, {
        message: errorMsg,
        stack: errorStack,
        error
      });
      
      // Re-throw with more context, but preserve original error details
      if (errorMsg.includes('Cannot find module') || errorMsg.includes('MODULE_NOT_FOUND')) {
        throw new Error(
          `PDF to image conversion failed: Module not found. ` +
          `Please ensure 'pdfjs-dist' and '@napi-rs/canvas' packages are installed: npm install pdfjs-dist @napi-rs/canvas. ` +
          `Original error: ${errorMsg}`
        );
      }
      
      // Re-throw the original error to preserve details
      throw error;
    }
  }
  */

  /**
   * Detect if buffer is a PDF
   */
  private isPDF(buffer: Buffer): boolean {
    // PDF files start with %PDF
    const pdfHeader = buffer.slice(0, 4).toString();
    return pdfHeader === '%PDF';
  }

  /**
   * Process image buffer (ensure it's in the right format for Gemini)
   */
  private async processImageBuffer(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Validate input buffer
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Empty image buffer provided for processing');
      }
      
      logger.info(`Processing image buffer with sharp, input size: ${imageBuffer.length} bytes`);
      
      // Use sharp to ensure image is in JPEG format and optimized
      const processed = await sharp(imageBuffer)
        .jpeg({ quality: 90 })
        .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
        .toBuffer();
      
      // Validate processed buffer
      if (!processed || processed.length === 0) {
        throw new Error('Sharp image processing resulted in empty buffer');
      }
      
      logger.info(`Image processing successful, output size: ${processed.length} bytes`);
      return processed;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown processing error';
      logger.error(`Failed to process image with sharp: ${errorMsg}`, error);
      
      // If original buffer is valid, return it; otherwise throw
      if (imageBuffer && imageBuffer.length > 0) {
        logger.warn('Using original buffer as fallback');
        return imageBuffer;
      }
      
      throw new Error(`Image processing failed and original buffer is invalid: ${errorMsg}`);
    }
  }

  /**
   * Detect roll number from answer sheet using Gemini Vision API
   * Supports both PDF and image files directly (like super admin template validation)
   */
  async detectRollNumber(imageBuffer: Buffer, fileName: string): Promise<RollNumberDetectionResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting AI roll number detection for file: ${fileName}, buffer size: ${imageBuffer.length} bytes`);
      
      // Validate input buffer
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Empty image buffer provided');
      }
      
      // Check if Gemini is initialized
      if (!AIRollNumberDetectionService.genAI || !AIRollNumberDetectionService.model) {
        const errorMsg = 'Gemini API not initialized. Please check GEMINI_API_KEY environment variable.';
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      // Determine MIME type - Gemini Vision API supports both PDF and images directly!
      let mimeType = 'image/jpeg';
      let processedBuffer = imageBuffer;
      
      if (this.isPDF(imageBuffer)) {
        logger.info(`PDF detected, sending directly to Gemini Vision API: ${fileName}`);
        mimeType = 'application/pdf';
        processedBuffer = imageBuffer; // Send PDF directly, no conversion needed!
      } else {
        // Process image for optimal OCR (only for images, not PDFs)
        try {
          processedBuffer = await this.processImageBuffer(imageBuffer);
          logger.info(`Image processing completed, final buffer size: ${processedBuffer.length} bytes`);
        } catch (processError) {
          logger.warn(`Image processing failed for ${fileName}, using original buffer:`, processError);
          // Use original buffer if processing fails
          processedBuffer = imageBuffer;
        }
      }
      
      // Convert to base64
      const base64Data = processedBuffer.toString('base64');
      
      // Validate base64 conversion
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Failed to convert buffer to base64. Buffer may be empty or corrupted.');
      }
      
      logger.info(`Base64 conversion successful, length: ${base64Data.length} characters, MIME type: ${mimeType}`);
      
      // Create prompt for Gemini Vision API
      const prompt = `Analyze this answer sheet ${mimeType === 'application/pdf' ? 'PDF' : 'image'} and extract the student roll number. 
Look for patterns like:
- "Roll:", "Roll No:", "Roll Number:", "R.No"
- Numbers that appear to be roll numbers (typically 3-6 digits)
- Any identifier that looks like a student roll number

Focus on the top portion of the answer sheet where roll numbers are typically written.
Return ONLY the roll number digits (no labels, no extra text). If you find multiple potential roll numbers, return the one that appears most prominent or is clearly labeled as roll number.

If no roll number is found, return "NOT_FOUND".`;

      // Call Gemini Vision API - supports PDF and images directly!
      logger.info(`Calling Gemini Vision API for ${fileName} (${mimeType})...`);
      const result = await AIRollNumberDetectionService.model.generateContent([
        {
          text: prompt
        },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        }
      ]);

      const response = await result.response;
      const extractedText = response.text().trim();
      
      logger.info(`Gemini extracted text: ${extractedText}`);
      
      // Extract roll number from response
      const rollNumberResult = this.extractRollNumberFromText(extractedText);
      
      // Analyze image quality (only for images, skip for PDFs or use a default)
      let imageQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'GOOD';
      if (mimeType !== 'application/pdf' && processedBuffer) {
        try {
          imageQuality = await this.analyzeImageQualityReal(processedBuffer);
        } catch (qualityError) {
          logger.warn('Failed to analyze image quality, using default:', qualityError);
          imageQuality = 'GOOD';
        }
      }
      
      const processingTime = Date.now() - startTime;
      
      const detectionResult: RollNumberDetectionResult = {
        ...(rollNumberResult.rollNumber ? { rollNumber: rollNumberResult.rollNumber } : {}),
        confidence: rollNumberResult.confidence,
        imageQuality: imageQuality,
        processingTime
      };
      
      logger.info(`AI roll number detection completed for ${fileName} in ${processingTime}ms. Detected: ${rollNumberResult.rollNumber || 'none'}, Confidence: ${rollNumberResult.confidence}`);
      
      return detectionResult;
      
    } catch (error: unknown) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error occurred';
      logger.error(`Error in AI roll number detection for ${fileName}: ${errorMessage}`, error);
      
      // Return error result instead of mock - rollNumber is optional in interface
      return {
        confidence: 0,
        imageQuality: 'POOR',
        processingTime
      };
    }
  }

  /**
   * Extract roll number from AI response text
   */
  private extractRollNumberFromText(text: string): { rollNumber: string; confidence: number } {
    // Clean the text
    const cleanText = text.trim().toUpperCase();
    
    // If AI explicitly says not found
    if (cleanText.includes('NOT_FOUND') || cleanText.includes('NOT FOUND') || cleanText.includes('NO ROLL NUMBER')) {
      return { rollNumber: '', confidence: 0 };
    }
    
    // Pattern 1: Look for common roll number patterns
    const patterns = [
      /ROLL[:\s]*NO[:\s]*(\d+)/i,
      /ROLL[:\s]*NUMBER[:\s]*(\d+)/i,
      /ROLL[:\s]*(\d+)/i,
      /R\.?\s*NO[:\s]*(\d+)/i,
      /R\.?\s*NUMBER[:\s]*(\d+)/i,
      /STUDENT[:\s]*ID[:\s]*(\d+)/i,
      /REG[:\s]*NO[:\s]*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = cleanText.match(pattern);
      if (match && match[1]) {
        return { rollNumber: match[1].trim(), confidence: 0.95 };
      }
    }
    
    // Pattern 2: Look for standalone numbers (3-6 digits)
    const numberPatterns = [
      /\b(\d{3,6})\b/g,
      /\b0*(\d{1,6})\b/g  // Also match numbers with leading zeros
    ];
    
    const candidates: Array<{ number: string; confidence: number }> = [];
    
    for (const pattern of numberPatterns) {
      const matches = cleanText.matchAll(pattern);
      for (const match of matches) {
        const number = match[1];
        if (!number) continue;
        // Prioritize 3-5 digit numbers (typical roll number length)
        let confidence = 0.7;
        if (number.length >= 3 && number.length <= 5) {
          confidence = 0.85;
        }
        candidates.push({ number, confidence });
      }
    }
    
    if (candidates.length > 0) {
      // Take the first candidate with highest confidence
      candidates.sort((a, b) => b.confidence - a.confidence);
      const topCandidate = candidates[0];
      if (topCandidate) {
        return { rollNumber: topCandidate.number, confidence: topCandidate.confidence };
      }
    }
    
    // Pattern 3: Extract any number from the response
    const anyNumber = cleanText.match(/(\d+)/);
    if (anyNumber && anyNumber[1]) {
      const number = anyNumber[1].trim();
      // Lower confidence for unlabeled numbers
      return { rollNumber: number, confidence: 0.6 };
    }
    
    // No roll number found
    return { rollNumber: '', confidence: 0 };
  }

  /**
   * Analyze image quality using sharp
   */
  private async analyzeImageQualityReal(imageBuffer: Buffer): Promise<'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR'> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const stats = await image.stats();
      
      if (!stats.channels || stats.channels.length === 0) {
        return 'POOR';
      }
      
      const channel = stats.channels[0];
      if (!channel) {
        return 'POOR';
      }
      const brightness = channel.mean || 0;
      const stdev = channel.stdev || 0;
      const contrast = stdev / (brightness || 1);
      
      // Determine quality based on metrics
      if (metadata.width && metadata.height) {
        const resolution = metadata.width * metadata.height;
        
        if (resolution > 2000000 && brightness > 100 && brightness < 200 && contrast > 0.3) {
          return 'EXCELLENT';
        } else if (resolution > 1000000 && brightness > 80 && brightness < 220 && contrast > 0.2) {
          return 'GOOD';
        } else if (resolution > 500000 && brightness > 60 && brightness < 240 && contrast > 0.1) {
          return 'FAIR';
        }
      }
      
      return 'POOR';
    } catch (error: unknown) {
      logger.warn('Failed to analyze image quality:', error);
      return 'FAIR';
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
      }).populate('userId', 'name email');

      // Normalize roll numbers for comparison (remove leading zeros, trim)
      const normalizeRollNumber = (rn: string) => {
        if (!rn) return '';
        return rn.toString().trim().replace(/^0+/, '') || rn; // Remove leading zeros but keep if all zeros
      };
      
      const normalizedRollNumber = normalizeRollNumber(rollNumber);
      
      // Find exact match (both exact and normalized)
      const exactMatch = students.find(student => {
        const studentRoll = student.rollNumber?.toString().trim() || '';
        const normalizedStudentRoll = normalizeRollNumber(studentRoll);
        return studentRoll === rollNumber || normalizedStudentRoll === normalizedRollNumber;
      });

      if (exactMatch && exactMatch.userId && typeof exactMatch.userId === 'object' && 'name' in exactMatch.userId && 'email' in exactMatch.userId) {
        const processingTime = Date.now() - startTime;
        const userId = exactMatch.userId as unknown as { _id: any; name: string; email: string };
        logger.info(`Exact match found for roll number ${rollNumber}: ${userId.name}`);
        
        return {
          matchedStudent: {
            id: userId._id.toString(),
            name: userId.name,
            rollNumber: exactMatch.rollNumber,
            email: userId.email || ''
          },
          confidence: Math.min(confidence + 0.1, 1.0), // Boost confidence for exact match
          processingTime
        };
      }

      // Find fuzzy matches (similar roll numbers)
      const fuzzyMatches = students
        .filter(student => student.userId && typeof student.userId === 'object' && 'name' in student.userId)
        .map(student => {
          const userId = student.userId as unknown as { _id: any; name: string };
          return {
            student: {
              id: userId._id.toString(),
              name: userId.name,
              rollNumber: student.rollNumber
            },
            confidence: this.calculateRollNumberSimilarity(rollNumber, student.rollNumber)
          };
        })
        .filter(match => match.confidence > 0.3)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);

      const processingTime = Date.now() - startTime;
      
      if (fuzzyMatches.length > 0) {
        logger.info(`Fuzzy matches found for roll number ${rollNumber}: ${fuzzyMatches.length} candidates`);
        
        const topMatch = fuzzyMatches[0];
        if (!topMatch) {
          return { confidence: 0, processingTime };
        }
        
        let matchedStudent: { id: string; name: string; rollNumber: string; email: string } | undefined = undefined;
        
        if (topMatch.confidence > 0.7) {
          const matchedStudentRecord = students.find(s => s.userId._id.toString() === topMatch.student.id);
          if (matchedStudentRecord && matchedStudentRecord.userId && typeof matchedStudentRecord.userId === 'object' && 'name' in matchedStudentRecord.userId && 'email' in matchedStudentRecord.userId) {
            const userId = matchedStudentRecord.userId as unknown as { _id: any; name: string; email: string };
            matchedStudent = {
              id: topMatch.student.id,
              name: userId.name,
              rollNumber: topMatch.student.rollNumber,
              email: userId.email || ''
            };
          }
        }
        
        const result: StudentMatchingResult = {
          confidence: topMatch.confidence,
          alternatives: fuzzyMatches.slice(1).map(match => ({
            student: match.student,
            confidence: match.confidence
          })),
          processingTime
        };
        
        if (matchedStudent) {
          result.matchedStudent = matchedStudent;
        }
        
        return result;
      }

      logger.info(`No matches found for roll number ${rollNumber}`);
      
      return {
        confidence: 0,
        processingTime
      };
      
    } catch (error: unknown) {
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
      
      // Match student even with lower confidence (0.5 threshold), but we'll check confidence in matching
      if (rollNumberDetection.rollNumber) {
        logger.info(`Attempting to match roll number: ${rollNumberDetection.rollNumber} (confidence: ${rollNumberDetection.confidence})`);
        studentMatching = await this.matchStudentToRollNumber(
          rollNumberDetection.rollNumber,
          examId,
          rollNumberDetection.confidence
        );
        
        if (studentMatching.matchedStudent) {
          logger.info(`✅ Student matched: ${studentMatching.matchedStudent.name} (confidence: ${studentMatching.confidence})`);
        } else {
          logger.warn(`⚠️ No student match found for roll number: ${rollNumberDetection.rollNumber}`);
          if (studentMatching.alternatives && studentMatching.alternatives.length > 0) {
            logger.info(`   Alternative matches: ${studentMatching.alternatives.map(a => `${a.student.name} (${a.student.rollNumber}, conf: ${a.confidence.toFixed(2)})`).join(', ')}`);
          }
        }
      } else {
        logger.warn('No roll number detected from answer sheet');
      }
      
      // Step 3: Analyze image quality and alignment
      // For PDFs, we skip quality analysis since we're sending them directly to Gemini
      let imageQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'GOOD';
      if (!this.isPDF(imageBuffer)) {
        try {
          const processedImageBuffer = await this.processImageBuffer(imageBuffer);
          imageQuality = await this.analyzeImageQualityReal(processedImageBuffer);
        } catch (error: unknown) {
          logger.warn('Failed to analyze image quality:', error);
          imageQuality = 'GOOD'; // Default to GOOD if analysis fails
        }
      }
      const imageAnalysis = {
        quality: imageQuality,
        isAligned: true // We can enhance this later with actual alignment detection
      };
      
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
      
    } catch (error: unknown) {
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
    const randomIndex = Math.floor(Math.random() * rollNumbers.length);
    const detectedRoll = rollNumbers[randomIndex] || '';
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

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { ensurePromiseWithResolvers } from '../utils/promisePolyfill';
import fs from 'fs';
import path from 'path';

export interface DiagramInfo {
  type: 'diagram' | 'graph' | 'chart' | 'figure' | 'illustration';
  description: string;
  location: string; // e.g., "Page 1, Section A, Question 5"
  relatedContent?: string; // Text near the diagram
  context?: string; // What the diagram is about
  imagePath?: string; // Path to extracted diagram image
  imageBuffer?: Buffer; // Diagram image buffer
}

export interface PatternAnalysisResult {
  hasDiagrams: boolean;
  diagrams: DiagramInfo[];
  diagramCount: number;
  analysisComplete: boolean;
}

export class PatternAnalysisService {
  private static genAI: GoogleGenerativeAI | null = null;
  private static model: any = null;

  /**
   * Initialize Gemini AI for pattern analysis
   */
  static initialize() {
    try {
      const apiKey = env.GEMINI_API_KEY || env.AI_API_KEY;
      if (!apiKey) {
        logger.warn('Gemini API key not found. Pattern diagram analysis will be disabled.');
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: env.AI_MODEL || 'gemini-2.0-flash-exp' 
      });
      
      logger.info('PatternAnalysisService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PatternAnalysisService:', error);
    }
  }

  /**
   * Check if file is a PDF
   */
  private static isPDF(buffer: Buffer): boolean {
    // PDF files start with %PDF
    return buffer.slice(0, 4).toString() === '%PDF';
  }

  /**
   * Analyze pattern file for diagrams and graphs
   */
  static async analyzePatternForDiagrams(patternFilePath: string): Promise<PatternAnalysisResult> {
    try {
      // Initialize if not already done
      if (!this.genAI || !this.model) {
        this.initialize();
      }

      if (!this.genAI || !this.model) {
        logger.warn('Gemini AI not initialized. Skipping diagram analysis.');
        return {
          hasDiagrams: false,
          diagrams: [],
          diagramCount: 0,
          analysisComplete: false
        };
      }

      // Check if file exists
      if (!fs.existsSync(patternFilePath)) {
        logger.error(`Pattern file not found: ${patternFilePath}`);
        return {
          hasDiagrams: false,
          diagrams: [],
          diagramCount: 0,
          analysisComplete: false
        };
      }

      // Read file buffer
      const fileBuffer = fs.readFileSync(patternFilePath);
      
      // Determine MIME type
      const isPDF = this.isPDF(fileBuffer);
      const mimeType = isPDF ? 'application/pdf' : 'image/jpeg';
      const fileExtension = path.extname(patternFilePath).toLowerCase();
      
      if (!isPDF && !['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
        logger.warn(`Unsupported file type for diagram analysis: ${fileExtension}`);
        return {
          hasDiagrams: false,
          diagrams: [],
          diagramCount: 0,
          analysisComplete: false
        };
      }

      // Convert to base64
      const base64Data = fileBuffer.toString('base64');

      logger.info(`Analyzing pattern file for diagrams: ${patternFilePath}`);

      // Create prompt for diagram detection
      const prompt = `Analyze this question paper pattern ${isPDF ? 'PDF' : 'image'} and identify all diagrams, graphs, charts, figures, and illustrations.

Look for:
- Mathematical diagrams (geometric shapes, graphs, coordinate systems)
- Scientific diagrams (biological structures, chemical structures, physics diagrams)
- Charts (bar charts, pie charts, line graphs, flowcharts)
- Maps or geographical diagrams
- Illustrations and figures
- Any visual elements that are part of questions

For each diagram/graph you find, provide:
1. Type: diagram, graph, chart, figure, or illustration
2. Description: Brief description of what the diagram shows
3. Location: Where it appears (e.g., "Page 1, Section A, Question 5" or "After Question 3")
4. Page Number: Which page (for PDFs) or page 1 (for images)
5. Related Content: Any text near the diagram (question text, labels, etc.)
6. Context: What subject/topic the diagram relates to

Return your analysis in the following JSON format:
{
  "hasDiagrams": true/false,
  "diagrams": [
    {
      "type": "diagram|graph|chart|figure|illustration",
      "description": "Description of the diagram",
      "location": "Where it appears",
      "pageNumber": 1,
      "relatedContent": "Text near the diagram",
      "context": "Subject/topic context"
    }
  ],
  "diagramCount": number
}

If no diagrams are found, return:
{
  "hasDiagrams": false,
  "diagrams": [],
  "diagramCount": 0
}`;

      // Call Gemini Vision API
      let result;
      try {
        result = await this.model.generateContent([
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
      } catch (apiError: any) {
        // Handle quota exceeded (429) errors specifically
        if (apiError.status === 429 || apiError.message?.includes('429') || apiError.message?.includes('quota')) {
          const errorDetails = apiError.errorDetails || [];
          const retryInfo = errorDetails.find((detail: any) => detail['@type']?.includes('RetryInfo'));
          const quotaInfo = errorDetails.find((detail: any) => detail['@type']?.includes('QuotaFailure'));
          
          let retryDelay = 'unknown';
          let quotaMessage = 'Your daily quota has been exceeded.';
          
          if (retryInfo?.retryDelay) {
            const delaySeconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
            const delayMinutes = Math.ceil(delaySeconds / 60);
            retryDelay = `${delayMinutes} minute${delayMinutes > 1 ? 's' : ''}`;
          }
          
          if (quotaInfo?.violations) {
            const violation = quotaInfo.violations[0];
            if (violation?.quotaValue) {
              quotaMessage = `You have exceeded your free tier limit of ${violation.quotaValue} requests per day.`;
            }
          }
          
          logger.error(`Gemini API quota exceeded during pattern analysis: ${quotaMessage} Please try again in ${retryDelay}.`);
          throw apiError; // Re-throw to be caught by outer catch block
        }
        throw apiError; // Re-throw other errors
      }

      const response = await result.response;
      const analysisText = response.text();

      // Parse the JSON response
      const analysis = this.parseAnalysisResponse(analysisText);

      logger.info(`Pattern analysis completed. Found ${analysis.diagramCount} diagram(s).`);

      // Extract actual diagram images if diagrams were found
      if (analysis.hasDiagrams && analysis.diagrams.length > 0) {
        try {
          await this.extractDiagramImages(patternFilePath, analysis, isPDF);
        } catch (extractError) {
          logger.warn('Failed to extract diagram images, continuing with descriptions only:', extractError);
        }
      }

      return {
        ...analysis,
        analysisComplete: true
      };

    } catch (error) {
      logger.error('Error analyzing pattern for diagrams:', error);
      // Return default result on error
      return {
        hasDiagrams: false,
        diagrams: [],
        diagramCount: 0,
        analysisComplete: false
      };
    }
  }

  /**
   * Parse the AI response to extract diagram information
   */
  private static parseAnalysisResponse(responseText: string): PatternAnalysisResult {
    try {
      // Clean the response to extract JSON
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Try to extract JSON from the response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in analysis response');
        return {
          hasDiagrams: false,
          diagrams: [],
          diagramCount: 0,
          analysisComplete: false
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        hasDiagrams: parsed.hasDiagrams || false,
        diagrams: parsed.diagrams || [],
        diagramCount: parsed.diagramCount || (parsed.diagrams?.length || 0),
        analysisComplete: true
      };
    } catch (error) {
      logger.error('Error parsing analysis response:', error);
      return {
        hasDiagrams: false,
        diagrams: [],
        diagramCount: 0,
        analysisComplete: false
      };
    }
  }

  /**
   * Extract actual diagram images from pattern file
   */
  private static async extractDiagramImages(
    patternFilePath: string,
    analysis: PatternAnalysisResult,
    isPDF: boolean
  ): Promise<void> {
    try {
      // Create directory for storing extracted diagrams
      const diagramsDir = path.join(process.cwd(), 'public', 'extracted-diagrams');
      if (!fs.existsSync(diagramsDir)) {
        fs.mkdirSync(diagramsDir, { recursive: true });
      }

      if (isPDF) {
        // For PDFs, we need to convert them to PNG images for embedding in PDFKit
        // PDFKit cannot embed PDF files directly as images
        try {
          // CRITICAL: Import canvas FIRST to ensure Path2D is available before pdfjs-dist
          // @napi-rs/canvas provides Path2D natively, which pdfjs-dist needs
          const canvasModule = await import('@napi-rs/canvas');
          const { createCanvas } = canvasModule;
          const Path2D = (canvasModule as any).Path2D;
          
          // Make Path2D globally available BEFORE importing pdfjs-dist
          // pdfjs-dist checks for Path2D during module initialization
          if (Path2D && typeof (globalThis as any).Path2D === 'undefined') {
            (globalThis as any).Path2D = Path2D;
            logger.info('✅ Path2D from @napi-rs/canvas is now globally available');
          } else if (Path2D) {
            logger.info('✅ Path2D already available globally');
          } else {
            logger.warn('⚠️ Path2D not found in @napi-rs/canvas - using polyfill may cause issues');
          }
          
          // Ensure Promise.withResolvers polyfill (for Node.js < 22)
          ensurePromiseWithResolvers();
          
          // DEBUGGER BREAKPOINT: Before importing pdfjs-dist
          debugger; // Breakpoint: PDF to PNG conversion attempt
          
          // Now import pdfjs-dist - Path2D should be available
          const pdfjsModule = await import('pdfjs-dist/build/pdf.mjs');
          const pdfjsLib = pdfjsModule.default || pdfjsModule;
          
          // Load the pattern PDF
          const patternBuffer = fs.readFileSync(patternFilePath);
          
          // DEBUGGER BREAKPOINT: Before calling getDocument (where Promise.withResolvers error occurs)
          debugger; // Breakpoint: About to call pdfjsLib.getDocument
          
          const loadingTask = pdfjsLib.getDocument({ 
            data: new Uint8Array(patternBuffer),
            useSystemFonts: true,
            verbosity: 0,
            disableWorker: true
          });
          
          // DEBUGGER BREAKPOINT: After getDocument call
          debugger; // Breakpoint: After getDocument call, before awaiting promise
          
          const pdfDocument = await loadingTask.promise;
          const totalPages = pdfDocument.numPages;
          
          // For each diagram, extract the relevant page as an image
          for (let i = 0; i < analysis.diagrams.length; i++) {
            const diagram = analysis.diagrams[i];
            if (!diagram) continue;
            
            // Get page number from diagram location or default to page 1
            let pageNumber = 1;
            if (diagram.location) {
              const pageMatch = diagram.location.match(/page\s*(\d+)/i);
              if (pageMatch && pageMatch[1]) {
                pageNumber = Math.min(parseInt(pageMatch[1], 10), totalPages);
              }
            }
            
            try {
              // Get the page and render it to canvas
              const page = await pdfDocument.getPage(pageNumber);
              const scale = 2.0; // Higher scale for better quality
              const viewport = page.getViewport({ scale });
              const canvas = createCanvas(viewport.width, viewport.height);
              const context = canvas.getContext('2d');
              
              if (!context) {
                throw new Error('Failed to get canvas context');
              }
              
              // Ensure Path2D is available on the context if needed
              // Some canvas implementations need Path2D to be available during rendering
              
              // Render PDF page to canvas
              // DEBUGGER BREAKPOINT: Before rendering page to canvas
              wdebugger; // Breakpoint: About to render page to canvas
              
              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;
              
              // Convert canvas to PNG buffer
              const imageBuffer = canvas.toBuffer('image/png');
              
              if (!imageBuffer || imageBuffer.length === 0) {
                throw new Error('Canvas buffer is empty after rendering');
              }
              
              const diagramFileName = `diagram-${Date.now()}-${i}.png`;
              const diagramPath = path.join(diagramsDir, diagramFileName);
              
              // Save as PNG
              fs.writeFileSync(diagramPath, imageBuffer);
              
              diagram.imagePath = diagramPath;
              diagram.imageBuffer = imageBuffer; // Also store buffer for direct use
              logger.info(`Extracted and converted diagram ${i + 1} (page ${pageNumber}) to PNG: ${diagramPath}`);
            } catch (diagramError) {
              const errorMsg = diagramError instanceof Error ? diagramError.message : String(diagramError);
              logger.error(`Failed to extract diagram ${i + 1} from page ${pageNumber}: ${errorMsg}`, {
                error: diagramError,
                diagramIndex: i,
                pageNumber
              });
              // Continue with next diagram instead of failing completely
              // This diagram will be skipped but others may succeed
            }
          }
        } catch (conversionError) {
          const errorMsg = conversionError instanceof Error ? conversionError.message : String(conversionError);
          logger.error('Failed to convert PDF diagrams to images:', {
            error: errorMsg,
            stack: conversionError instanceof Error ? conversionError.stack : undefined,
            patternFilePath,
            diagramCount: analysis.diagrams.length
          });
          
          // CRITICAL: We should NOT fallback to PDFs because they can't be embedded in the final PDF
          // Instead, mark diagrams as failed so they can be handled gracefully or retried
          logger.error('❌ Cannot proceed with PDF diagrams - they cannot be embedded. Conversion must succeed.');
          throw new Error(
            `Failed to convert pattern PDF diagrams to PNG images. ` +
            `Error: ${errorMsg}. ` +
            `Pattern diagrams must be converted to PNG format before use. ` +
            `Please ensure pdfjs-dist and @napi-rs/canvas are properly installed and polyfills are available.`
          );
        }
      } else {
        // For images, copy the entire image as the diagram
        // In a more advanced implementation, we would crop to the specific region
        const imageBuffer = fs.readFileSync(patternFilePath);
        const fileExtension = path.extname(patternFilePath);
        
        for (let i = 0; i < analysis.diagrams.length; i++) {
          const diagram = analysis.diagrams[i];
          if (!diagram) continue;
          
          const diagramFileName = `diagram-${Date.now()}-${i}${fileExtension}`;
          const diagramPath = path.join(diagramsDir, diagramFileName);
          
          fs.writeFileSync(diagramPath, imageBuffer);
          diagram.imagePath = diagramPath;
          diagram.imageBuffer = imageBuffer; // Also store buffer for direct use
          
          logger.info(`Extracted diagram ${i + 1} to ${diagramPath}`);
        }
      }
    } catch (error) {
      logger.error('Error extracting diagram images:', error);
      throw error;
    }
  }

  /**
   * Get diagram information as formatted string for AI prompt
   */
  static formatDiagramsForPrompt(analysis: PatternAnalysisResult): string {
    if (!analysis.hasDiagrams || analysis.diagrams.length === 0) {
      return '';
    }

    let formatted = '\n\n**DIAGRAMS AND GRAPHS FOUND IN PATTERN:**\n';
    formatted += `Total diagrams found: ${analysis.diagramCount}\n\n`;

    analysis.diagrams.forEach((diagram, index) => {
      formatted += `Diagram ${index + 1}:\n`;
      formatted += `- Type: ${diagram.type}\n`;
      formatted += `- Description: ${diagram.description}\n`;
      formatted += `- Location: ${diagram.location}\n`;
      if (diagram.context) {
        formatted += `- Context: ${diagram.context}\n`;
      }
      if (diagram.relatedContent) {
        formatted += `- Related Content: ${diagram.relatedContent}\n`;
      }
      formatted += '\n';
    });

    formatted += `**IMPORTANT INSTRUCTIONS:**\n`;
    formatted += `1. The pattern file contains ${analysis.diagramCount} diagram(s)/graph(s).\n`;
    formatted += `2. You MUST generate questions that include similar types of diagrams/graphs.\n`;
    formatted += `3. For questions that require diagrams, include detailed drawing instructions in the 'drawingInstructions' field.\n`;
    formatted += `4. Describe the diagrams clearly so they can be included in the generated question paper.\n`;
    formatted += `5. Match the style and complexity of diagrams found in the pattern.\n`;
    formatted += `6. Use the 'visualAids' field to describe diagrams that should be included with questions.\n`;

    return formatted;
  }
}


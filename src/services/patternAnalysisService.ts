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
  // Bounding box coordinates for cropping (0-1 normalized, or pixels)
  boundingBox?: {
    x: number; // Left coordinate (0-1 normalized or pixels)
    y: number; // Top coordinate (0-1 normalized or pixels)
    width: number; // Width (0-1 normalized or pixels)
    height: number; // Height (0-1 normalized or pixels)
    normalized?: boolean; // If true, coordinates are 0-1, if false, they're pixels
  };
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
    } catch (error: unknown) {
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
2. Description: Brief description of what the diagram shows (ONLY the visual diagram, not surrounding text)
3. Location: Where it appears (e.g., "Page 1, Section A, Question 5" or "After Question 3")
4. Page Number: Which page (for PDFs) or page 1 (for images)
5. Related Content: Any text near the diagram (question text, labels, etc.)
6. Context: What subject/topic the diagram relates to
7. Bounding Box: The exact coordinates of ONLY the diagram area (excluding text, equations, or question numbers). Provide as normalized coordinates (0-1) where:
   - x: left edge of diagram (0 = left edge of page, 1 = right edge)
   - y: top edge of diagram (0 = top of page, 1 = bottom of page)
   - width: width of diagram (0-1)
   - height: height of diagram (0-1)
   IMPORTANT: Only include the visual diagram/graph itself, NOT any text, equations, or question numbers around it.

Return your analysis in the following JSON format:
{
  "hasDiagrams": true/false,
  "diagrams": [
    {
      "type": "diagram|graph|chart|figure|illustration",
      "description": "Description of the diagram (visual elements only)",
      "location": "Where it appears",
      "pageNumber": 1,
      "relatedContent": "Text near the diagram",
      "context": "Subject/topic context",
      "boundingBox": {
        "x": 0.1,
        "y": 0.3,
        "width": 0.4,
        "height": 0.3,
        "normalized": true
      }
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
          logger.info(`Starting diagram image extraction for ${analysis.diagrams.length} diagram(s)...`);
          await this.extractDiagramImages(patternFilePath, analysis, isPDF);
          
          // Verify that images were actually extracted
          const diagramsWithImages = analysis.diagrams.filter(d => d.imagePath || d.imageBuffer);
          logger.info(`Successfully extracted ${diagramsWithImages.length} out of ${analysis.diagrams.length} diagram images`);
          
          if (diagramsWithImages.length === 0) {
            logger.warn('⚠️ No diagram images were extracted despite diagrams being detected. Diagrams may not appear in generated question papers.');
          }
        } catch (extractError) {
          const errorMsg = extractError instanceof Error ? extractError.message : String(extractError);
          logger.error('❌ Failed to extract diagram images:', {
            error: errorMsg,
            stack: extractError instanceof Error ? extractError.stack : undefined,
            patternFilePath,
            diagramCount: analysis.diagrams.length
          });
          // Don't throw - continue with descriptions only, but log the error clearly
        }
      }

      return {
        ...analysis,
        analysisComplete: true
      };

    } catch (error: unknown) {
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

      // Parse diagrams and ensure boundingBox is included if provided
      const diagrams = (parsed.diagrams || []).map((d: any) => ({
        type: d.type || 'diagram',
        description: d.description || '',
        location: d.location || '',
        relatedContent: d.relatedContent,
        context: d.context,
        boundingBox: d.boundingBox ? {
          x: typeof d.boundingBox.x === 'number' ? d.boundingBox.x : parseFloat(d.boundingBox.x) || 0,
          y: typeof d.boundingBox.y === 'number' ? d.boundingBox.y : parseFloat(d.boundingBox.y) || 0,
          width: typeof d.boundingBox.width === 'number' ? d.boundingBox.width : parseFloat(d.boundingBox.width) || 0.3,
          height: typeof d.boundingBox.height === 'number' ? d.boundingBox.height : parseFloat(d.boundingBox.height) || 0.3,
          normalized: d.boundingBox.normalized !== false // Default to true if not specified
        } : undefined
      }));

      return {
        hasDiagrams: parsed.hasDiagrams || false,
        diagrams: diagrams,
        diagramCount: parsed.diagramCount || diagrams.length,
        analysisComplete: true
      };
    } catch (error: unknown) {
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
          // CRITICAL: Import canvas FIRST to ensure Path2D and ImageData are available before pdfjs-dist
          // @napi-rs/canvas provides Path2D and ImageData natively, which pdfjs-dist needs
          const canvasModule = await import('@napi-rs/canvas');
          const { createCanvas, ImageData } = canvasModule;
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
          
          // Make ImageData globally available - pdfjs-dist needs this for rendering
          if (ImageData && typeof (globalThis as any).ImageData === 'undefined') {
            (globalThis as any).ImageData = ImageData;
            logger.info('✅ ImageData from @napi-rs/canvas is now globally available');
          } else if (ImageData) {
            logger.info('✅ ImageData already available globally');
          } else {
            logger.warn('⚠️ ImageData not found in @napi-rs/canvas - creating polyfill');
            // Create a basic ImageData polyfill if not available
            if (typeof (globalThis as any).ImageData === 'undefined') {
              (globalThis as any).ImageData = class ImageData {
                data: Uint8ClampedArray;
                width: number;
                height: number;
                
                constructor(dataOrWidth: Uint8ClampedArray | number, heightOrWidth?: number, height?: number) {
                  if (dataOrWidth instanceof Uint8ClampedArray) {
                    this.data = dataOrWidth;
                    this.width = heightOrWidth || 0;
                    this.height = height || 0;
                  } else {
                    const width = dataOrWidth;
                    const h = heightOrWidth || 0;
                    this.width = width;
                    this.height = h;
                    this.data = new Uint8ClampedArray(width * h * 4);
                  }
                }
              };
            }
          }
          
          // Ensure Promise.withResolvers polyfill (for Node.js < 22)
          ensurePromiseWithResolvers();
          
          // Now import pdfjs-dist - Path2D and ImageData should be available
          const pdfjsModule = await import('pdfjs-dist/build/pdf.mjs') as any;
          const pdfjsLib = pdfjsModule.default || pdfjsModule;
          
          // Load the pattern PDF
          const patternBuffer = fs.readFileSync(patternFilePath);
          
          const loadingTask = pdfjsLib.getDocument({ 
            data: new Uint8Array(patternBuffer),
            useSystemFonts: true,
            verbosity: 0,
            disableWorker: true
          });
          
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
              
              // Ensure Path2D and ImageData are available on the context if needed
              // Some canvas implementations need these to be available during rendering
              
              // Verify ImageData is available before rendering
              if (typeof (globalThis as any).ImageData === 'undefined') {
                throw new Error('ImageData is not available. Cannot render PDF page to canvas.');
              }
              
              // Render PDF page to canvas
              await page.render({
                canvasContext: context,
                viewport: viewport
              }).promise;
              
              // Crop to diagram area if bounding box is provided
              let finalCanvas = canvas;
              let finalImageBuffer: Buffer;
              
              if (diagram.boundingBox && diagram.boundingBox.normalized) {
                // Calculate pixel coordinates from normalized coordinates
                const cropX = Math.max(0, Math.floor(diagram.boundingBox.x * viewport.width));
                const cropY = Math.max(0, Math.floor(diagram.boundingBox.y * viewport.height));
                const cropWidth = Math.min(viewport.width - cropX, Math.floor(diagram.boundingBox.width * viewport.width));
                const cropHeight = Math.min(viewport.height - cropY, Math.floor(diagram.boundingBox.height * viewport.height));
                
                // Create a new canvas with just the diagram area
                const croppedCanvas = createCanvas(cropWidth, cropHeight);
                const croppedContext = croppedCanvas.getContext('2d');
                
                if (croppedContext) {
                  // Extract image data from the cropped region
                  const imageData = context.getImageData(cropX, cropY, cropWidth, cropHeight);
                  
                  // Put the cropped image data into the new canvas
                  croppedContext.putImageData(imageData, 0, 0);
                  
                  finalCanvas = croppedCanvas;
                  logger.info(`✅ Cropped diagram ${i + 1} to region: x=${cropX}, y=${cropY}, w=${cropWidth}, h=${cropHeight} (from normalized: x=${diagram.boundingBox.x.toFixed(2)}, y=${diagram.boundingBox.y.toFixed(2)}, w=${diagram.boundingBox.width.toFixed(2)}, h=${diagram.boundingBox.height.toFixed(2)})`);
                } else {
                  logger.warn(`⚠️ Failed to get cropped canvas context for diagram ${i + 1}, using full page`);
                }
              } else {
                logger.info(`No bounding box provided for diagram ${i + 1}, using full page`);
              }
              
              // Convert canvas to PNG buffer
              finalImageBuffer = finalCanvas.toBuffer('image/png');
              
              if (!finalImageBuffer || finalImageBuffer.length === 0) {
                throw new Error('Canvas buffer is empty after rendering');
              }
              
              const diagramFileName = `diagram-${Date.now()}-${i}.png`;
              const diagramPath = path.join(diagramsDir, diagramFileName);
              
              // Save as PNG
              fs.writeFileSync(diagramPath, finalImageBuffer);
              
              diagram.imagePath = diagramPath;
              diagram.imageBuffer = finalImageBuffer; // Also store buffer for direct use
              logger.info(`Extracted and converted diagram ${i + 1} (page ${pageNumber}) to PNG: ${diagramPath}`);
            } catch (diagramError) {
              const errorMsg = diagramError instanceof Error ? diagramError.message : String(diagramError);
              logger.error(`❌ Failed to extract diagram ${i + 1} from page ${pageNumber}: ${errorMsg}`, {
                error: diagramError,
                diagramIndex: i,
                pageNumber,
                diagramLocation: diagram.location
              });
              // Set imagePath to empty string to mark as failed (but keep diagram in list)
              diagram.imagePath = '';
              delete diagram.imageBuffer;
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
    } catch (error: unknown) {
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


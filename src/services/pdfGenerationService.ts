import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import { logger } from '../utils/logger';
import sharp from 'sharp';

export interface GeneratedQuestion {
  questionText: string;
  questionType: string;
  marks: number;
  bloomsLevel: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  matchingPairs?: { left: string; right: string }[];
  multipleCorrectAnswers?: string[];
  drawingInstructions?: string;
  markingInstructions?: string;
  visualAids?: string[];
  diagram?: {
    description: string;
    type: 'graph' | 'geometry' | 'circuit' | 'chart' | 'diagram' | 'figure' | 'other';
    status: 'pending' | 'ready';
    altText?: string;
    url?: string;
    imagePath?: string;
    imageBuffer?: Buffer;
  };
  // Legacy fields for backwards compatibility
  diagramImagePath?: string;
  diagramImageBuffer?: Buffer;
}

export class PDFGenerationService {
  private static readonly PUBLIC_FOLDER = path.join(process.cwd(), "public");
  private static readonly QUESTION_PAPERS_FOLDER = path.join(
    this.PUBLIC_FOLDER,
    "question-papers"
  );

  static initialize() {
    if (!fs.existsSync(this.PUBLIC_FOLDER))
      fs.mkdirSync(this.PUBLIC_FOLDER, { recursive: true });
    if (!fs.existsSync(this.QUESTION_PAPERS_FOLDER))
      fs.mkdirSync(this.QUESTION_PAPERS_FOLDER, { recursive: true });
  }

  static async generateQuestionPaperPDF(
    questionPaperId: string,
    questions: GeneratedQuestion[],
    subjectName: string,
    className: string,
    examTitle: string,
    totalMarks: number,
    duration: number
  ): Promise<{ fileName: string; filePath: string; downloadUrl: string }> {
    this.initialize();

    const fileName = `question-paper-${questionPaperId}-${Date.now()}.pdf`;
    const filePath = path.join(this.QUESTION_PAPERS_FOLDER, fileName);
    const downloadUrl = `/public/question-papers/${fileName}`;

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          autoFirstPage: true,
        });

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        stream.on("error", reject);
        stream.on("finish", () => resolve({ fileName, filePath, downloadUrl }));

        // Header
        this.addHeader(doc, subjectName, className, examTitle, totalMarks, duration);

        // Instructions
        this.addInstructions(doc);

        // Questions (async)
        let q = 1;
        for (const question of questions) {
          await this.addQuestion(doc, question, q);
          q++;
        }

        // Footer after all content
        this.addFooter(doc);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Extract text content from a PDF file using pdfjs-dist
   */
  static async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      console.log('Extracting text from PDF:', filePath);
      
      if (!fs.existsSync(filePath)) {
        console.error('PDF file not found:', filePath);
        throw new Error(`PDF file not found: ${filePath}`);
      }

      // Use pdfjs-dist to extract text from PDF
      const pdfjsModule = await import('pdfjs-dist/build/pdf.mjs');
      const pdfjsLib = pdfjsModule.default || pdfjsModule;
      
      // Read PDF file
      const pdfBuffer = fs.readFileSync(filePath);
      
      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({ 
        data: new Uint8Array(pdfBuffer),
        useSystemFonts: true,
        verbosity: 0
      });
      
      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;
      
      // Extract text from all pages
      let fullText = '';
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine all text items from the page
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + '\n';
      }
      
      console.log(`Extracted text from PDF: ${numPages} pages, ${fullText.length} characters`);
      
      if (!fullText || fullText.trim().length === 0) {
        console.warn('No text extracted from PDF, PDF might be image-based or scanned');
        throw new Error('No text content found in PDF. The PDF might be image-based or scanned.');
      }
      
      return fullText;
    } catch (error: unknown) {
      console.error('Error extracting text from PDF:', error);
      // If PDF extraction fails, throw error instead of returning mock data
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ---------------- HEADER ----------------
  private static addHeader(doc: any, subject: string, className: string, exam: string, total: number, duration: number) {
    const pageWidth = doc.page.width;
    const margin = 50;

    // Classic academic header (monochrome, clean)
    const subjectName = subject || 'Subject';
    const classNameValue = className || '';
    const examTitle = (exam || 'Question Paper').toUpperCase();

    // Title
    doc.font('Times-Bold')
      .fontSize(18)
      .fillColor('black')
      .text(examTitle, margin, 50, { align: 'center' });

    // Thin underline
    const titleBottomY = doc.y + 6;
    doc.moveTo(margin, titleBottomY).lineTo(pageWidth - margin, titleBottomY).stroke('#000000');

    doc.moveDown(0.6);

    // Meta row: Subject | Class (left) and Marks | Time (right)
    doc.font('Times-Roman').fontSize(12);
    const leftText = `Subject: ${subjectName}${classNameValue ? `   Class: ${classNameValue}` : ''}`;
    const rightText = `Total Marks: ${total || 0}   Time: ${duration || 0} minutes`;

    // Left
    doc.text(leftText, margin, titleBottomY + 8, { continued: false });
    // Right
    const rightWidth = doc.widthOfString(rightText);
    doc.text(rightText, pageWidth - margin - rightWidth, titleBottomY + 8);

    doc.moveDown(0.8);
  }

  // ---------------- INSTRUCTIONS ----------------
  private static addInstructions(doc: any) {
    const pageWidth = doc.page.width;
    const margin = 50;

    // Heading
    doc.font('Times-Bold').fontSize(12).text('INSTRUCTIONS:', margin, doc.y);
    doc.moveDown(0.3);

    // Numbered instructions, simple black text
    const instructions = [
      '1. All questions are compulsory.',
      '2. Read the questions carefully and answer in your own words.',
      '3. Figures to the right indicate full marks for the question.',
      '4. Write neat and legible answers.',
      '5. Do not write anything on the question paper.'
    ];

    doc.font('Times-Roman').fontSize(11).fillColor('black');
    const width = pageWidth - 2 * margin;
    instructions.forEach((line) => {
      doc.text(line, margin, doc.y, { width });
      doc.moveDown(0.2);
    });

    doc.moveDown(0.6);
  }

  // ---------------- QUESTION ----------------
  private static async addQuestion(doc: any, question: GeneratedQuestion, number: number) {
    // New page if near bottom
    if (doc.y > 720) {
      doc.addPage();
    }

    const pageWidth = doc.page.width;
    const margin = 50;
    const width = pageWidth - 2 * margin;

    // Qn. Question text  [marks]
    doc.font('Times-Bold').fontSize(12).fillColor('black');
    const prefix = `Q${number}. `;
    const marksSuffix = question.marks ? `   [${question.marks} mark${question.marks > 1 ? 's' : ''}]` : '';

    // Render question line
    doc.text(prefix + question.questionText + marksSuffix, margin, doc.y, { width });
    doc.moveDown(0.2);

    // Options (a), (b), ... for MCQ types
    if (question.options && question.options.length > 0 &&
        (question.questionType === 'CHOOSE_BEST_ANSWER' || question.questionType === 'CHOOSE_MULTIPLE_ANSWERS')) {
      doc.font('Times-Roman').fontSize(11);
      question.options.forEach((opt, i) => {
        const label = String.fromCharCode(97 + i); // a, b, c ...
        doc.text(`(${label}) ${opt}`, margin + 18, doc.y, { width });
      });
      doc.moveDown(0.2);
    }

    // Embed actual diagram image if available (PRIORITY - show image before descriptions)
    // Check for new diagram object format first, then fall back to legacy format
    const diagramPath = question.diagram?.imagePath || question.diagramImagePath;
    const diagramBuffer = question.diagram?.imageBuffer || question.diagramImageBuffer;
    const hasReadyDiagram = question.diagram && question.diagram.status === 'ready';
    
    // Embed diagram if we have a diagram image path or buffer available
    // This will embed diagrams with status 'ready' or any diagram with a valid path/buffer
    if (diagramPath || diagramBuffer) {
      try {
        doc.moveDown(0.3);
        let imageBuffer: Buffer;
        
        if (diagramBuffer) {
          imageBuffer = diagramBuffer;
        } else if (diagramPath && fs.existsSync(diagramPath)) {
          imageBuffer = fs.readFileSync(diagramPath);
        } else {
          throw new Error('Diagram image not found');
        }

        // Calculate image dimensions to fit within page width while preserving aspect ratio
        const maxWidth = width - 36; // Leave some margin
        const maxHeight = 400; // Increased max height for better visibility
        
        const imageX = margin + 18;
        const imageY = doc.y;

        // Embed image - PDFKit supports PNG, JPEG, but NOT PDF files
        if (imageBuffer) {
          const isPDF = diagramPath?.endsWith('.pdf') || 
                       (imageBuffer[0] === 0x25 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x44 && imageBuffer[3] === 0x46);
          
          if (isPDF) {
            // PDF files cannot be embedded as images in PDFKit
            // PDFs should have been converted to PNG before PDF generation
            // If we still have a PDF here, it means conversion failed or wasn't done
            logger.warn(`Question ${number} has a PDF diagram that should have been converted to PNG. Showing placeholder.`);
            doc.font('Times-Italic').fontSize(10).fillColor('#666666');
            doc.text('[Diagram image - PDF format not supported for embedding, should have been converted to PNG]', margin + 18, doc.y, { width });
            doc.moveDown(0.2);
            doc.fillColor('black');
            return; // Exit early - can't embed PDF
          }
          
          // For image files (PNG, JPEG) or converted PDFs, embed directly
          try {
            // Get actual image dimensions using sharp to preserve aspect ratio
            let actualWidth = maxWidth;
            let actualHeight = maxHeight;
            
            try {
              const metadata = await sharp(imageBuffer).metadata();
              if (metadata.width && metadata.height) {
                const aspectRatio = metadata.width / metadata.height;
                
                // Calculate dimensions that fit within maxWidth x maxHeight while preserving aspect ratio
                if (metadata.width > metadata.height) {
                  // Landscape or square: fit to width
                  actualWidth = Math.min(maxWidth, metadata.width);
                  actualHeight = actualWidth / aspectRatio;
                  
                  // If height exceeds max, scale down
                  if (actualHeight > maxHeight) {
                    actualHeight = maxHeight;
                    actualWidth = actualHeight * aspectRatio;
                  }
                } else {
                  // Portrait: fit to height
                  actualHeight = Math.min(maxHeight, metadata.height);
                  actualWidth = actualHeight * aspectRatio;
                  
                  // If width exceeds max, scale down
                  if (actualWidth > maxWidth) {
                    actualWidth = maxWidth;
                    actualHeight = actualWidth / aspectRatio;
                  }
                }
                
                logger.info(`Question ${number} diagram: original=${metadata.width}x${metadata.height}, scaled=${Math.round(actualWidth)}x${Math.round(actualHeight)}`);
              }
            } catch (sharpError) {
              logger.warn(`Could not get image metadata for question ${number}, using default dimensions:`, sharpError);
              // Fall back to default dimensions
            }
            
            // Embed image with calculated dimensions
            doc.image(imageBuffer, imageX, imageY, {
              width: actualWidth,
              height: actualHeight,
              align: 'left'
            });
            
            // Move down after image
            doc.y = imageY + actualHeight + 10;
            doc.moveDown(0.3);
            logger.info(`Embedded diagram image for question ${number} (${Math.round(actualWidth)}x${Math.round(actualHeight)})`);
          } catch (imageError) {
            logger.warn(`Failed to embed image buffer for question ${number}:`, imageError);
            // Show fallback
            doc.font('Times-Italic').fontSize(10).fillColor('#666666');
            doc.text('[Diagram image could not be embedded]', margin + 18, doc.y, { width });
            doc.moveDown(0.2);
            doc.fillColor('black');
          }
        }
      } catch (error: unknown) {
        // If image embedding fails, show description as fallback
        logger.warn(`Failed to embed diagram image for question ${number}:`, error);
        doc.font('Times-Italic').fontSize(10).fillColor('#666666');
        doc.text('[Diagram image could not be loaded - see description below]', margin + 18, doc.y, { width });
        doc.moveDown(0.2);
        doc.fillColor('black');
      }
    }

    // Visual aids (diagrams, figures descriptions) - shown if no image embedded
    // Also show if diagram is pending (not yet generated)
    const hasDiagramButPending = question.diagram && question.diagram.status === 'pending';
    const showVisualAids = question.visualAids && question.visualAids.length > 0 && 
                          !diagramPath && !diagramBuffer && !hasReadyDiagram;
    
    if (showVisualAids || hasDiagramButPending) {
      doc.font('Times-Italic').fontSize(10).fillColor('#666666');
      doc.moveDown(0.2);
      if (hasDiagramButPending && question.diagram) {
        doc.text(`Note: This question includes a diagram: ${question.diagram.description}`, margin + 18, doc.y, { width });
      } else {
        doc.text('Note: This question includes diagrams/figures. Refer to the visual aids described below:', margin + 18, doc.y, { width });
        doc.moveDown(0.15);
        question.visualAids?.forEach((aid, i) => {
          doc.text(`• ${aid}`, margin + 30, doc.y, { width });
        });
      }
      doc.moveDown(0.2);
      doc.fillColor('black'); // Reset color
    }

    // Drawing instructions for DRAWING_DIAGRAM type
    if (question.drawingInstructions && question.questionType === 'DRAWING_DIAGRAM') {
      doc.font('Times-Roman').fontSize(11).fillColor('#333333');
      doc.moveDown(0.2);
      doc.text('Drawing Instructions:', margin + 18, doc.y, { width, continued: false });
      doc.moveDown(0.1);
      doc.text(question.drawingInstructions, margin + 30, doc.y, { width });
      doc.moveDown(0.2);
      doc.fillColor('black'); // Reset color
    }

    // Marking instructions for MARKING_PARTS type
    if (question.markingInstructions && question.questionType === 'MARKING_PARTS') {
      doc.font('Times-Roman').fontSize(11).fillColor('#333333');
      doc.moveDown(0.2);
      doc.text('Marking Instructions:', margin + 18, doc.y, { width, continued: false });
      doc.moveDown(0.1);
      doc.text(question.markingInstructions, margin + 30, doc.y, { width });
      doc.moveDown(0.2);
      doc.fillColor('black'); // Reset color
    }

    doc.moveDown(0.4);
  }

  // ---------------- FOOTER ----------------
  private static addFooter(doc: any) {
    const pageRange = doc.bufferedPageRange();
    if (!pageRange) {
      console.warn('No pages found in document');
      return;
    }
    
    const pageCount = pageRange.count;
    const startPage = pageRange.start;
    const pageWidth = doc.page.width;
    const margin = 50;
    
    for (let i = startPage; i < startPage + pageCount; i++) {
      try {
        doc.switchToPage(i);
        const footerY = 770;

        // Simple monochrome footer
        const pageText = `Page ${i - startPage + 1} of ${pageCount}`;
        doc.font('Times-Roman').fontSize(9).fillColor('#000000')
          .text(pageText, pageWidth - margin - 80, footerY, { align: 'right' });
           
      } catch (error: unknown) {
        console.warn(`Could not switch to page ${i}:`, error);
        // Continue with other pages
      }
    }
  }

  static async deleteQuestionPaperPDF(fileName: string): Promise<void> {
    try {
      const filePath = path.join(this.QUESTION_PAPERS_FOLDER, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error: unknown) {
      console.error('Error deleting PDF file:', error);
      throw error;
    }
  }
}
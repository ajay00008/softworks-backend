import PDFDocument from "pdfkit"
import * as fs from 'fs';
import * as path from 'path';
import { QuestionPaper } from '../models/QuestionPaper';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Class } from '../models/Class';
import { Exam } from '../models/Exam';

// Type alias for PDFDocument
type PDFDoc = typeof PDFDocument;

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
}

export class PDFGenerationService {
  private static readonly PUBLIC_FOLDER = path.join(process.cwd(), 'public');
  private static readonly QUESTION_PAPERS_FOLDER = path.join(this.PUBLIC_FOLDER, 'question-papers');

  /**
   * Initialize the service by creating necessary directories
   */
  static initialize() {
    // Create public folder if it doesn't exist
    if (!fs.existsSync(this.PUBLIC_FOLDER)) {
      fs.mkdirSync(this.PUBLIC_FOLDER, { recursive: true });
    }
    
    // Create question-papers folder if it doesn't exist
    if (!fs.existsSync(this.QUESTION_PAPERS_FOLDER)) {
      fs.mkdirSync(this.QUESTION_PAPERS_FOLDER, { recursive: true });
    }
  }

  /**
   * Generate PDF for a question paper
   */
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
    const downloadUrl = `/question-papers/${fileName}`;

    return new Promise((resolve, reject) => {
      try {
        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          },
          autoFirstPage: true
        });

        // Create write stream
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Handle stream events
        stream.on('error', (error) => {
          console.error('Stream error:', error);
          reject(error);
        });

        stream.on('finish', () => {
          console.log('PDF generation completed successfully');
          resolve({
            fileName,
            filePath,
            downloadUrl
          });
        });

        // Add content to PDF
        try {
          // Add header
          this.addHeader(doc, subjectName, className, examTitle, totalMarks, duration);

          // Add instructions
          this.addInstructions(doc);

          // Add questions
          let questionNumber = 1;
          for (const question of questions) {
            this.addQuestion(doc, question, questionNumber);
            questionNumber++;
          }

          // Add footer
          this.addFooter(doc);

          // Finalize PDF - this is crucial for proper PDF structure
          doc.end();
        } catch (contentError) {
          console.error('Error adding content to PDF:', contentError);
          reject(contentError);
        }
      } catch (error) {
        console.error('Error creating PDF document:', error);
        reject(error);  
      }
    });
  }

  /**
   * Add header to the PDF
   */
  private static addHeader(
    doc: any,
    subjectName: string,
    className: string,
    examTitle: string,
    totalMarks: number,
    duration: number
  ) {
    // Title
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text(examTitle, { align: 'center' });
    
    doc.moveDown(0.5);

    // Subject and Class info
    doc.fontSize(14)
       .font('Helvetica')
       .text(`Subject: ${subjectName}`, { align: 'left' })
       .text(`Class: ${className}`, { align: 'left' })
       .text(`Total Marks: ${totalMarks}`, { align: 'right' })
       .text(`Duration: ${duration} minutes`, { align: 'right' });

    doc.moveDown(1);

    // Line separator
    doc.strokeColor('#000000')
       .lineWidth(1)
       .moveTo(50, doc.y)
       .lineTo(550, doc.y)
       .stroke();

    doc.moveDown(1);
  }

  /**
   * Add instructions to the PDF
   */
  private static addInstructions(doc: any) {
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('INSTRUCTIONS:', { underline: true });
    
    doc.moveDown(0.3);
    
    const instructions = [
      '1. All questions are compulsory.',
      '2. Read all questions carefully before answering.',
      '3. Write your answers clearly and legibly.',
      '4. For multiple choice questions, choose the best answer.',
      '5. For fill in the blanks, write the complete word or phrase.',
      '6. For drawing questions, use a pencil and draw clearly.',
      '7. For matching questions, draw arrows to connect the pairs.',
      '8. Manage your time effectively.'
    ];

    doc.fontSize(10)
       .font('Helvetica')
       .text(instructions.join('\n'));

    doc.moveDown(1);
  }

  /**
   * Add a question to the PDF
   */
  private static addQuestion(doc: any, question: GeneratedQuestion, questionNumber: number) {
    // Check if we need a new page
    if (doc.y > 700) {
      doc.addPage();
    }

    // Question number and text
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .text(`Q${questionNumber}. `, { continued: true })
       .font('Helvetica')
       .text(question.questionText);

    doc.moveDown(0.3);

    // Add question type specific content
    switch (question.questionType) {
      case 'CHOOSE_BEST_ANSWER':
        this.addMultipleChoiceOptions(doc, question.options || []);
        break;
      case 'TRUE_FALSE':
        this.addTrueFalseOptions(doc);
        break;
      case 'CHOOSE_MULTIPLE_ANSWERS':
        this.addMultipleChoiceOptions(doc, question.options || [], true);
        break;
      case 'MATCHING_PAIRS':
        this.addMatchingPairs(doc, question.matchingPairs || []);
        break;
      case 'DRAWING_DIAGRAM':
        this.addDrawingInstructions(doc, question.drawingInstructions || '');
        break;
      case 'MARKING_PARTS':
        this.addMarkingInstructions(doc, question.markingInstructions || '');
        break;
      case 'FILL_BLANKS':
        this.addFillBlanksInstructions(doc);
        break;
      case 'ONE_WORD_ANSWER':
        this.addOneWordAnswerInstructions(doc);
        break;
    }

    // Add marks and Blooms level
    doc.moveDown(0.5);
    doc.fontSize(9)
       .font('Helvetica')
       .text(`[${question.marks} marks]`, { align: 'right' })
       .text(`[${question.bloomsLevel}]`, { align: 'right' });

    // Add space for answer
    this.addAnswerSpace(doc, question.marks);

    doc.moveDown(1);
  }

  /**
   * Add multiple choice options
   */
  private static addMultipleChoiceOptions(doc: any, options: string[], multiple: boolean = false) {
    if (options.length === 0) return;

    const prefix = multiple ? 'Choose all correct answers:' : 'Choose the best answer:';
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text(prefix);
    
    doc.moveDown(0.2);

    options.forEach((option, index) => {
      const letter = String.fromCharCode(65 + index); // A, B, C, D...
      doc.fontSize(10)
         .font('Helvetica')
         .text(`${letter}) ${option}`);
    });
  }

  /**
   * Add True/False options
   */
  private static addTrueFalseOptions(doc: any) {
    doc.fontSize(10)
       .font('Helvetica')
       .text('A) True')
       .text('B) False');
  }

  /**
   * Add matching pairs
   */
  private static addMatchingPairs(doc: any, pairs: { left: string; right: string }[]) {
    if (pairs.length === 0) return;

    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Match the following:');
    
    doc.moveDown(0.2);

    pairs.forEach((pair, index) => {
      doc.fontSize(10)
         .font('Helvetica')
         .text(`${index + 1}. ${pair.left} → _____________`);
    });
  }

  /**
   * Add drawing instructions
   */
  private static addDrawingInstructions(doc: any, instructions: string) {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Drawing Instructions:');
    
    doc.moveDown(0.2);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(instructions);
    
    doc.moveDown(0.5);
    doc.text('Space for drawing:');
    this.addDrawingSpace(doc);
  }

  /**
   * Add marking instructions
   */
  private static addMarkingInstructions(doc: any, instructions: string) {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Marking Instructions:');
    
    doc.moveDown(0.2);
    
    doc.fontSize(10)
       .font('Helvetica')
       .text(instructions);
  }

  /**
   * Add fill in the blanks instructions
   */
  private static addFillBlanksInstructions(doc: any) {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Fill in the blanks with appropriate words:');
  }

  /**
   * Add one word answer instructions
   */
  private static addOneWordAnswerInstructions(doc: any) {
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .text('Answer in one word:');
  }

  /**
   * Add answer space based on marks
   */
  private static addAnswerSpace(doc: any, marks: number) {
    const spaceHeight = Math.min(Math.max(marks * 2, 20), 100); // Proportional to marks
    
    doc.moveDown(0.3);
    doc.rect(50, doc.y, 500, spaceHeight)
       .stroke();
    
    doc.y += spaceHeight + 10;
  }

  /**
   * Add drawing space
   */
  private static addDrawingSpace(doc: any) {
    const spaceHeight = 80;
    
    doc.moveDown(0.3);
    doc.rect(50, doc.y, 500, spaceHeight)
       .stroke();
    
    doc.y += spaceHeight + 10;
  }

  /**
   * Add footer to the PDF
   */
  private static addFooter(doc: any) {
    try {
      // Add page numbers if there are multiple pages
      const pageCount = doc.bufferedPageRange().count;
      if (pageCount > 1) {
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.fontSize(8)
             .font('Helvetica')
             .text(`Page ${i + 1} of ${pageCount}`, 50, 750, { align: 'center' });
        }
      }
    } catch (error) {
      console.warn('Error adding footer to PDF:', error);
      // Continue without footer if there's an error
    }
  }

  /**
   * Get download URL for a question paper PDF
   */
  static getDownloadUrl(fileName: string): string {
    return `/public/question-papers/${fileName}`;
  }

  /**
   * Delete a question paper PDF file
   */
  static async deleteQuestionPaperPDF(fileName: string): Promise<boolean> {
    try {
      const filePath = path.join(this.QUESTION_PAPERS_FOLDER, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting PDF file:', error);
      return false;
    }
  }
}

import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

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

    return new Promise((resolve, reject) => {
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

        // Questions
        let q = 1;
        for (const question of questions) {
          this.addQuestion(doc, question, q);
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
   * Extract text content from a PDF file
   * For now, this is a mock implementation that returns sample text
   * In production, you would use a proper PDF text extraction library
   */
  static async extractTextFromPDF(filePath: string): Promise<string> {
    try {
      console.log('Extracting text from PDF:', filePath);
      
      if (!fs.existsSync(filePath)) {
        console.error('PDF file not found:', filePath);
        throw new Error(`PDF file not found: ${filePath}`);
      }

      console.log('PDF file exists, returning sample text');
      
      // For now, return sample text that matches common question paper patterns
      // This allows us to test the pattern extraction logic
      const sampleText = `
        MATHEMATICS QUESTION PAPER
        Class: 10
        Unit Test - Chapter 1: Real Numbers
        Time: 90 minutes
        Total Marks: 50
        
        INSTRUCTIONS:
        1. All questions are compulsory
        2. Section A contains 10 questions of 1 mark each
        3. Section B contains 8 questions of 2 marks each  
        4. Section C contains 5 questions of 3 marks each
        5. Section D contains 2 questions of 5 marks each
        
        SECTION A (1 mark each) - 10 questions
        Q1. What is the HCF of 12 and 18?
        Q2. Find the LCM of 6 and 8
        Q3. Is √2 a rational number?
        Q4. Express 0.375 as a fraction
        Q5. Find the decimal expansion of 1/7
        Q6. What is the fundamental theorem of arithmetic?
        Q7. Find the HCF of 24 and 36
        Q8. Is 0.101101110... rational?
        Q9. Find the LCM of 15 and 20
        Q10. Express 2.5 as a fraction
        
        SECTION B (2 marks each) - 8 questions
        Q11. Prove that √3 is irrational
        Q12. Find the HCF and LCM of 12, 15 and 21
        Q13. Show that any positive odd integer is of the form 6q+1, 6q+3 or 6q+5
        Q14. Find the decimal expansion of 3/8
        Q15. Prove that 3+2√5 is irrational
        Q16. Find the HCF of 96 and 404
        Q17. Show that every positive integer is either even or odd
        Q18. Find the LCM of 8, 9 and 25
        
        SECTION C (3 marks each) - 5 questions
        Q19. Prove that √5 is irrational
        Q20. Find the HCF and LCM of 6, 72 and 120
        Q21. Show that the square of any positive integer is of the form 3m or 3m+1
        Q22. Find the decimal expansion of 1/13
        Q23. Prove that 2+3√7 is irrational
        
        SECTION D (5 marks each) - 2 questions
        Q24. Prove that √2 is irrational
        Q25. Find the HCF and LCM of 6, 72 and 120 using prime factorization
      `;
      
      console.log('Sample text generated, length:', sampleText.length);
      return sampleText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
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
  private static addQuestion(doc: any, question: GeneratedQuestion, number: number) {
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
           
      } catch (error) {
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
    } catch (error) {
      console.error('Error deleting PDF file:', error);
      throw error;
    }
  }
}
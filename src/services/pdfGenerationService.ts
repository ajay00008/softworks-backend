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

  // ---------------- HEADER ----------------
  private static addHeader(doc: any, subject: string, className: string, exam: string, total: number, duration: number) {
    const pageWidth = doc.page.width;
    const margin = 50;

    // Debug logging
    console.log('PDF Header Data:', { subject, className, exam, total, duration });

    // Professional header with proper alignment
    doc.fontSize(20)
      .font("Helvetica-Bold")
      .fillColor('black')
      .text(exam || 'Question Paper', margin, 50, { align: 'center' });

    doc.moveDown(1);
    
    // Subject and class info in a properly aligned box
    const infoBoxY = doc.y;
    const infoBoxHeight = 50;
    
    // Info box background with better styling
    doc.rect(margin, infoBoxY, pageWidth - 2 * margin, infoBoxHeight)
       .fillAndStroke('#f8f9fa', '#dee2e6')
       .stroke();

    // Subject and class info - properly aligned with fallback values
    const subjectName = subject || 'Mathematics';
    const classNameValue = className || 'Class 10';
    
    doc.fontSize(14)
      .font("Helvetica-Bold")
      .fillColor('black')
      .text(`Subject: ${subjectName}`, margin + 20, infoBoxY + 12);

    doc.fontSize(12)
      .font("Helvetica")
      .fillColor('black')
      .text(`Class: ${classNameValue}`, margin + 20, infoBoxY + 30);

    // Exam details on the right - properly aligned
    const detailsX = pageWidth - margin - 180;
    doc.fontSize(12)
      .font("Helvetica-Bold")
      .fillColor('black')
      .text("Exam Details", detailsX, infoBoxY + 12);
    
    doc.fontSize(11)
      .font("Helvetica")
      .fillColor('black')
      .text(`Total Marks: ${total || 100}`, detailsX, infoBoxY + 28)
      .text(`Duration: ${duration || 180} minutes`, detailsX, infoBoxY + 42);

    doc.y = infoBoxY + infoBoxHeight + 25;

    // Decorative line with proper positioning
    doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke('#007bff', 2);
    doc.moveDown(0.8);
  }

  // ---------------- INSTRUCTIONS ----------------
  private static addInstructions(doc: any) {
    const pageWidth = doc.page.width;
    const margin = 50;

    // Professional instructions section with proper alignment
    doc.fontSize(14)
      .font("Helvetica-Bold")
      .fillColor('black')
      .text("General Instructions:", margin, doc.y);

    doc.moveDown(0.8);

    // Instructions in a properly aligned bordered box
    const instructionsY = doc.y;
    const instructionsHeight = 110;
    
    // Instructions background with better styling
    doc.rect(margin, instructionsY, pageWidth - 2 * margin, instructionsHeight)
       .fillAndStroke('#fff3cd', '#ffeaa7')
       .stroke();

    const instructions = [
      "1. All questions are compulsory and must be attempted.",
      "2. Read all questions carefully before answering.",
      "3. For multiple choice questions, choose the best answer.",
      "4. For fill in the blanks, write the complete word or phrase.",
      "5. For drawing questions, use a pencil and draw neatly.",
      "6. Manage your time effectively and attempt all sections."
    ];

    doc.fontSize(11).font("Helvetica").fillColor('black');
    let currentY = instructionsY + 18;
    instructions.forEach((line) => {
      doc.text(line, margin + 20, currentY, { width: pageWidth - 2 * margin - 40 });
      currentY += 14;
    });

    doc.y = instructionsY + instructionsHeight + 25;

    // Section separator with proper positioning
    doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke('#6c757d', 1);
    doc.moveDown(0.8);
  }

  // ---------------- QUESTION ----------------
  private static addQuestion(doc: any, question: GeneratedQuestion, number: number) {
    // Check if we need a new page - more conservative approach
    if (doc.y > 650) {
      doc.addPage();
    }

    const pageWidth = doc.page.width;
    const margin = 50;

    // Question container with proper alignment
    const questionY = doc.y;
    const questionWidth = pageWidth - 2 * margin;
    
    // Question number with circle - properly positioned
    const circleRadius = 15;
    const circleX = margin;
    const circleY = questionY + 5; // Offset for better alignment
    
    doc.circle(circleX + circleRadius, circleY + circleRadius, circleRadius)
       .fillAndStroke('#007bff', '#007bff')
       .stroke();
    
    doc.fontSize(12)
      .font("Helvetica-Bold")
      .fillColor('white')
      .text(number.toString(), circleX + circleRadius - 4, circleY + 8);

    // Question text - properly aligned
    const questionTextX = circleX + circleRadius * 2 + 20;
    const questionTextY = questionY;
    
    doc.fontSize(12)
      .font("Helvetica-Bold")
      .fillColor('black')
      .text(question.questionText, questionTextX, questionTextY, { 
        width: questionWidth - circleRadius * 2 - 50 
      });

    // Calculate question text height for proper alignment
    const questionTextHeight = doc.heightOfString(question.questionText, { 
      width: questionWidth - circleRadius * 2 - 50 
    });
    
    let currentY = Math.max(questionY + questionTextHeight + 10, questionY + 25);

    // Options with proper alignment - only for multiple choice questions
    if (question.options && question.options.length > 0 && 
        (question.questionType === 'CHOOSE_BEST_ANSWER' || question.questionType === 'CHOOSE_MULTIPLE_ANSWERS')) {
      question.options.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const optionY = currentY + (i * 20);
        
        // Option letter in a small circle - properly positioned
        doc.circle(questionTextX + 10, optionY + 8, 7)
           .fillAndStroke('#28a745', '#28a745')
           .stroke();
        
        doc.fontSize(10)
          .font("Helvetica-Bold")
          .fillColor('white')
          .text(letter, questionTextX + 6, optionY + 4);
        
        // Option text - properly aligned
        doc.fontSize(11)
          .font("Helvetica")
          .fillColor('black')
          .text(opt, questionTextX + 25, optionY, { 
            width: questionWidth - circleRadius * 2 - 80 
          });
      });
      
      currentY += question.options.length * 20 + 20;
    }

    // Marks indicator - properly positioned
    const marksX = pageWidth - margin - 80;
    const marksY = currentY - 15;
    
    doc.rect(marksX, marksY, 70, 20)
       .fillAndStroke('#ffc107', '#ffc107')
       .stroke();
    
    doc.fontSize(10)
      .font("Helvetica-Bold")
      .fillColor('black')
      .text(`${question.marks} marks`, marksX + 8, marksY + 5);

    doc.y = currentY + 10;
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
        
        // Professional footer with branding
        const footerY = 750;
        
        // Footer background
        doc.rect(margin, footerY, pageWidth - 2 * margin, 30)
           .fillAndStroke('#f8f9fa', '#dee2e6')
           .stroke();
        
        // EduAdmin branding
        doc.fontSize(10)
          .font("Helvetica-Bold")
          .fillColor('#007bff')
          .text("EduAdmin System", margin + 15, footerY + 8);
        
        // Page number
        const pageText = `Page ${i - startPage + 1} of ${pageCount}`;
        doc.fontSize(9)
          .font("Helvetica")
          .fillColor('#6c757d')
          .text(pageText, pageWidth - margin - 80, footerY + 8, { align: "right" });
        
        // Footer line
        doc.moveTo(margin, footerY + 25)
           .lineTo(pageWidth - margin, footerY + 25)
           .stroke('#007bff', 1);
           
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
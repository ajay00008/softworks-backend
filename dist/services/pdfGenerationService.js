import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { QuestionPaper } from '../models/QuestionPaper';
import { Question } from '../models/Question';
import { Subject } from '../models/Subject';
import { Class } from '../models/Class';
import { Exam } from '../models/Exam';
export class PDFGenerationService {
    static PUBLIC_FOLDER = path.join(process.cwd(), 'public');
    static QUESTION_PAPERS_FOLDER = path.join(this.PUBLIC_FOLDER, 'question-papers');
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
    static async generateQuestionPaperPDF(questionPaperId, questions, subjectName, className, examTitle, totalMarks, duration) {
        this.initialize();
        const fileName = `question-paper-${questionPaperId}-${Date.now()}.pdf`;
        const filePath = path.join(this.QUESTION_PAPERS_FOLDER, fileName);
        const downloadUrl = `/question-papers/${fileName}`;
        // Create PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            }
        });
        // Create write stream
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);
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
        // Finalize PDF
        doc.end();
        return new Promise((resolve, reject) => {
            stream.on('finish', () => {
                resolve({
                    fileName,
                    filePath,
                    downloadUrl
                });
            });
            stream.on('error', (error) => {
                reject(error);
            });
        });
    }
    /**
     * Add header to the PDF
     */
    static addHeader(doc, subjectName, className, examTitle, totalMarks, duration) {
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
    static addInstructions(doc) {
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
    static addQuestion(doc, question, questionNumber) {
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
    static addMultipleChoiceOptions(doc, options, multiple = false) {
        if (options.length === 0)
            return;
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
    static addTrueFalseOptions(doc) {
        doc.fontSize(10)
            .font('Helvetica')
            .text('A) True')
            .text('B) False');
    }
    /**
     * Add matching pairs
     */
    static addMatchingPairs(doc, pairs) {
        if (pairs.length === 0)
            return;
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
    static addDrawingInstructions(doc, instructions) {
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
    static addMarkingInstructions(doc, instructions) {
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
    static addFillBlanksInstructions(doc) {
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .text('Fill in the blanks with appropriate words:');
    }
    /**
     * Add one word answer instructions
     */
    static addOneWordAnswerInstructions(doc) {
        doc.fontSize(10)
            .font('Helvetica-Bold')
            .text('Answer in one word:');
    }
    /**
     * Add answer space based on marks
     */
    static addAnswerSpace(doc, marks) {
        const spaceHeight = Math.min(Math.max(marks * 2, 20), 100); // Proportional to marks
        doc.moveDown(0.3);
        doc.rect(50, doc.y, 500, spaceHeight)
            .stroke();
        doc.y += spaceHeight + 10;
    }
    /**
     * Add drawing space
     */
    static addDrawingSpace(doc) {
        const spaceHeight = 80;
        doc.moveDown(0.3);
        doc.rect(50, doc.y, 500, spaceHeight)
            .stroke();
        doc.y += spaceHeight + 10;
    }
    /**
     * Add footer to the PDF
     */
    static addFooter(doc) {
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
    }
    /**
     * Get download URL for a question paper PDF
     */
    static getDownloadUrl(fileName) {
        return `/question-papers/${fileName}`;
    }
    /**
     * Delete a question paper PDF file
     */
    static async deleteQuestionPaperPDF(fileName) {
        try {
            const filePath = path.join(this.QUESTION_PAPERS_FOLDER, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Error deleting PDF file:', error);
            return false;
        }
    }
}
//# sourceMappingURL=pdfGenerationService.js.map
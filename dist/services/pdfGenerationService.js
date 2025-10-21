import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
export class PDFGenerationService {
    static PUBLIC_FOLDER = path.join(process.cwd(), "public");
    static QUESTION_PAPERS_FOLDER = path.join(this.PUBLIC_FOLDER, "question-papers");
    static initialize() {
        if (!fs.existsSync(this.PUBLIC_FOLDER))
            fs.mkdirSync(this.PUBLIC_FOLDER, { recursive: true });
        if (!fs.existsSync(this.QUESTION_PAPERS_FOLDER))
            fs.mkdirSync(this.QUESTION_PAPERS_FOLDER, { recursive: true });
    }
    static async generateQuestionPaperPDF(questionPaperId, questions, subjectName, className, examTitle, totalMarks, duration) {
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
            }
            catch (err) {
                reject(err);
            }
        });
    }
    // ---------------- HEADER ----------------
    static addHeader(doc, subject, className, exam, total, duration) {
        const pageWidth = doc.page.width;
        const margin = 50;
        // Top line
        doc.fontSize(9)
            .font("Helvetica")
            .text("CBSE Worksheet", margin, 40, { continued: true })
            .text("www.eduadmin.com", { align: "right" });
        doc.moveDown(0.5);
        doc.fontSize(14).font("Helvetica-Bold").text(`Class ${className} ${subject}`, margin, doc.y);
        doc.fontSize(12).font("Helvetica").text(`${exam}`, margin, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(11)
            .text(`Total Marks: ${total}   Duration: ${duration} minutes`, margin, doc.y);
        doc.moveDown(0.8);
        doc.moveTo(margin, doc.y).lineTo(pageWidth - margin, doc.y).stroke();
        doc.moveDown(0.8);
    }
    // ---------------- INSTRUCTIONS ----------------
    static addInstructions(doc) {
        doc.fontSize(12).font("Helvetica-Bold").text("General Instructions:");
        doc.moveDown(0.3);
        const instructions = [
            "1. All questions are compulsory.",
            "2. Read all questions carefully before answering.",
            "3. Write your answers clearly and legibly.",
            "4. For multiple choice questions, choose the best answer.",
            "5. For fill in the blanks, write the complete word or phrase.",
            "6. For drawing questions, use a pencil and draw neatly.",
            "7. Manage your time effectively.",
        ];
        doc.fontSize(11).font("Helvetica");
        instructions.forEach((line) => doc.text(line, { width: 500, align: "left" }));
        doc.moveDown(0.8);
        doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
        doc.moveDown(0.8);
    }
    // ---------------- QUESTION ----------------
    static addQuestion(doc, question, number) {
        if (doc.y > 700)
            doc.addPage();
        doc.fontSize(12)
            .font("Helvetica-Bold")
            .text(`${number}. ${question.questionText}`, { width: 500, align: "left" });
        doc.moveDown(0.3);
        if (question.options && question.options.length > 0) {
            question.options.forEach((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                doc.fontSize(11).font("Helvetica").text(`${letter}) ${opt}`, { indent: 20 });
            });
            doc.moveDown(0.3);
        }
        // Space for answer
        const lines = Math.max(2, Math.ceil(question.marks / 2));
        for (let i = 0; i < lines; i++) {
            const y = doc.y + 15;
            doc.moveTo(60, y).lineTo(500, y).dash(1, { space: 2 }).stroke().undash();
            doc.moveDown(0.6);
        }
        doc.moveDown(0.5);
    }
    // ---------------- FOOTER ----------------
    static addFooter(doc) {
        const pageRange = doc.bufferedPageRange();
        if (!pageRange) {
            console.warn('No pages found in document');
            return;
        }
        const pageCount = pageRange.count;
        const startPage = pageRange.start;
        for (let i = startPage; i < startPage + pageCount; i++) {
            try {
                doc.switchToPage(i);
                doc.fontSize(9).font("Helvetica").fillColor("black");
                doc.text(`Page ${i - startPage + 1} of ${pageCount}`, 500, 800, { align: "right" });
            }
            catch (error) {
                console.warn(`Could not switch to page ${i}:`, error);
                // Continue with other pages
            }
        }
    }
    static async deleteQuestionPaperPDF(fileName) {
        try {
            const filePath = path.join(this.QUESTION_PAPERS_FOLDER, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        catch (error) {
            console.error('Error deleting PDF file:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=pdfGenerationService.js.map
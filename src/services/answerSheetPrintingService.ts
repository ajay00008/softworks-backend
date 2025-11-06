import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { Student } from '../models/Student';
import { Class } from '../models/Class';
import { Subject } from '../models/Subject';
import { EvaluationSettings } from '../models/EvaluationSettings';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface PrintOptions {
  includeFeedback: boolean;
  includePerformanceAnalysis: boolean;
  includeAnswerSheetImage: boolean;
  includeStepMarks: boolean;
  includeDeductions: boolean;
  format: 'PDF' | 'DOCX';
  template?: string;
}

export interface PrintResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export class AnswerSheetPrintingService {
  /**
   * Print individual answer sheet
   */
  static async printIndividualAnswerSheet(
    answerSheetId: string,
    options: PrintOptions = {
      includeFeedback: true,
      includePerformanceAnalysis: true,
      includeAnswerSheetImage: true,
      includeStepMarks: true,
      includeDeductions: true,
      format: 'PDF'
    }
  ): Promise<PrintResult> {
    try {
      logger.info(`Starting individual answer sheet printing: ${answerSheetId}`);

      // Get answer sheet with all related data
      const answerSheet = await AnswerSheet.findById(answerSheetId)
        .populate('examId')
        .populate('studentId')
        .populate('uploadedBy');

      if (!answerSheet) {
        return {
          success: false,
          error: 'Answer sheet not found'
        };
      }

      // Get exam details
      const exam = await Exam.findById(answerSheet.examId).populate('classId subjectIds');
      if (!exam) {
        return {
          success: false,
          error: 'Exam not found'
        };
      }

      // Get student details
      const student = await Student.findOne({ userId: answerSheet.studentId });
      if (!student) {
        return {
          success: false,
          error: 'Student not found'
        };
      }

      // Get evaluation settings
      const evaluationSettings = await EvaluationSettings.findOne({
        examId: answerSheet.examId,
        subjectId: exam.subjectIds[0],
        classId: exam.classId,
        isActive: true
      });

      if (options.format === 'PDF') {
        return await this.generatePDF(answerSheet, exam, student, evaluationSettings, options);
      } else {
        return await this.generateDOCX(answerSheet, exam, student, evaluationSettings, options);
      }

    } catch (error: unknown) {
      logger.error('Error printing individual answer sheet:', error);
      return {
        success: false,
        error: `Printing failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Print batch of answer sheets
   */
  static async printBatchAnswerSheets(
    examId: string,
    studentIds?: string[],
    options: PrintOptions = {
      includeFeedback: true,
      includePerformanceAnalysis: true,
      includeAnswerSheetImage: false, // Usually false for batch printing
      includeStepMarks: true,
      includeDeductions: true,
      format: 'PDF'
    }
  ): Promise<PrintResult> {
    try {
      logger.info(`Starting batch answer sheet printing for exam: ${examId}`);

      // Get exam details
      const exam = await Exam.findById(examId).populate('classId subjectIds');
      if (!exam) {
        return {
          success: false,
          error: 'Exam not found'
        };
      }

      // Get answer sheets
      const query: any = { examId, isActive: true };
      if (studentIds && studentIds.length > 0) {
        query.studentId = { $in: studentIds };
      }

      const answerSheets = await AnswerSheet.find(query)
        .populate('studentId')
        .populate('uploadedBy')
        .sort({ 'studentId.rollNumber': 1 });

      if (answerSheets.length === 0) {
        return {
          success: false,
          error: 'No answer sheets found for this exam'
        };
      }

      // Get evaluation settings
      const evaluationSettings = await EvaluationSettings.findOne({
        examId,
        subjectId: exam.subjectIds[0],
        classId: exam.classId,
        isActive: true
      });

      if (options.format === 'PDF') {
        return await this.generateBatchPDF(answerSheets, exam, evaluationSettings, options);
      } else {
        return await this.generateBatchDOCX(answerSheets, exam, evaluationSettings, options);
      }

    } catch (error: unknown) {
      logger.error('Error printing batch answer sheets:', error);
      return {
        success: false,
        error: `Batch printing failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Generate PDF for individual answer sheet
   */
  private static async generatePDF(
    answerSheet: any,
    exam: any,
    student: any,
    evaluationSettings: any,
    options: PrintOptions
  ): Promise<PrintResult> {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let yPosition = 800;
      const lineHeight = 20;
      const margin = 50;

      // Header
      page.drawText('ANSWER SHEET REPORT', {
        x: margin,
        y: yPosition,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      yPosition -= 30;

      // Student Information
      page.drawText('Student Information:', {
        x: margin,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Name: ${student.name}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Roll Number: ${student.rollNumber}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Class: ${exam.classId.name}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Subject: ${exam.subjectIds[0].name}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Exam: ${exam.title}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Date: ${exam.scheduledDate.toLocaleDateString()}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= 30;

      // Answer Sheet Status
      page.drawText('Answer Sheet Status:', {
        x: margin,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Status: ${answerSheet.status}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Uploaded At: ${answerSheet.createdAt.toLocaleString()}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Processed At: ${answerSheet.processedAt?.toLocaleString() || 'Not processed'}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= 30;

      // AI Correction Results (if available)
      if (answerSheet.aiCorrectionResults && options.includeFeedback) {
        page.drawText('AI Correction Results:', {
          x: margin,
          y: yPosition,
          size: 14,
          font: boldFont,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;

        const aiResults = answerSheet.aiCorrectionResults;
        page.drawText(`Total Marks: ${aiResults.totalMarks}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;

        page.drawText(`Obtained Marks: ${aiResults.obtainedMarks}`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;

        page.drawText(`Percentage: ${aiResults.percentage}%`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;

        page.drawText(`Confidence: ${(aiResults.confidence * 100).toFixed(1)}%`, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0)
        });
        yPosition -= 30;

        // Overall Feedback
        if (aiResults.overallFeedback) {
          page.drawText('Overall Feedback:', {
            x: margin,
            y: yPosition,
            size: 14,
            font: boldFont,
            color: rgb(0, 0, 0)
          });
          yPosition -= lineHeight;

          const feedbackLines = this.wrapText(aiResults.overallFeedback, 80);
          feedbackLines.forEach(line => {
            page.drawText(line, {
              x: margin,
              y: yPosition,
              size: 12,
              font: font,
              color: rgb(0, 0, 0)
            });
            yPosition -= lineHeight;
          });
          yPosition -= 20;
        }

        // Strengths
        if (aiResults.strengths && aiResults.strengths.length > 0) {
          page.drawText('Strengths:', {
            x: margin,
            y: yPosition,
            size: 14,
            font: boldFont,
            color: rgb(0, 0, 0)
          });
          yPosition -= lineHeight;

          aiResults.strengths.forEach((strength: string) => {
            page.drawText(`• ${strength}`, {
              x: margin + 20,
              y: yPosition,
              size: 12,
              font: font,
              color: rgb(0, 0, 0)
            });
            yPosition -= lineHeight;
          });
          yPosition -= 20;
        }

        // Suggestions
        if (aiResults.suggestions && aiResults.suggestions.length > 0) {
          page.drawText('Suggestions for Improvement:', {
            x: margin,
            y: yPosition,
            size: 14,
            font: boldFont,
            color: rgb(0, 0, 0)
          });
          yPosition -= lineHeight;

          aiResults.suggestions.forEach((suggestion: string) => {
            page.drawText(`• ${suggestion}`, {
              x: margin + 20,
              y: yPosition,
              size: 12,
              font: font,
              color: rgb(0, 0, 0)
            });
            yPosition -= lineHeight;
          });
        }
      }

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const fileName = `answer-sheet-${answerSheet._id}-${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), 'public', 'prints', fileName);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, pdfBytes);

      logger.info(`PDF generated successfully: ${fileName}`);

      return {
        success: true,
        filePath,
        fileName,
        fileSize: pdfBytes.length
      };

    } catch (error: unknown) {
      logger.error('Error generating PDF:', error);
      return {
        success: false,
        error: `PDF generation failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Generate batch PDF for multiple answer sheets
   */
  private static async generateBatchPDF(
    answerSheets: any[],
    exam: any,
    evaluationSettings: any,
    options: PrintOptions
  ): Promise<PrintResult> {
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Summary page
      let page = pdfDoc.addPage([595.28, 841.89]);
      let yPosition = 800;
      const lineHeight = 20;
      const margin = 50;

      // Header
      page.drawText('BATCH ANSWER SHEET REPORT', {
        x: margin,
        y: yPosition,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      yPosition -= 30;

      page.drawText(`Exam: ${exam.title}`, {
        x: margin,
        y: yPosition,
        size: 14,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Class: ${exam.classId.name}`, {
        x: margin,
        y: yPosition,
        size: 14,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Date: ${exam.scheduledDate.toLocaleDateString()}`, {
        x: margin,
        y: yPosition,
        size: 14,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      page.drawText(`Total Answer Sheets: ${answerSheets.length}`, {
        x: margin,
        y: yPosition,
        size: 14,
        font: font,
        color: rgb(0, 0, 0)
      });
      yPosition -= 40;

      // Summary table
      page.drawText('Answer Sheet Summary:', {
        x: margin,
        y: yPosition,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      yPosition -= 30;

      // Table headers
      page.drawText('Roll No.', {
        x: margin,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      page.drawText('Student Name', {
        x: margin + 100,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      page.drawText('Status', {
        x: margin + 300,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      page.drawText('Marks', {
        x: margin + 400,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
      yPosition -= lineHeight;

      // Draw line
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: margin + 500, y: yPosition },
        thickness: 1,
        color: rgb(0, 0, 0)
      });
      yPosition -= 10;

      // Table rows
      for (const answerSheet of answerSheets) {
        if (yPosition < 100) {
          page = pdfDoc.addPage([595.28, 841.89]);
          yPosition = 800;
        }

        const student = await Student.findOne({ userId: answerSheet.studentId });
        const rollNumber = student?.rollNumber || 'N/A';
        const studentName = (student?.userId as any)?.name || 'Unknown';

        page.drawText(rollNumber, {
          x: margin,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0)
        });

        page.drawText(studentName, {
          x: margin + 100,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0)
        });

        page.drawText(answerSheet.status, {
          x: margin + 300,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0)
        });

        const marks = answerSheet.aiCorrectionResults?.obtainedMarks || 'N/A';
        page.drawText(marks.toString(), {
          x: margin + 400,
          y: yPosition,
          size: 10,
          font: font,
          color: rgb(0, 0, 0)
        });

        yPosition -= lineHeight;
      }

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const fileName = `batch-answer-sheets-${exam._id}-${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), 'public', 'prints', fileName);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, pdfBytes);

      logger.info(`Batch PDF generated successfully: ${fileName}`);

      return {
        success: true,
        filePath,
        fileName,
        fileSize: pdfBytes.length
      };

    } catch (error: unknown) {
      logger.error('Error generating batch PDF:', error);
      return {
        success: false,
        error: `Batch PDF generation failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Generate DOCX (placeholder - would need docx library)
   */
  private static async generateDOCX(
    answerSheet: any,
    exam: any,
    student: any,
    evaluationSettings: any,
    options: PrintOptions
  ): Promise<PrintResult> {
    // This would require implementing DOCX generation
    // For now, return a placeholder
    return {
      success: false,
      error: 'DOCX generation not implemented yet'
    };
  }

  /**
   * Generate batch DOCX (placeholder)
   */
  private static async generateBatchDOCX(
    answerSheets: any[],
    exam: any,
    evaluationSettings: any,
    options: PrintOptions
  ): Promise<PrintResult> {
    // This would require implementing DOCX generation
    // For now, return a placeholder
    return {
      success: false,
      error: 'Batch DOCX generation not implemented yet'
    };
  }

  /**
   * Wrap text to fit within specified width
   */
  private static wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length <= maxWidth) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }
}

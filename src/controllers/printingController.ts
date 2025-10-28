import type { Request, Response } from 'express';
import { AnswerSheetPrintingService } from '../services/answerSheetPrintingService';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { StaffAccess } from '../models/StaffAccess';
import { logger } from '../utils/logger';

// Print individual answer sheet
export const printIndividualAnswerSheet = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const {
      includeFeedback = true,
      includePerformanceAnalysis = true,
      includeAnswerSheetImage = true,
      includeStepMarks = true,
      includeDeductions = true,
      format = 'PDF'
    } = req.body;
    
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get answer sheet and verify access
    const answerSheet = await AnswerSheet.findById(answerSheetId).populate('examId');
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    // Check if user has access to this answer sheet
    const exam = await Exam.findById(answerSheet.examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Check staff access
    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this answer sheet' });
    }

    // Print the answer sheet
    const printResult = await AnswerSheetPrintingService.printIndividualAnswerSheet(
      answerSheetId,
      {
        includeFeedback,
        includePerformanceAnalysis,
        includeAnswerSheetImage,
        includeStepMarks,
        includeDeductions,
        format: format as 'PDF' | 'DOCX'
      }
    );

    if (!printResult.success) {
      return res.status(500).json({
        success: false,
        error: printResult.error
      });
    }

    logger.info(`Answer sheet printed: ${answerSheetId} by ${userId}`);

    res.json({
      success: true,
      data: {
        fileName: printResult.fileName,
        filePath: printResult.filePath,
        fileSize: printResult.fileSize,
        downloadUrl: `/api/prints/download/${printResult.fileName}`
      },
      message: 'Answer sheet printed successfully'
    });
  } catch (error) {
    logger.error('Error printing individual answer sheet:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Print batch answer sheets
export const printBatchAnswerSheets = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const { studentIds, ...printOptions } = req.body;
    
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get exam and verify access
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Check staff access
    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this exam' });
    }

    // Print batch answer sheets
    const printResult = await AnswerSheetPrintingService.printBatchAnswerSheets(
      examId,
      studentIds,
      {
        includeFeedback: printOptions.includeFeedback ?? true,
        includePerformanceAnalysis: printOptions.includePerformanceAnalysis ?? true,
        includeAnswerSheetImage: printOptions.includeAnswerSheetImage ?? false,
        includeStepMarks: printOptions.includeStepMarks ?? true,
        includeDeductions: printOptions.includeDeductions ?? true,
        format: printOptions.format ?? 'PDF'
      }
    );

    if (!printResult.success) {
      return res.status(500).json({
        success: false,
        error: printResult.error
      });
    }

    logger.info(`Batch answer sheets printed for exam: ${examId} by ${userId}`);

    res.json({
      success: true,
      data: {
        fileName: printResult.fileName,
        filePath: printResult.filePath,
        fileSize: printResult.fileSize,
        downloadUrl: `/api/prints/download/${printResult.fileName}`
      },
      message: 'Batch answer sheets printed successfully'
    });
  } catch (error) {
    logger.error('Error printing batch answer sheets:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Download printed file
export const downloadPrintedFile = async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const filePath = `/Users/rishabhverma/satnam/softworks-backend/public/prints/${fileName}`;
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Send file
    res.sendFile(filePath);

    logger.info(`File downloaded: ${fileName} by ${userId}`);
  } catch (error) {
    logger.error('Error downloading printed file:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get print history
export const getPrintHistory = async (req: Request, res: Response) => {
  try {
    const { examId, page = 1, limit = 10 } = req.query;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // This would typically come from a print history database
    // For now, return mock data
    const printHistory = [
      {
        id: '1',
        fileName: 'answer-sheet-123.pdf',
        examId: examId || 'exam123',
        printedBy: userId,
        printedAt: new Date(),
        fileSize: 1024000,
        type: 'INDIVIDUAL'
      },
      {
        id: '2',
        fileName: 'batch-answer-sheets-123.pdf',
        examId: examId || 'exam123',
        printedBy: userId,
        printedAt: new Date(),
        fileSize: 2048000,
        type: 'BATCH'
      }
    ];

    res.json({
      success: true,
      data: printHistory,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: printHistory.length,
        pages: Math.ceil(printHistory.length / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching print history:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get print options
export const getPrintOptions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const printOptions = {
      formats: ['PDF', 'DOCX'],
      includeOptions: {
        feedback: true,
        performanceAnalysis: true,
        answerSheetImage: true,
        stepMarks: true,
        deductions: true
      },
      batchOptions: {
        maxSheetsPerBatch: 100,
        compressionEnabled: true,
        summaryPage: true
      },
      templates: [
        {
          id: 'default',
          name: 'Default Template',
          description: 'Standard answer sheet report template'
        },
        {
          id: 'detailed',
          name: 'Detailed Template',
          description: 'Comprehensive report with all details'
        },
        {
          id: 'summary',
          name: 'Summary Template',
          description: 'Brief summary report'
        }
      ]
    };

    res.json({
      success: true,
      data: printOptions
    });
  } catch (error) {
    logger.error('Error fetching print options:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
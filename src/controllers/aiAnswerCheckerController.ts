import type { Request, Response } from 'express';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { User } from '../models/User';
import { Teacher } from '../models/Teacher';
import { logger } from '../utils/logger';
import { AIAnswerCheckerService } from '../services/aiAnswerChecker';

/**
 * Check single answer sheet with AI
 */
export const checkAnswerSheetWithAI = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!answerSheetId) {
      return res.status(400).json({ success: false, error: 'Answer sheet ID is required' });
    }

    // Get answer sheet and verify access
    const answerSheet = await AnswerSheet.findById(answerSheetId)
      .populate('examId')
      .populate('studentId')
      .populate('uploadedBy');

    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    // Check if user has access to this answer sheet
    const exam = await Exam.findById(answerSheet.examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Check if user is a teacher with access to this exam's class
    const teacher = await Teacher.findOne({
      userId: userId,
      classIds: exam.classId._id
    });

    if (!teacher) {
      return res.status(403).json({ success: false, error: 'Access denied to this answer sheet' });
    }

    // Check if already processed
    if (answerSheet.status === 'AI_CORRECTED' || answerSheet.status === 'COMPLETED') {
      return res.status(400).json({ 
        success: false, 
        error: 'Answer sheet already processed',
        data: answerSheet.aiCorrectionResults
      });
    }

    // Start AI checking
    const aiChecker = AIAnswerCheckerService.getInstance();
    const result = await aiChecker.checkAnswerSheet(answerSheetId);

    logger.info(`AI checking completed for answer sheet: ${answerSheetId} by user: ${userId}`);

    res.json({
      success: true,
      data: result,
      message: 'Answer sheet processed successfully with AI'
    });

  } catch (error) {
    logger.error('Error in AI answer sheet checking:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process answer sheet with AI',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Batch check multiple answer sheets with AI
 */
export const batchCheckAnswerSheetsWithAI = async (req: Request, res: Response) => {
  try {
    const { answerSheetIds } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!answerSheetIds || !Array.isArray(answerSheetIds) || answerSheetIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Answer sheet IDs are required' });
    }

    if (answerSheetIds.length > 50) {
      return res.status(400).json({ success: false, error: 'Maximum 50 answer sheets can be processed at once' });
    }

    // Verify access to all answer sheets
    const answerSheets = await AnswerSheet.find({ _id: { $in: answerSheetIds } })
      .populate('examId')
      .populate('studentId');

    if (answerSheets.length !== answerSheetIds.length) {
      return res.status(400).json({ success: false, error: 'Some answer sheets not found' });
    }

    // Check access for each answer sheet
    for (const answerSheet of answerSheets) {
      const exam = await Exam.findById(answerSheet.examId).populate('classId');
      if (!exam) continue;

      // Check if user is a teacher with access to this exam's class
      const teacher = await Teacher.findOne({
        userId: userId,
        classIds: exam.classId._id
      });

      if (!teacher) {
        return res.status(403).json({ 
          success: false, 
          error: `Access denied to answer sheet: ${answerSheet._id}` 
        });
      }
    }

    // Start batch processing
    const aiChecker = AIAnswerCheckerService.getInstance();
    const results = await aiChecker.batchCheckAnswerSheets(answerSheetIds);

    logger.info(`Batch AI checking completed for ${answerSheetIds.length} answer sheets by user: ${userId}`);

    res.json({
      success: true,
      data: results,
      message: `Successfully processed ${results.length} answer sheets with AI`
    });

  } catch (error) {
    logger.error('Error in batch AI answer sheet checking:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process answer sheets with AI',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get AI checking results for an answer sheet
 */
export const getAIResults = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId)
      .populate('examId')
      .populate('studentId')
      .populate('uploadedBy');

    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    // Check access
    const exam = await Exam.findById(answerSheet.examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Check if user is a teacher with access to this exam's class
    const teacher = await Teacher.findOne({
      userId: userId,
      classIds: exam.classId._id
    });

    if (!teacher) {
      return res.status(403).json({ success: false, error: 'Access denied to this answer sheet' });
    }

    if (!answerSheet.aiCorrectionResults) {
      return res.status(404).json({ 
        success: false, 
        error: 'AI results not available for this answer sheet' 
      });
    }

    res.json({
      success: true,
      data: {
        answerSheetId: answerSheet._id,
        studentId: answerSheet.studentId,
        examId: answerSheet.examId,
        status: answerSheet.status,
        aiResults: answerSheet.aiCorrectionResults,
        uploadedAt: answerSheet.uploadedAt,
        processedAt: answerSheet.processedAt,
        confidence: answerSheet.confidence
      }
    });

  } catch (error) {
    logger.error('Error getting AI results:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get AI results',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get AI statistics for an exam
 */
export const getAIStats = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Check access to exam
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Check if user is a teacher with access to this exam's class
    const teacher = await Teacher.findOne({
      userId: userId,
      classIds: exam.classId._id
    });

    if (!teacher) {
      return res.status(403).json({ success: false, error: 'Access denied to this exam' });
    }

    // Get AI statistics
    const aiChecker = AIAnswerCheckerService.getInstance();
    const stats = await aiChecker.getAIStats(examId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error getting AI stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get AI statistics',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Manual override for AI results
 */
export const overrideAIResult = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const { questionId, correctedAnswer, correctedMarks, reason } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!questionId || !correctedAnswer || correctedMarks === undefined || !reason) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required: questionId, correctedAnswer, correctedMarks, reason' 
      });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId);
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    // Check access
    const exam = await Exam.findById(answerSheet.examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Check if user is a teacher with access to this exam's class
    const teacher = await Teacher.findOne({
      userId: userId,
      classIds: exam.classId._id
    });

    if (!teacher) {
      return res.status(403).json({ success: false, error: 'Access denied to this answer sheet' });
    }

    // Add manual override
    const manualOverride = {
      questionId,
      correctedAnswer,
      correctedMarks,
      reason,
      correctedBy: userId,
      correctedAt: new Date()
    };

    await AnswerSheet.findByIdAndUpdate(answerSheetId, {
      $push: { manualOverrides: manualOverride },
      status: 'MANUALLY_REVIEWED'
    });

    logger.info(`Manual override added for answer sheet: ${answerSheetId} by user: ${userId}`);

    res.json({
      success: true,
      data: manualOverride,
      message: 'Manual override added successfully'
    });

  } catch (error) {
    logger.error('Error adding manual override:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add manual override',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Get answer sheets ready for AI checking
 */
export const getAnswerSheetsForAIChecking = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const { status = 'UPLOADED', page = 1, limit = 20 } = req.query;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Check access to exam
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Check if user is a teacher with access to this exam's class
    const teacher = await Teacher.findOne({
      userId: userId,
      classIds: exam.classId._id
    });

    if (!teacher) {
      return res.status(403).json({ success: false, error: 'Access denied to this exam' });
    }

    // Get answer sheets
    const skip = (Number(page) - 1) * Number(limit);
    const answerSheets = await AnswerSheet.find({ 
      examId, 
      status: status as string,
      isActive: true 
    })
    .populate('studentId', 'name rollNumber')
    .populate('uploadedBy', 'name')
    .sort({ uploadedAt: -1 })
    .skip(skip)
    .limit(Number(limit));

    const total = await AnswerSheet.countDocuments({ 
      examId, 
      status: status as string,
      isActive: true 
    });

    res.json({
      success: true,
      data: {
        answerSheets,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    logger.error('Error getting answer sheets for AI checking:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get answer sheets',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

/**
 * Recheck answer sheet with AI (for failed or low confidence results)
 */
export const recheckAnswerSheetWithAI = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const answerSheet = await AnswerSheet.findById(answerSheetId);
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    // Check access
    const exam = await Exam.findById(answerSheet.examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Check if user is a teacher with access to this exam's class
    const teacher = await Teacher.findOne({
      userId: userId,
      classIds: exam.classId._id
    });

    if (!teacher) {
      return res.status(403).json({ success: false, error: 'Access denied to this answer sheet' });
    }

    // Reset status and recheck
    await AnswerSheet.findByIdAndUpdate(answerSheetId, {
      status: 'UPLOADED',
      $unset: { aiCorrectionResults: 1, processedAt: 1, confidence: 1 }
    });

    const aiChecker = AIAnswerCheckerService.getInstance();
    const result = await aiChecker.checkAnswerSheet(answerSheetId);

    logger.info(`Answer sheet rechecked with AI: ${answerSheetId} by user: ${userId}`);

    res.json({
      success: true,
      data: result,
      message: 'Answer sheet rechecked successfully with AI'
    });

  } catch (error) {
    logger.error('Error rechecking answer sheet with AI:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to recheck answer sheet with AI',
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

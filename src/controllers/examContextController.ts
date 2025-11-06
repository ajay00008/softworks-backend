import type { Request, Response } from 'express';
import { ExamContextService } from '../services/examContextService';
import { logger } from '../utils/logger';

/**
 * Get exam context data for a specific exam
 */
export const getExamContext = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const teacherId = (req as any).auth?.sub;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!examId) {
      return res.status(400).json({ success: false, error: 'Exam ID is required' });
    }

    const contextData = await ExamContextService.getExamContext(examId, teacherId);

    res.json({
      success: true,
      data: contextData
    });

  } catch (error: unknown) {
    logger.error('Error getting exam context:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage === 'Exam not found') {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }
    
    if (errorMessage === 'Access denied to this exam') {
      return res.status(403).json({ success: false, error: 'Access denied to this exam' });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Get all exams accessible to teacher with context data
 */
export const getTeacherExamsWithContext = async (req: Request, res: Response) => {
  try {
    const teacherId = (req as any).auth?.sub;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const examsWithContext = await ExamContextService.getTeacherExamsWithContext(teacherId);

    res.json({
      success: true,
      data: examsWithContext
    });

  } catch (error: unknown) {
    logger.error('Error getting teacher exams with context:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage === 'Teacher not found') {
      return res.status(404).json({ success: false, error: 'Teacher not found' });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Validate teacher access to exam operations
 */
export const validateTeacherAccess = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const { operation } = req.query;
    const teacherId = (req as any).auth?.sub;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!examId || !operation) {
      return res.status(400).json({ 
        success: false, 
        error: 'Exam ID and operation are required' 
      });
    }

    if (!['upload', 'evaluate', 'view'].includes(operation as string)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid operation. Must be upload, evaluate, or view' 
      });
    }

    const hasAccess = await ExamContextService.validateTeacherAccess(
      examId, 
      teacherId, 
      operation as 'upload' | 'evaluate' | 'view'
    );

    res.json({
      success: true,
      data: {
        hasAccess,
        operation,
        examId
      }
    });

  } catch (error: unknown) {
    logger.error('Error validating teacher access:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Get exam statistics for teacher dashboard
 */
export const getTeacherExamStatistics = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const teacherId = (req as any).auth?.sub;

    if (!teacherId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!examId) {
      return res.status(400).json({ success: false, error: 'Exam ID is required' });
    }

    // Validate access first
    const hasAccess = await ExamContextService.validateTeacherAccess(examId, teacherId, 'view');
    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Get statistics (this would be implemented based on your specific needs)
    const statistics = {
      totalStudents: 0,
      uploadedSheets: 0,
      evaluatedSheets: 0,
      flaggedSheets: 0,
      averageScore: 0,
      completionRate: 0
    };

    res.json({
      success: true,
      data: statistics
    });

  } catch (error: unknown) {
    logger.error('Error getting exam statistics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

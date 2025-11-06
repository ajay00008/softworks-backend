import type { Request, Response } from 'express';
import { FlagManagementService } from '../services/flagManagementService';
import type { FlagCreationData, FlagResolutionData } from '../services/flagManagementService';
import { logger } from '../utils/logger';

/**
 * Add a flag to an answer sheet
 */
export const addFlag = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const { type, severity, description, autoResolved } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!answerSheetId || !type || !severity || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Answer sheet ID, type, severity, and description are required' 
      });
    }

    const flagData: FlagCreationData = {
      type,
      severity,
      description,
      detectedBy: userId,
      autoResolved: autoResolved || false
    };

    const flag = await FlagManagementService.addFlag(answerSheetId, flagData);

    res.json({
      success: true,
      data: flag,
      message: 'Flag added successfully'
    });

  } catch (error: unknown) {
    logger.error('Error adding flag:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage === 'Answer sheet not found') {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Resolve a specific flag
 */
export const resolveFlag = async (req: Request, res: Response) => {
  try {
    const { answerSheetId, flagIndex } = req.params;
    const { resolutionNotes, autoResolved } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!answerSheetId || flagIndex === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Answer sheet ID and flag index are required' 
      });
    }

    const resolutionData: FlagResolutionData = {
      resolvedBy: userId,
      resolutionNotes,
      autoResolved: autoResolved || false
    };

    await FlagManagementService.resolveFlag(answerSheetId, parseInt(flagIndex), resolutionData);

    res.json({
      success: true,
      message: 'Flag resolved successfully'
    });

  } catch (error: unknown) {
    logger.error('Error resolving flag:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage === 'Answer sheet not found') {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }
    
    if (errorMessage === 'Invalid flag index') {
      return res.status(400).json({ success: false, error: 'Invalid flag index' });
    }
    
    if (errorMessage === 'Flag is already resolved') {
      return res.status(400).json({ success: false, error: 'Flag is already resolved' });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Resolve all flags for an answer sheet
 */
export const resolveAllFlags = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const { resolutionNotes, autoResolved } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!answerSheetId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Answer sheet ID is required' 
      });
    }

    const resolutionData: FlagResolutionData = {
      resolvedBy: userId,
      resolutionNotes,
      autoResolved: autoResolved || false
    };

    await FlagManagementService.resolveAllFlags(answerSheetId, resolutionData);

    res.json({
      success: true,
      message: 'All flags resolved successfully'
    });

  } catch (error: unknown) {
    logger.error('Error resolving all flags:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage === 'Answer sheet not found') {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Get flags for an answer sheet
 */
export const getAnswerSheetFlags = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;

    if (!answerSheetId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Answer sheet ID is required' 
      });
    }

    const flags = await FlagManagementService.getAnswerSheetFlags(answerSheetId);

    res.json({
      success: true,
      data: flags
    });

  } catch (error: unknown) {
    logger.error('Error getting answer sheet flags:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage === 'Answer sheet not found') {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Get flagged answer sheets for an exam
 */
export const getFlaggedAnswerSheets = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const { severity, type, resolved } = req.query;

    if (!examId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Exam ID is required' 
      });
    }

    const filters: any = {};
    if (severity) filters.severity = severity;
    if (type) filters.type = type;
    if (resolved !== undefined) filters.resolved = resolved === 'true';

    const flaggedSheets = await FlagManagementService.getFlaggedAnswerSheets(examId, filters);

    res.json({
      success: true,
      data: flaggedSheets
    });

  } catch (error: unknown) {
    logger.error('Error getting flagged answer sheets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Get flag statistics for an exam
 */
export const getFlagStatistics = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;

    if (!examId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Exam ID is required' 
      });
    }

    const statistics = await FlagManagementService.getFlagStatistics(examId);

    res.json({
      success: true,
      data: statistics
    });

  } catch (error: unknown) {
    logger.error('Error getting flag statistics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Auto-detect flags for an answer sheet
 */
export const autoDetectFlags = async (req: Request, res: Response) => {
  try {
    const { answerSheetId } = req.params;
    const analysisData = req.body;

    if (!answerSheetId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Answer sheet ID is required' 
      });
    }

    const flags = await FlagManagementService.autoDetectFlags(answerSheetId, analysisData);

    res.json({
      success: true,
      data: flags,
      message: `${flags.length} flags auto-detected`
    });

  } catch (error: unknown) {
    logger.error('Error auto-detecting flags:', error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage === 'Answer sheet not found') {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Bulk resolve flags for multiple answer sheets
 */
export const bulkResolveFlags = async (req: Request, res: Response) => {
  try {
    const { answerSheetIds, resolutionNotes, autoResolved } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!answerSheetIds || !Array.isArray(answerSheetIds) || answerSheetIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Answer sheet IDs array is required' 
      });
    }

    const resolutionData: FlagResolutionData = {
      resolvedBy: userId,
      resolutionNotes,
      autoResolved: autoResolved || false
    };

    await FlagManagementService.bulkResolveFlags(answerSheetIds, resolutionData);

    res.json({
      success: true,
      message: `Flags resolved for ${answerSheetIds.length} answer sheets`
    });

  } catch (error: unknown) {
    logger.error('Error bulk resolving flags:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

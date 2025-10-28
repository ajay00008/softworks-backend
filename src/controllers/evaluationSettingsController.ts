import type { Request, Response } from 'express';
import { EvaluationSettings } from '../models/EvaluationSettings';
import { Exam } from '../models/Exam';
import { Subject } from '../models/Subject';
import { Class } from '../models/Class';
import { logger } from '../utils/logger';

// Create evaluation settings
export const createEvaluationSettings = async (req: Request, res: Response) => {
  try {
    const {
      examId,
      subjectId,
      classId,
      minusMarksSettings,
      stepMarkingSettings,
      languageSettings,
      aiCorrectionSettings,
      qualityAssessmentSettings,
      feedbackSettings,
      cloudStorageSettings,
      printingSettings
    } = req.body;
    
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify exam, subject, and class exist
    const [exam, subject, classData] = await Promise.all([
      Exam.findById(examId),
      Subject.findById(subjectId),
      Class.findById(classId)
    ]);

    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }
    if (!classData) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }

    // Check if settings already exist
    const existingSettings = await EvaluationSettings.findOne({
      examId,
      subjectId,
      classId,
      isActive: true
    });

    if (existingSettings) {
      return res.status(400).json({ 
        success: false, 
        error: 'Evaluation settings already exist for this exam, subject, and class' 
      });
    }

    // Create evaluation settings
    const evaluationSettings = new EvaluationSettings({
      examId,
      subjectId,
      classId,
      createdBy: userId,
      minusMarksSettings: minusMarksSettings || {
        spellingMistakesPenalty: 5,
        stepMistakesPenalty: 10,
        diagramMistakesPenalty: 15,
        missingKeywordsPenalty: 8,
        handwritingQualityPenalty: 5,
        lateSubmissionPenalty: 10,
        incompleteAnswerPenalty: 20
      },
      stepMarkingSettings: stepMarkingSettings || {
        enabled: true,
        subjects: ['MATHEMATICS', 'PHYSICS', 'CHEMISTRY'],
        stepWeightDistribution: {
          understanding: 25,
          method: 35,
          calculation: 25,
          finalAnswer: 15
        },
        partialCreditEnabled: true,
        alternativeMethodsAccepted: true
      },
      languageSettings: languageSettings || {
        supportedLanguages: ['ENGLISH', 'TAMIL', 'HINDI'],
        spellingCorrectionEnabled: false,
        grammarCorrectionEnabled: false,
        preserveOriginalLanguage: true,
        alternativeAnswersAccepted: true
      },
      aiCorrectionSettings: aiCorrectionSettings || {
        confidenceThreshold: 0.7,
        humanReviewRequired: false,
        autoLearningEnabled: true,
        customInstructions: '',
        subjectSpecificPrompts: new Map()
      },
      qualityAssessmentSettings: qualityAssessmentSettings || {
        handwritingQualityWeight: 5,
        presentationWeight: 10,
        diagramQualityWeight: 15,
        organizationWeight: 10
      },
      feedbackSettings: feedbackSettings || {
        detailedFeedbackEnabled: true,
        strengthsHighlightEnabled: true,
        improvementSuggestionsEnabled: true,
        performanceAnalysisEnabled: true,
        customFeedbackTemplates: new Map()
      },
      cloudStorageSettings: cloudStorageSettings || {
        retentionPeriod: 365,
        autoDeleteEnabled: true,
        backupEnabled: true,
        compressionEnabled: true
      },
      printingSettings: printingSettings || {
        individualPrintEnabled: true,
        batchPrintEnabled: true,
        printFormat: 'PDF',
        includeFeedback: true,
        includePerformanceAnalysis: true
      }
    });

    await evaluationSettings.save();

    logger.info(`Evaluation settings created: ${evaluationSettings._id} for exam ${examId}, subject ${subjectId}, class ${classId}`);

    res.status(201).json({
      success: true,
      data: evaluationSettings,
      message: 'Evaluation settings created successfully'
    });
  } catch (error) {
    logger.error('Error creating evaluation settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get evaluation settings
export const getEvaluationSettings = async (req: Request, res: Response) => {
  try {
    const { examId, subjectId, classId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const evaluationSettings = await EvaluationSettings.findOne({
      examId,
      subjectId,
      classId,
      isActive: true
    }).populate('examId', 'title examType')
      .populate('subjectId', 'name code')
      .populate('classId', 'name')
      .populate('createdBy', 'name email');

    if (!evaluationSettings) {
      return res.status(404).json({ 
        success: false, 
        error: 'Evaluation settings not found' 
      });
    }

    res.json({
      success: true,
      data: evaluationSettings
    });
  } catch (error) {
    logger.error('Error fetching evaluation settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Update evaluation settings
export const updateEvaluationSettings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const evaluationSettings = await EvaluationSettings.findById(id);
    if (!evaluationSettings) {
      return res.status(404).json({ 
        success: false, 
        error: 'Evaluation settings not found' 
      });
    }

    // Update the settings
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        evaluationSettings[key] = updateData[key];
      }
    });

    await evaluationSettings.save();

    logger.info(`Evaluation settings updated: ${id} by ${userId}`);

    res.json({
      success: true,
      data: evaluationSettings,
      message: 'Evaluation settings updated successfully'
    });
  } catch (error) {
    logger.error('Error updating evaluation settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get all evaluation settings
export const getAllEvaluationSettings = async (req: Request, res: Response) => {
  try {
    const { examId, subjectId, classId, page = 1, limit = 10 } = req.query;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Build query
    const query: any = { isActive: true };
    
    if (examId) query.examId = examId;
    if (subjectId) query.subjectId = subjectId;
    if (classId) query.classId = classId;

    const evaluationSettings = await EvaluationSettings.find(query)
      .populate('examId', 'title examType scheduledDate')
      .populate('subjectId', 'name code')
      .populate('classId', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await EvaluationSettings.countDocuments(query);

    res.json({
      success: true,
      data: evaluationSettings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching all evaluation settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get evaluation settings by exam
export const getEvaluationSettingsByExam = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const evaluationSettings = await EvaluationSettings.find({
      examId,
      isActive: true
    }).populate('subjectId', 'name code')
      .populate('classId', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: evaluationSettings
    });
  } catch (error) {
    logger.error('Error fetching evaluation settings by exam:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Delete evaluation settings
export const deleteEvaluationSettings = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const evaluationSettings = await EvaluationSettings.findById(id);
    if (!evaluationSettings) {
      return res.status(404).json({ 
        success: false, 
        error: 'Evaluation settings not found' 
      });
    }

    evaluationSettings.isActive = false;
    await evaluationSettings.save();

    logger.info(`Evaluation settings deleted: ${id} by ${userId}`);

    res.json({
      success: true,
      message: 'Evaluation settings deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting evaluation settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get default evaluation settings template
export const getDefaultEvaluationSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const defaultSettings = {
      minusMarksSettings: {
        spellingMistakesPenalty: 5,
        stepMistakesPenalty: 10,
        diagramMistakesPenalty: 15,
        missingKeywordsPenalty: 8,
        handwritingQualityPenalty: 5,
        lateSubmissionPenalty: 10,
        incompleteAnswerPenalty: 20
      },
      stepMarkingSettings: {
        enabled: true,
        subjects: ['MATHEMATICS', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY'],
        stepWeightDistribution: {
          understanding: 25,
          method: 35,
          calculation: 25,
          finalAnswer: 15
        },
        partialCreditEnabled: true,
        alternativeMethodsAccepted: true
      },
      languageSettings: {
        supportedLanguages: ['ENGLISH', 'TAMIL', 'HINDI', 'MALAYALAM', 'TELUGU', 'KANNADA', 'FRENCH'],
        spellingCorrectionEnabled: false,
        grammarCorrectionEnabled: false,
        preserveOriginalLanguage: true,
        alternativeAnswersAccepted: true
      },
      aiCorrectionSettings: {
        confidenceThreshold: 0.7,
        humanReviewRequired: false,
        autoLearningEnabled: true,
        customInstructions: '',
        subjectSpecificPrompts: {}
      },
      qualityAssessmentSettings: {
        handwritingQualityWeight: 5,
        presentationWeight: 10,
        diagramQualityWeight: 15,
        organizationWeight: 10
      },
      feedbackSettings: {
        detailedFeedbackEnabled: true,
        strengthsHighlightEnabled: true,
        improvementSuggestionsEnabled: true,
        performanceAnalysisEnabled: true,
        customFeedbackTemplates: {}
      },
      cloudStorageSettings: {
        retentionPeriod: 365,
        autoDeleteEnabled: true,
        backupEnabled: true,
        compressionEnabled: true
      },
      printingSettings: {
        individualPrintEnabled: true,
        batchPrintEnabled: true,
        printFormat: 'PDF',
        includeFeedback: true,
        includePerformanceAnalysis: true
      }
    };

    res.json({
      success: true,
      data: defaultSettings
    });
  } catch (error) {
    logger.error('Error fetching default evaluation settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

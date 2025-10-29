import type { Request, Response } from 'express';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { StaffAccess } from '../models/StaffAccess';
import { Teacher } from '../models/Teacher';
import { Student } from '../models/Student';
import { logger } from '../utils/logger';
import { ImageProcessingService } from '../services/imageProcessing';
import { CloudStorageService } from '../services/cloudStorage';
import { AIRollNumberDetectionService } from '../services/aiRollNumberDetection';
import fs from 'fs';
import path from 'path';

// Enhanced batch upload with AI roll number detection
export const batchUploadAnswerSheetsEnhanced = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const uploadedBy = (req as any).auth?.sub;
    const files = req.files as Express.Multer.File[];

    if (!uploadedBy) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Check if staff has access to this exam's class
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: uploadedBy,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this class' });
    }

    const cloudStorage = new CloudStorageService();
    const aiDetectionService = AIRollNumberDetectionService.getInstance();
    const results = [];
    const errors = [];

    // Process each file with AI
    for (const file of files) {
      try {
        logger.info(`Processing file: ${file.originalname}`);
        
        // Process with AI roll number detection
        const aiResult = await aiDetectionService.processAnswerSheetUpload(
          examId,
          file.buffer,
          file.originalname,
          uploadedBy
        );

        // Upload to cloud storage
        const uploadResult = await cloudStorage.uploadAnswerSheet(
          file.buffer,
          examId,
          aiResult.studentMatching.matchedStudent?.id || 'unknown',
          file.originalname,
          file.buffer // In real implementation, this might be processed image
        );

        // Create answer sheet record
        const answerSheetData: any = {
          examId,
          studentId: aiResult.studentMatching.matchedStudent?.id || null,
          uploadedBy,
          originalFileName: file.originalname,
          cloudStorageUrl: uploadResult.original.url,
          cloudStorageKey: uploadResult.original.key,
          status: aiResult.status,
          scanQuality: aiResult.scanQuality,
          isAligned: aiResult.isAligned,
          rollNumberDetected: aiResult.rollNumberDetection.rollNumber,
          rollNumberConfidence: aiResult.rollNumberDetection.confidence * 100,
          language: 'ENGLISH',
          aiProcessingResults: {
            rollNumberDetection: aiResult.rollNumberDetection,
            studentMatching: aiResult.studentMatching,
            imageAnalysis: {
              quality: aiResult.scanQuality,
              isAligned: aiResult.isAligned
            },
            issues: aiResult.issues,
            suggestions: aiResult.suggestions,
            processingTime: aiResult.processingTime
          }
        };

        const answerSheet = new AnswerSheet(answerSheetData);
        await answerSheet.save();

        // Update AI result with answer sheet ID
        aiResult.answerSheetId = answerSheet._id.toString();

        results.push({
          answerSheetId: answerSheet._id,
          originalFileName: file.originalname,
          status: answerSheet.status,
          rollNumberDetected: aiResult.rollNumberDetection.rollNumber,
          rollNumberConfidence: aiResult.rollNumberDetection.confidence * 100,
          scanQuality: aiResult.scanQuality,
          isAligned: aiResult.isAligned,
          matchedStudent: aiResult.studentMatching.matchedStudent,
          issues: aiResult.issues,
          suggestions: aiResult.suggestions,
          processingTime: aiResult.processingTime
        });

        logger.info(`Answer sheet processed successfully: ${answerSheet._id}`);
      } catch (error) {
        logger.error(`Failed to process file ${file.originalname}:`, error);
        errors.push({
          fileName: file.originalname,
          error: error.message
        });
      }
    }

    // Send notifications for successfully processed sheets
    if (results.length > 0) {
      try {
        const notificationPromises = results
          .filter(result => result.matchedStudent)
          .map(async (result) => {
            const notification = new Notification({
              userId: result.matchedStudent!.id,
              type: 'ANSWER_SHEET_UPLOADED',
              title: 'Answer Sheet Uploaded',
              message: `Your answer sheet for ${exam.title} has been uploaded and processed successfully.`,
              data: {
                examId: exam._id,
                answerSheetId: result.answerSheetId,
                examTitle: exam.title
              }
            });
            return notification.save();
          });

        await Promise.all(notificationPromises);
      } catch (error) {
        logger.error('Failed to send notifications:', error);
      }
    }

    res.json({
      success: true,
      data: results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        totalFiles: files.length,
        processedSuccessfully: results.length,
        errors: errors.length,
        matchedStudents: results.filter(r => r.matchedStudent).length,
        unmatchedSheets: results.filter(r => !r.matchedStudent).length
      }
    });

  } catch (error) {
    logger.error('Error in batch upload answer sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

// Enhanced single answer sheet upload
export const uploadAnswerSheetEnhanced = async (req: Request, res: Response) => {
  try {
    const { examId, studentId, language = 'ENGLISH' } = req.body;
    const uploadedBy = (req as any).auth?.sub;
    const file = req.file as Express.Multer.File;

    if (!uploadedBy) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Check if staff has access to this exam's class
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: uploadedBy,
      'classAccess.classId': exam.classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.status(403).json({ success: false, error: 'Access denied to this class' });
    }

    // Check if answer sheet already exists for this student
    if (studentId) {
      const existingSheet = await AnswerSheet.findOne({ examId, studentId });
      if (existingSheet) {
        return res.status(400).json({ 
          success: false, 
          error: 'Answer sheet already exists for this student' 
        });
      }
    }

    const cloudStorage = new CloudStorageService();
    const aiDetectionService = AIRollNumberDetectionService.getInstance();

    // Process with AI if no student ID provided
    let aiResult = null;
    if (!studentId) {
      aiResult = await aiDetectionService.processAnswerSheetUpload(
        examId,
        file.buffer,
        file.originalname,
        uploadedBy
      );
    }

    // Upload file to cloud storage
    const uploadResult = await cloudStorage.uploadAnswerSheet(
      file.buffer,
      examId,
      studentId || aiResult?.studentMatching.matchedStudent?.id || 'unknown',
      file.originalname,
      file.buffer
    );

    // Create answer sheet record
    const answerSheetData: any = {
      examId,
      studentId: studentId || aiResult?.studentMatching.matchedStudent?.id || null,
      uploadedBy,
      originalFileName: file.originalname,
      cloudStorageUrl: uploadResult.original.url,
      cloudStorageKey: uploadResult.original.key,
      status: aiResult?.status || 'UPLOADED',
      scanQuality: aiResult?.scanQuality || 'GOOD',
      isAligned: aiResult?.isAligned ?? true,
      rollNumberDetected: aiResult?.rollNumberDetection.rollNumber,
      rollNumberConfidence: aiResult?.rollNumberDetection.confidence ? aiResult.rollNumberDetection.confidence * 100 : 0,
      language,
      aiProcessingResults: aiResult ? {
        rollNumberDetection: aiResult.rollNumberDetection,
        studentMatching: aiResult.studentMatching,
        imageAnalysis: {
          quality: aiResult.scanQuality,
          isAligned: aiResult.isAligned
        },
        issues: aiResult.issues,
        suggestions: aiResult.suggestions,
        processingTime: aiResult.processingTime
      } : undefined
    };

    const answerSheet = new AnswerSheet(answerSheetData);
    await answerSheet.save();

    // Send notification if student was matched
    if (aiResult?.studentMatching.matchedStudent) {
      try {
        const notification = new Notification({
          userId: aiResult.studentMatching.matchedStudent.id,
          type: 'ANSWER_SHEET_UPLOADED',
          title: 'Answer Sheet Uploaded',
          message: `Your answer sheet for ${exam.title} has been uploaded and processed successfully.`,
          data: {
            examId: exam._id,
            answerSheetId: answerSheet._id,
            examTitle: exam.title
          }
        });
        await notification.save();
      } catch (error) {
        logger.error('Failed to send notification:', error);
      }
    }

    res.status(201).json({
      success: true,
      data: {
        answerSheetId: answerSheet._id,
        originalFileName: file.originalname,
        status: answerSheet.status,
        rollNumberDetected: aiResult?.rollNumberDetection.rollNumber,
        rollNumberConfidence: aiResult?.rollNumberDetection.confidence ? aiResult.rollNumberDetection.confidence * 100 : 0,
        scanQuality: answerSheet.scanQuality,
        isAligned: answerSheet.isAligned,
        matchedStudent: aiResult?.studentMatching.matchedStudent,
        issues: aiResult?.issues || [],
        suggestions: aiResult?.suggestions || [],
        processingTime: aiResult?.processingTime || 0
      }
    });

  } catch (error) {
    logger.error('Error in upload answer sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

// Enhanced student matching with AI suggestions
export const matchAnswerSheetToStudentEnhanced = async (req: Request, res: Response) => {
  try {
    const { answerSheetId, rollNumber, studentId } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get answer sheet
    const answerSheet = await AnswerSheet.findById(answerSheetId).populate('examId');
    if (!answerSheet) {
      return res.status(404).json({ success: false, error: 'Answer sheet not found' });
    }

    // Get exam details
    const exam = await Exam.findById(answerSheet.examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    let student;
    
    if (studentId) {
      // Direct student ID match
      const studentRecord = await Student.findOne({
        userId: studentId,
        classId: exam.classId,
        isActive: true
      }).populate('userId', 'name email');
      
      if (!studentRecord) {
        return res.status(404).json({ 
          success: false, 
          error: 'Student not found in this class' 
        });
      }
      
      student = studentRecord;
    } else if (rollNumber) {
      // Find student by roll number
      student = await Student.findOne({
        rollNumber: rollNumber,
        classId: exam.classId,
        isActive: true
      }).populate('userId', 'name email');

      if (!student) {
        return res.status(404).json({ 
          success: false, 
          error: `No student found with roll number ${rollNumber} in ${exam.classId.name}` 
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either rollNumber or studentId must be provided'
      });
    }

    // Check if answer sheet already exists for this student
    const existingSheet = await AnswerSheet.findOne({
      examId: exam._id,
      studentId: student.userId,
      isActive: true
    });

    if (existingSheet && existingSheet._id.toString() !== answerSheetId) {
      return res.status(400).json({ 
        success: false, 
        error: `Answer sheet already exists for student ${student.userId.name} (Roll: ${student.rollNumber})` 
      });
    }

    // Update answer sheet with student information
    answerSheet.studentId = student.userId;
    answerSheet.rollNumberDetected = student.rollNumber;
    answerSheet.rollNumberConfidence = 100; // Manual match
    answerSheet.status = 'UPLOADED';
    
    // Update AI processing results if they exist
    if (answerSheet.aiProcessingResults) {
      answerSheet.aiProcessingResults.studentMatching = {
        matchedStudent: {
          id: student.userId._id.toString(),
          name: student.userId.name,
          rollNumber: student.rollNumber,
          email: student.userId.email
        },
        confidence: 1.0,
        processingTime: 0
      };
    }
    
    await answerSheet.save();

    logger.info(`Answer sheet ${answerSheetId} matched to student ${student.userId.name} (${student.rollNumber})`);

    res.json({
      success: true,
      data: {
        answerSheetId: answerSheet._id,
        matchedStudent: {
          id: student.userId._id,
          name: student.userId.name,
          rollNumber: student.rollNumber,
          email: student.userId.email
        },
        rollNumber: student.rollNumber,
        confidence: 100
      }
    });

  } catch (error) {
    logger.error('Error in match answer sheet to student:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

// Get answer sheets with AI processing results
export const getAnswerSheetsWithAIResults = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get exam details
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Verify teacher has access to this exam's class
    const teacher = await Teacher.findOne({ userId });
    if (!teacher) {
      return res.status(403).json({ 
        success: false, 
        error: 'Teacher record not found. Please contact administrator.' 
      });
    }

    // Check if teacher has access to this class
    if (!teacher.classIds.includes(exam.classId._id)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this exam\'s class' 
      });
    }

    // Get answer sheets with populated data
    const answerSheets = await AnswerSheet.find({
      examId: exam._id,
      isActive: true
    })
    .populate('studentId', 'name email')
    .populate('uploadedBy', 'name')
    .sort({ uploadedAt: -1 });

    // Transform data to include AI results
    const transformedSheets = answerSheets.map(sheet => ({
      _id: sheet._id,
      originalFileName: sheet.originalFileName,
      status: sheet.status,
      uploadedAt: sheet.uploadedAt,
      processedAt: sheet.processedAt,
      scanQuality: sheet.scanQuality,
      rollNumberDetected: sheet.rollNumberDetected,
      rollNumberConfidence: sheet.rollNumberConfidence,
      studentId: sheet.studentId ? {
        _id: sheet.studentId._id,
        name: sheet.studentId.name,
        email: sheet.studentId.email
      } : null,
      uploadedBy: sheet.uploadedBy ? {
        _id: sheet.uploadedBy._id,
        name: sheet.uploadedBy.name
      } : null,
      aiProcessingResults: sheet.aiProcessingResults || null,
      cloudStorageUrl: sheet.cloudStorageUrl
    }));

    res.json({
      success: true,
      data: {
        answerSheets: transformedSheets,
        summary: {
          total: transformedSheets.length,
          matched: transformedSheets.filter(s => s.studentId).length,
          unmatched: transformedSheets.filter(s => !s.studentId).length,
          aiProcessed: transformedSheets.filter(s => s.aiProcessingResults).length
        }
      }
    });

  } catch (error) {
    logger.error('Error in get answer sheets with AI results:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

// Auto-match unmatched answer sheets using AI
export const autoMatchUnmatchedSheets = async (req: Request, res: Response) => {
  try {
    const { examId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get exam details
    const exam = await Exam.findById(examId).populate('classId');
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    // Verify teacher has access to this exam's class
    const teacher = await Teacher.findOne({ userId });
    if (!teacher) {
      return res.status(403).json({ 
        success: false, 
        error: 'Teacher record not found. Please contact administrator.' 
      });
    }

    if (!teacher.classIds.includes(exam.classId._id)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied to this exam\'s class' 
      });
    }

    // Get unmatched answer sheets
    const unmatchedSheets = await AnswerSheet.find({
      examId: exam._id,
      studentId: null,
      isActive: true,
      rollNumberDetected: { $exists: true, $ne: null }
    });

    const aiDetectionService = AIRollNumberDetectionService.getInstance();
    const results = [];

    for (const sheet of unmatchedSheets) {
      try {
        // Try to match using detected roll number
        const matchingResult = await aiDetectionService.matchStudentToRollNumber(
          sheet.rollNumberDetected!,
          examId,
          (sheet.rollNumberConfidence || 0) / 100
        );

        if (matchingResult.matchedStudent && matchingResult.confidence > 0.7) {
          // Update answer sheet
          sheet.studentId = matchingResult.matchedStudent.id;
          sheet.rollNumberConfidence = matchingResult.confidence * 100;
          sheet.status = 'UPLOADED';
          
          if (sheet.aiProcessingResults) {
            sheet.aiProcessingResults.studentMatching = matchingResult;
          }
          
          await sheet.save();

          results.push({
            answerSheetId: sheet._id,
            originalFileName: sheet.originalFileName,
            matchedStudent: matchingResult.matchedStudent,
            confidence: matchingResult.confidence * 100,
            status: 'SUCCESS'
          });

          logger.info(`Auto-matched answer sheet ${sheet._id} to student ${matchingResult.matchedStudent.name}`);
        } else {
          results.push({
            answerSheetId: sheet._id,
            originalFileName: sheet.originalFileName,
            alternatives: matchingResult.alternatives,
            confidence: matchingResult.confidence * 100,
            status: 'NO_MATCH'
          });
        }
      } catch (error) {
        logger.error(`Failed to auto-match answer sheet ${sheet._id}:`, error);
        results.push({
          answerSheetId: sheet._id,
          originalFileName: sheet.originalFileName,
          error: error.message,
          status: 'ERROR'
        });
      }
    }

    res.json({
      success: true,
      data: {
        processed: results.length,
        successful: results.filter(r => r.status === 'SUCCESS').length,
        noMatch: results.filter(r => r.status === 'NO_MATCH').length,
        errors: results.filter(r => r.status === 'ERROR').length,
        results
      }
    });

  } catch (error) {
    logger.error('Error in auto-match unmatched sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
};

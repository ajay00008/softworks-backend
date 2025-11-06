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

    if (!examId) {
      return res.status(400).json({ success: false, error: 'Exam ID is required' });
    }

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

        const matchedStudentId = aiResult.studentMatching.matchedStudent?.id || 'unknown';
        if (typeof matchedStudentId !== 'string') {
          throw new Error('Invalid student ID');
        }

        // Upload to cloud storage
        const uploadResult = await cloudStorage.uploadAnswerSheet(
          file.buffer,
          examId,
          matchedStudentId,
          file.originalname,
          file.buffer // In real implementation, this might be processed image
        );

        // Determine final status - prioritize matched students
        let finalStatus = aiResult.status;
        if (aiResult.studentMatching.matchedStudent && aiResult.studentMatching.confidence > 0.7) {
          finalStatus = 'UPLOADED'; // Force UPLOADED status if student is matched with good confidence
        }

        // Create answer sheet record
        const answerSheetData: any = {
          examId,
          studentId: aiResult.studentMatching.matchedStudent?.id || null,
          uploadedBy,
          originalFileName: file.originalname,
          cloudStorageUrl: uploadResult.original.url,
          cloudStorageKey: uploadResult.original.key,
          status: finalStatus,
          scanQuality: aiResult.scanQuality,
          isAligned: aiResult.isAligned,
          rollNumberDetected: aiResult.rollNumberDetection.rollNumber || null,
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
        const answerSheetIdStr = String(answerSheet._id);
        aiResult.answerSheetId = answerSheetIdStr;

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

        logger.info(`Answer sheet processed successfully: ${answerSheetIdStr}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error" : 'Unknown error';
        logger.error(`Failed to process file ${file.originalname}:`, error);
        errors.push({
          fileName: file.originalname,
          error: errorMessage
        });
      }
    }

    // Send notifications for successfully processed sheets
    if (results.length > 0) {
      try {
        const { NotificationService } = await import('../services/notificationService');
        const examIdStr = String(exam._id);
        const notificationPromises = results
          .filter(result => result.matchedStudent)
          .map(async (result) => {
            const answerSheetIdStr = String(result.answerSheetId);
            return NotificationService.createNotification({
              type: 'ANSWER_SHEET_UPLOADED',
              priority: 'LOW',
              title: 'Answer Sheet Uploaded',
              message: `Your answer sheet for ${exam.title} has been uploaded and processed successfully.`,
              recipientId: result.matchedStudent!.id,
              relatedEntityId: answerSheetIdStr,
              relatedEntityType: 'answerSheet',
              metadata: {
                examId: examIdStr,
                answerSheetId: answerSheetIdStr,
                examTitle: exam.title
              }
            });
          });

        await Promise.all(notificationPromises);

        // Also notify teacher who uploaded (and their admin via Socket.IO)
        if (uploadedBy) {
          await NotificationService.createNotification({
            type: 'ANSWER_SHEET_UPLOADED',
            priority: 'LOW',
            title: 'Answer Sheets Processed',
            message: `${results.length} answer sheet(s) for ${exam.title} have been processed successfully.`,
            recipientId: uploadedBy,
            relatedEntityId: examIdStr,
            relatedEntityType: 'exam',
            metadata: {
              examId: examIdStr,
              examTitle: exam.title,
              processedCount: results.length
            }
          });
        }

        // Send notifications to admin for unmatched answer sheets
        const unmatchedResults = results.filter(r => !r.matchedStudent);
        if (unmatchedResults.length > 0 && uploadedBy) {
          try {
            // Get teacher's adminId
            const teacher = await Teacher.findOne({ userId: uploadedBy });
            if (teacher && teacher.adminId) {
              await NotificationService.createNotification({
                type: 'MANUAL_REVIEW_REQUIRED',
                priority: 'MEDIUM',
                title: 'Unmatched Answer Sheets Require Review',
                message: `${unmatchedResults.length} answer sheet(s) for ${exam.title} could not be matched to students. Please review and match manually.`,
                recipientId: String(teacher.adminId),
                relatedEntityId: examIdStr,
                relatedEntityType: 'exam',
                metadata: {
                  examId: examIdStr,
                  examTitle: exam.title,
                  unmatchedCount: unmatchedResults.length,
                  unmatchedSheets: unmatchedResults.map(r => ({
                    answerSheetId: r.answerSheetId,
                    fileName: r.originalFileName,
                    rollNumber: r.rollNumberDetected
                  }))
                }
              });
              logger.info(`Sent notification to admin ${teacher.adminId} for ${unmatchedResults.length} unmatched answer sheets`);
            }
          } catch (adminNotifError) {
            logger.error('Failed to send admin notification for unmatched sheets:', adminNotifError);
          }
        }
      } catch (error: unknown) {
        logger.error('Failed to send notifications:', error);
      }
    }

    res.json({
      success: true,
      data: {
        message: "Answer sheets uploaded successfully",
        results: results,
        totalFiles: files.length,
        successfulUploads: results.length,
        failedUploads: errors.length,
        matchedStudents: results.filter(r => r.matchedStudent).length,
        unmatchedSheets: results.filter(r => !r.matchedStudent).length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: unknown) {
    logger.error('Error in batch upload answer sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"
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

    // Determine final status - prioritize matched students
    let finalStatus = aiResult?.status || 'UPLOADED';
    if (aiResult?.studentMatching?.matchedStudent && aiResult.studentMatching.confidence > 0.7) {
      finalStatus = 'UPLOADED'; // Force UPLOADED status if student is matched with good confidence
    }

    // Create answer sheet record
    const answerSheetData: any = {
      examId,
      studentId: studentId || aiResult?.studentMatching.matchedStudent?.id || null,
      uploadedBy,
      originalFileName: file.originalname,
      cloudStorageUrl: uploadResult.original.url,
      cloudStorageKey: uploadResult.original.key,
      status: finalStatus,
      scanQuality: aiResult?.scanQuality || 'GOOD',
      isAligned: aiResult?.isAligned ?? true,
      rollNumberDetected: aiResult?.rollNumberDetection?.rollNumber || null,
      rollNumberConfidence: aiResult?.rollNumberDetection?.confidence ? aiResult.rollNumberDetection.confidence * 100 : 0,
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

    // Send notification if student was matched (and to teacher/admin via Socket.IO)
    if (aiResult?.studentMatching.matchedStudent) {
      try {
        const { NotificationService } = await import('../services/notificationService');
        const examIdStr = String(exam._id);
        await NotificationService.createNotification({
          type: 'ANSWER_SHEET_UPLOADED',
          priority: 'LOW',
          title: 'Answer Sheet Uploaded',
          message: `Your answer sheet for ${exam.title} has been uploaded and processed successfully.`,
          recipientId: aiResult.studentMatching.matchedStudent.id,
          relatedEntityId: String(answerSheet._id),
          relatedEntityType: 'answerSheet',
          metadata: {
            examId: examIdStr,
            answerSheetId: String(answerSheet._id),
            examTitle: exam.title
          }
        });
      } catch (error: unknown) {
        logger.error('Failed to send notification:', error);
      }
    }

    // Also send notification to teacher who uploaded (and their admin via Socket.IO)
    if (uploadedBy) {
      try {
        const { NotificationService } = await import('../services/notificationService');
        const examIdStr = String(exam._id);
        const answerSheetIdStr = String(answerSheet._id);
        if (aiResult?.studentMatching.matchedStudent) {
          // Sheet was matched
          await NotificationService.createNotification({
            type: 'ANSWER_SHEET_UPLOADED',
            priority: 'LOW',
            title: 'Answer Sheet Processed',
            message: `Answer sheet for ${exam.title} has been processed and matched to student.`,
            recipientId: uploadedBy,
            relatedEntityId: answerSheetIdStr,
            relatedEntityType: 'answerSheet',
            metadata: {
              examId: examIdStr,
              answerSheetId: answerSheetIdStr,
              examTitle: exam.title,
              studentName: aiResult.studentMatching.matchedStudent.name
            }
          });
        } else {
          // Sheet was not matched - notify admin
          const teacher = await Teacher.findOne({ userId: uploadedBy });
          if (teacher && teacher.adminId) {
            await NotificationService.createNotification({
              type: 'MANUAL_REVIEW_REQUIRED',
              priority: 'MEDIUM',
              title: 'Unmatched Answer Sheet Requires Review',
              message: `Answer sheet "${file.originalname}" for ${exam.title} could not be matched to a student. Detected roll number: ${aiResult?.rollNumberDetection?.rollNumber || 'Not detected'}. Please review and match manually.`,
              recipientId: String(teacher.adminId),
              relatedEntityId: answerSheetIdStr,
              relatedEntityType: 'answerSheet',
              metadata: {
                examId: examIdStr,
                examTitle: exam.title,
                answerSheetId: answerSheetIdStr,
                fileName: file.originalname,
                rollNumberDetected: aiResult?.rollNumberDetection?.rollNumber,
                rollNumberConfidence: aiResult?.rollNumberDetection?.confidence
              }
            });
            logger.info(`Sent notification to admin ${teacher.adminId} for unmatched answer sheet ${answerSheet._id}`);
          }
        }
      } catch (error: unknown) {
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

  } catch (error: unknown) {
    logger.error('Error in upload answer sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"
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
        const examClassId = exam.classId as any;
        const className = examClassId?.name || 'Unknown Class';
        return res.status(404).json({ 
          success: false, 
          error: `No student found with roll number ${rollNumber} in ${className}` 
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either rollNumber or studentId must be provided'
      });
    }

    const studentUserId = student.userId as any;
    const studentName = studentUserId?.name || 'Unknown Student';
    const studentEmail = studentUserId?.email || '';
    const studentUserIdStr = String(studentUserId?._id || student.userId);

    // Check if answer sheet already exists for this student
    const existingSheet = await AnswerSheet.findOne({
      examId: exam._id,
      studentId: student.userId,
      isActive: true
    });

    if (existingSheet && String(existingSheet._id) !== answerSheetId) {
      return res.status(400).json({ 
        success: false, 
        error: `Answer sheet already exists for student ${studentName} (Roll: ${student.rollNumber})` 
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
          id: studentUserIdStr,
          name: studentName,
          rollNumber: student.rollNumber,
          email: studentEmail
        },
        confidence: 1.0,
        processingTime: 0
      };
    }
    
    await answerSheet.save();

    logger.info(`Answer sheet ${answerSheetId} matched to student ${studentName} (${student.rollNumber})`);

    res.json({
      success: true,
      data: {
        answerSheetId: String(answerSheet._id),
        matchedStudent: {
          id: studentUserIdStr,
          name: studentName,
          rollNumber: student.rollNumber,
          email: studentEmail
        },
        rollNumber: student.rollNumber,
        confidence: 100
      }
    });

  } catch (error: unknown) {
    logger.error('Error in match answer sheet to student:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"
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
      studentId: sheet.studentId ? (() => {
        const studentId = sheet.studentId as any;
        return {
          _id: studentId._id || studentId,
          name: studentId?.name || 'Unknown',
          email: studentId?.email || ''
        };
      })() : null,
      uploadedBy: sheet.uploadedBy ? (() => {
        const uploadedBy = sheet.uploadedBy as any;
        return {
          _id: uploadedBy._id || uploadedBy,
          name: uploadedBy?.name || 'Unknown'
        };
      })() : null,
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

  } catch (error: unknown) {
    logger.error('Error in get answer sheets with AI results:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"
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
        const rollNumber = sheet.rollNumberDetected;
        if (!rollNumber) {
          continue;
        }
        if (!examId) {
          continue;
        }
        const matchingResult = await aiDetectionService.matchStudentToRollNumber(
          rollNumber,
          examId,
          (sheet.rollNumberConfidence || 0) / 100
        );

        if (matchingResult.matchedStudent && matchingResult.confidence > 0.7) {
          // Update answer sheet
          const mongoose = await import('mongoose');
          sheet.studentId = new mongoose.Types.ObjectId(matchingResult.matchedStudent.id) as any;
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
      } catch (error: unknown) {
        logger.error(`Failed to auto-match answer sheet ${sheet._id}:`, error);
        results.push({
          answerSheetId: sheet._id,
          originalFileName: sheet.originalFileName,
          error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error",
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

  } catch (error: unknown) {
    logger.error('Error in auto-match unmatched sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"
    });
  }
};

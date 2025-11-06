import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AnswerSheet } from '../models/AnswerSheet.js';
import { Exam } from '../models/Exam.js';
import { Student } from '../models/Student.js';
import { Teacher } from '../models/Teacher.js';
import { User } from '../models/User.js';
import { Class } from '../models/Class.js';
import { AIRollNumberDetectionService } from '../services/aiRollNumberDetection.js';
import logger from '../utils/logger.js';

/**
 * Test script to verify answer sheet upload flow
 * Tests:
 * 1. Roll number detection
 * 2. Student matching
 * 3. Answer sheet status
 * 4. Missing student detection
 */

async function testAnswerSheetFlow() {
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info('✅ Connected to MongoDB');

    // Get a test exam
    const exam = await Exam.findOne().populate('classId');
    if (!exam) {
      logger.error('❌ No exam found. Please create an exam first.');
      process.exit(1);
    }

    logger.info(`\n📝 Testing with Exam: ${exam.title}`);
    logger.info(`   Exam ID: ${exam._id}`);
    logger.info(`   Class: ${(exam.classId as any).name}`);

    // Get students in the exam's class
    const students = await Student.find({
      classId: (exam.classId as any)._id
    }).populate('userId', 'name email');

    logger.info(`\n👥 Found ${students.length} students in class`);

    if (students.length === 0) {
      logger.error('❌ No students found in the class. Please add students first.');
      process.exit(1);
    }

    // Show first 5 students
    logger.info('\n📋 Sample students:');
    students.slice(0, 5).forEach((student, idx) => {
      logger.info(`   ${idx + 1}. Roll: ${student.rollNumber}, Name: ${(student.userId as any)?.name || 'N/A'}`);
    });

    // Test roll number matching
    const aiService = AIRollNumberDetectionService.getInstance();
    const testRollNumbers = students.slice(0, 3).map(s => s.rollNumber);

    logger.info(`\n🔍 Testing roll number matching for: ${testRollNumbers.join(', ')}`);

    for (const rollNumber of testRollNumbers) {
      logger.info(`\n   Testing roll number: "${rollNumber}"`);
      
      try {
        const result = await aiService.matchStudentToRollNumber(
          rollNumber,
          String(exam._id),
          0.9
        );

        if (result.matchedStudent) {
          logger.info(`   ✅ MATCHED: ${result.matchedStudent.name} (Confidence: ${(result.confidence * 100).toFixed(1)}%)`);
          logger.info(`      Student ID: ${result.matchedStudent.id}`);
          logger.info(`      Roll Number: ${result.matchedStudent.rollNumber}`);
        } else {
          logger.error(`   ❌ NOT MATCHED`);
          logger.info(`      Confidence: ${(result.confidence * 100).toFixed(1)}%`);
          if (result.alternatives && result.alternatives.length > 0) {
            logger.info(`      Alternatives:`);
            result.alternatives.slice(0, 3).forEach(alt => {
              logger.info(`         - ${alt.student.name} (Roll: ${alt.student.rollNumber}, Confidence: ${(alt.confidence * 100).toFixed(1)}%)`);
            });
          }
        }
      } catch (error: any) {
        logger.error(`   ❌ ERROR: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Test with different roll number formats
    logger.info(`\n🔍 Testing roll number format variations:`);
    const firstStudent = students[0];
    if (!firstStudent) {
      logger.error('No students found for testing');
      return;
    }
    const testFormats = [
      firstStudent.rollNumber,
      firstStudent.rollNumber.toString().padStart(3, '0'), // Add leading zeros
      firstStudent.rollNumber.toString().trim(),
      firstStudent.rollNumber.toString().replace(/^0+/, ''), // Remove leading zeros
    ];

    for (const format of testFormats) {
      if (format === firstStudent.rollNumber) continue; // Skip exact match
      
      logger.info(`\n   Testing format: "${format}" (Original: "${firstStudent.rollNumber}")`);
      try {
        const result = await aiService.matchStudentToRollNumber(
          format,
          String(exam._id),
          0.9
        );

        if (result.matchedStudent) {
          logger.info(`   ✅ MATCHED: ${result.matchedStudent.name}`);
        } else {
          logger.warn(`   ⚠️  NOT MATCHED with format variation`);
        }
      } catch (error: any) {
        logger.error(`   ❌ ERROR: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Check existing answer sheets
    logger.info(`\n📄 Checking existing answer sheets for this exam:`);
    const answerSheets = await AnswerSheet.find({
      examId: exam._id,
      isActive: true
    }).populate('studentId', 'name').populate('uploadedBy', 'name');

    logger.info(`   Found ${answerSheets.length} answer sheets`);
    
    answerSheets.forEach((sheet, idx) => {
      const studentName = sheet.studentId ? ((sheet.studentId as any)?.name || 'Unknown') : 'Unmatched';
      const rollNumber = sheet.rollNumberDetected || 'N/A';
      logger.info(`   ${idx + 1}. ${sheet.originalFileName} - Student: ${studentName}, Roll: ${rollNumber}, Status: ${sheet.status}`);
    });

    // Check for unmatched sheets
    const unmatchedSheets = answerSheets.filter(s => !s.studentId);
    logger.info(`\n⚠️  Unmatched answer sheets: ${unmatchedSheets.length}`);
    
    if (unmatchedSheets.length > 0) {
      logger.info(`   These sheets have roll numbers but no student match:`);
      unmatchedSheets.forEach((sheet, idx) => {
        logger.info(`   ${idx + 1}. ${sheet.originalFileName}`);
        logger.info(`      Detected Roll: ${sheet.rollNumberDetected || 'N/A'}`);
        logger.info(`      Confidence: ${sheet.rollNumberConfidence || 0}%`);
        logger.info(`      Status: ${sheet.status}`);
        
        // Try to match manually
        if (sheet.rollNumberDetected) {
          logger.info(`      Attempting to match...`);
          aiService.matchStudentToRollNumber(
            sheet.rollNumberDetected,
            String(exam._id),
            (sheet.rollNumberConfidence || 0) / 100
          ).then(result => {
            if (result.matchedStudent) {
              logger.info(`      ✅ Can match to: ${result.matchedStudent.name}`);
            } else {
              logger.warn(`      ❌ Still cannot match`);
            }
          }).catch(err => {
            logger.error(`      ❌ Error: ${err.message}`);
          });
        }
      });
    }

    // Check students without answer sheets
    const submittedStudentIds = answerSheets
      .filter(s => s.studentId)
      .map(s => s.studentId?.toString());
    
    const missingStudents = students.filter(
      s => !submittedStudentIds.includes(s.userId?.toString())
    );

    logger.info(`\n📊 Missing answer sheets: ${missingStudents.length} students`);
    if (missingStudents.length > 0 && missingStudents.length <= 10) {
      logger.info(`   Students without answer sheets:`);
      missingStudents.forEach((student, idx) => {
        logger.info(`   ${idx + 1}. ${(student.userId as any)?.name} (Roll: ${student.rollNumber})`);
      });
    }

    logger.info(`\n✅ Test completed`);
    process.exit(0);

  } catch (error: any) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAnswerSheetFlow();


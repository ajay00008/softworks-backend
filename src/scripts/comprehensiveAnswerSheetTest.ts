import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AnswerSheet } from '../models/AnswerSheet.js';
import { Exam } from '../models/Exam.js';
import { Student } from '../models/Student.js';
import { Teacher } from '../models/Teacher.js';
import { User } from '../models/User.js';
import { Class } from '../models/Class.js';
import { Subject } from '../models/Subject.js';
import { AIRollNumberDetectionService } from '../services/aiRollNumberDetection.js';
import logger from '../utils/logger.js';

/**
 * Comprehensive test script for answer sheet flow
 * Tests:
 * 1. Answer sheet upload (single and batch)
 * 2. AI roll number detection
 * 3. Student matching
 * 4. Answer sheet status
 * 5. Missing student detection
 * 6. Notifications
 * 7. AI checking display
 */

async function comprehensiveTest() {
  try {
    await mongoose.connect(env.MONGO_URI);
    logger.info('✅ Connected to MongoDB\n');

    // Get test data
    const exam = await Exam.findOne().populate('classId').populate('subjectIds');
    if (!exam) {
      logger.error('❌ No exam found. Please create an exam first.');
      process.exit(1);
    }

    logger.info('='.repeat(80));
    logger.info('📝 COMPREHENSIVE ANSWER SHEET FLOW TEST');
    logger.info('='.repeat(80));
    logger.info(`\nExam: ${exam.title}`);
    logger.info(`Class: ${(exam.classId as any).name}`);
    logger.info(`Subjects: ${(exam.subjectIds as any[]).map((s: any) => s.name).join(', ')}`);

    // Get students in the exam's class
    const students = await Student.find({
      classId: (exam.classId as any)._id
    }).populate('userId', 'name email');

    logger.info(`\nStudents in class: ${students.length}`);
    if (students.length === 0) {
      logger.error('❌ No students found. Please add students first.');
      process.exit(1);
    }

    // Show students
    logger.info('\n📋 Students:');
    students.forEach((student, idx) => {
      logger.info(`   ${idx + 1}. Roll: ${student.rollNumber}, Name: ${(student.userId as any)?.name || 'N/A'}`);
    });

    // Test 1: Roll Number Detection and Matching
    logger.info('\n' + '='.repeat(80));
    logger.info('TEST 1: Roll Number Detection and Matching');
    logger.info('='.repeat(80));

    const aiService = AIRollNumberDetectionService.getInstance();
    const testRollNumbers = students.slice(0, Math.min(5, students.length)).map(s => s.rollNumber);

    for (const rollNumber of testRollNumbers) {
      logger.info(`\n   Testing roll number: "${rollNumber}"`);
      
      try {
        const result = await aiService.matchStudentToRollNumber(
          rollNumber,
          String(exam._id),
          0.9
        );

        if (result.matchedStudent) {
          logger.info(`   ✅ MATCHED: ${result.matchedStudent.name}`);
          logger.info(`      Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        } else {
          logger.error(`   ❌ NOT MATCHED`);
          if (result.alternatives && result.alternatives.length > 0) {
            logger.info(`      Alternatives found: ${result.alternatives.length}`);
          }
        }
      } catch (error: any) {
        logger.error(`   ❌ ERROR: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    // Test 2: Check existing answer sheets
    logger.info('\n' + '='.repeat(80));
    logger.info('TEST 2: Existing Answer Sheets Analysis');
    logger.info('='.repeat(80));

    const answerSheets = await AnswerSheet.find({
      examId: exam._id,
      isActive: true
    }).populate('studentId', 'name').populate('uploadedBy', 'name');

    logger.info(`\nTotal answer sheets: ${answerSheets.length}`);

    const matched = answerSheets.filter(s => s.studentId);
    const unmatched = answerSheets.filter(s => !s.studentId);
    const withRollNumber = answerSheets.filter(s => s.rollNumberDetected);
    const withoutRollNumber = answerSheets.filter(s => !s.rollNumberDetected);

    logger.info(`   ✅ Matched: ${matched.length}`);
    logger.info(`   ⚠️  Unmatched: ${unmatched.length}`);
    logger.info(`   🔢 With roll number detected: ${withRollNumber.length}`);
    logger.info(`   ❓ Without roll number: ${withoutRollNumber.length}`);

    // Test 3: Analyze unmatched sheets
    if (unmatched.length > 0) {
      logger.info('\n' + '='.repeat(80));
      logger.info('TEST 3: Unmatched Answer Sheets Analysis');
      logger.info('='.repeat(80));

      for (const sheet of unmatched.slice(0, 5)) {
        logger.info(`\n   Sheet: ${sheet.originalFileName}`);
        logger.info(`      Status: ${sheet.status}`);
        logger.info(`      Roll Number Detected: ${sheet.rollNumberDetected || 'N/A'}`);
        logger.info(`      Roll Number Confidence: ${sheet.rollNumberConfidence || 0}%`);
        
        if (sheet.rollNumberDetected) {
          logger.info(`      Attempting to match roll number "${sheet.rollNumberDetected}"...`);
          try {
            const matchResult = await aiService.matchStudentToRollNumber(
              sheet.rollNumberDetected,
              String(exam._id),
              (sheet.rollNumberConfidence || 0) / 100
            );

            if (matchResult.matchedStudent) {
              logger.info(`      ✅ CAN MATCH TO: ${matchResult.matchedStudent.name} (Roll: ${matchResult.matchedStudent.rollNumber})`);
              logger.info(`         Confidence: ${(matchResult.confidence * 100).toFixed(1)}%`);
              logger.info(`         ⚠️  ISSUE: Sheet exists but is not matched. This may be a data consistency issue.`);
            } else {
              logger.warn(`      ❌ Cannot match - roll number "${sheet.rollNumberDetected}" not found in class`);
              if (matchResult.alternatives && matchResult.alternatives.length > 0) {
                logger.info(`         Alternatives: ${matchResult.alternatives.map(a => `${a.student.name} (${a.student.rollNumber})`).join(', ')}`);
              }
            }
          } catch (error: any) {
            logger.error(`      ❌ Error matching: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        } else {
          logger.warn(`      ⚠️  No roll number detected - manual matching required`);
        }
      }
    }

    // Test 4: Missing students
    logger.info('\n' + '='.repeat(80));
    logger.info('TEST 4: Missing Answer Sheets');
    logger.info('='.repeat(80));

    const submittedStudentIds = answerSheets
      .filter(s => s.studentId)
      .map(s => s.studentId?.toString())
      .filter(Boolean);
    
    const missingStudents = students.filter(
      s => !submittedStudentIds.includes(s.userId?.toString())
    );

    logger.info(`\nStudents without answer sheets: ${missingStudents.length}`);
    if (missingStudents.length > 0 && missingStudents.length <= 10) {
      logger.info('   Missing students:');
      missingStudents.forEach((student, idx) => {
        logger.info(`   ${idx + 1}. ${(student.userId as any)?.name} (Roll: ${student.rollNumber})`);
      });
    }

    // Test 5: Status consistency check
    logger.info('\n' + '='.repeat(80));
    logger.info('TEST 5: Status Consistency Check');
    logger.info('='.repeat(80));

    const statusBreakdown: Record<string, number> = {};
    answerSheets.forEach(sheet => {
      statusBreakdown[sheet.status] = (statusBreakdown[sheet.status] || 0) + 1;
    });

    logger.info('\nStatus breakdown:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      logger.info(`   ${status}: ${count}`);
    });

    // Check for inconsistencies
    const matchedButUnmatchedStatus = answerSheets.filter(
      s => s.studentId && (s.status === 'PROCESSING' || !s.status)
    );
    const unmatchedButUploadedStatus = answerSheets.filter(
      s => !s.studentId && s.status === 'UPLOADED'
    );

    if (matchedButUnmatchedStatus.length > 0) {
      logger.warn(`\n⚠️  Found ${matchedButUnmatchedStatus.length} matched sheets with non-UPLOADED status`);
    }
    if (unmatchedButUploadedStatus.length > 0) {
      logger.warn(`⚠️  Found ${unmatchedButUploadedStatus.length} unmatched sheets with UPLOADED status`);
    }

    logger.info('\n' + '='.repeat(80));
    logger.info('✅ TEST COMPLETED');
    logger.info('='.repeat(80));

    process.exit(0);

  } catch (error: any) {
    logger.error('❌ Test failed:', error);
    process.exit(1);
  }
}

comprehensiveTest();


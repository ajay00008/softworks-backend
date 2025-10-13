import mongoose from 'mongoose';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { User } from '../models/User';
import { Class } from '../models/Class';
import { Subject } from '../models/Subject';
import { env } from '../config/env.js';
import { logger } from '../utils/logger';
async function clearAndCreateTestAnswerSheets() {
    try {
        // Connect to MongoDB
        await mongoose.connect(env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        // Delete all existing answer sheets
        console.log('🗑️  Deleting all existing answer sheets...');
        const deleteResult = await AnswerSheet.deleteMany({});
        console.log(`✅ Deleted ${deleteResult.deletedCount} answer sheets`);
        // Find or create test data
        console.log('🔍 Finding test data...');
        // Find a class
        let testClass = await Class.findOne({});
        if (!testClass) {
            console.log('📝 Creating test class...');
            testClass = await Class.create({
                name: 'Test Class',
                displayName: 'Test Class',
                level: 10,
                section: 'A',
                isActive: true
            });
        }
        console.log(`✅ Found/Created class: ${testClass.name}`);
        // Find a subject
        let testSubject = await Subject.findOne({});
        if (!testSubject) {
            console.log('📝 Creating test subject...');
            testSubject = await Subject.create({
                name: 'Mathematics',
                code: 'MATH',
                shortName: 'Math',
                level: [10],
                isActive: true
            });
        }
        console.log(`✅ Found/Created subject: ${testSubject.name}`);
        // Find a teacher
        let testTeacher = await User.findOne({ role: 'TEACHER' });
        if (!testTeacher) {
            console.log('📝 Creating test teacher...');
            testTeacher = await User.create({
                name: 'Test Teacher',
                email: 'teacher@test.com',
                password: 'password123',
                role: 'TEACHER',
                isActive: true
            });
        }
        console.log(`✅ Found/Created teacher: ${testTeacher.name}`);
        // Find a student
        let testStudent = await User.findOne({ role: 'STUDENT' });
        if (!testStudent) {
            console.log('📝 Creating test student...');
            testStudent = await User.create({
                name: 'Test Student',
                email: 'student@test.com',
                password: 'password123',
                role: 'STUDENT',
                rollNumber: 'TS001',
                isActive: true
            });
        }
        console.log(`✅ Found/Created student: ${testStudent.name}`);
        // Find or create an exam
        let testExam = await Exam.findOne({});
        if (!testExam) {
            console.log('📝 Creating test exam...');
            testExam = await Exam.create({
                title: 'Test Mathematics Exam',
                description: 'Test exam for AI checking',
                subjectId: testSubject._id,
                classId: testClass._id,
                examType: 'UNIT_TEST',
                scheduledDate: new Date(),
                duration: 120,
                totalMarks: 100,
                status: 'COMPLETED',
                createdBy: testTeacher._id,
                isActive: true
            });
        }
        console.log(`✅ Found/Created exam: ${testExam.title}`);
        // Create test answer sheets with different statuses
        console.log('📝 Creating test answer sheets...');
        const testAnswerSheets = [
            {
                examId: testExam._id,
                studentId: testStudent._id,
                uploadedBy: testTeacher._id,
                originalFileName: 'test-answer-sheet-1.pdf',
                cloudStorageUrl: 'https://example.com/test-answer-sheet-1.pdf',
                cloudStorageKey: 'test-answer-sheet-1.pdf',
                status: 'UPLOADED',
                scanQuality: 'GOOD',
                isAligned: true,
                rollNumberDetected: 'TS001',
                rollNumberConfidence: 95,
                language: 'ENGLISH',
                isActive: true
            },
            {
                examId: testExam._id,
                studentId: testStudent._id,
                uploadedBy: testTeacher._id,
                originalFileName: 'test-answer-sheet-2.pdf',
                cloudStorageUrl: 'https://example.com/test-answer-sheet-2.pdf',
                cloudStorageKey: 'test-answer-sheet-2.pdf',
                status: 'PROCESSING',
                scanQuality: 'EXCELLENT',
                isAligned: true,
                rollNumberDetected: 'TS001',
                rollNumberConfidence: 98,
                language: 'ENGLISH',
                isActive: true
            },
            {
                examId: testExam._id,
                studentId: testStudent._id,
                uploadedBy: testTeacher._id,
                originalFileName: 'test-answer-sheet-3.pdf',
                cloudStorageUrl: 'https://example.com/test-answer-sheet-3.pdf',
                cloudStorageKey: 'test-answer-sheet-3.pdf',
                status: 'AI_CORRECTED',
                scanQuality: 'GOOD',
                isAligned: true,
                rollNumberDetected: 'TS001',
                rollNumberConfidence: 92,
                language: 'ENGLISH',
                isActive: true,
                aiCorrectionResults: {
                    answerSheetId: 'test-sheet-3',
                    status: 'COMPLETED',
                    confidence: 0.92,
                    totalMarks: 100,
                    obtainedMarks: 85,
                    percentage: 85,
                    questionWiseResults: [
                        {
                            questionNumber: 1,
                            correctAnswer: '42',
                            studentAnswer: '42',
                            isCorrect: true,
                            marksObtained: 10,
                            maxMarks: 10,
                            feedback: 'Correct answer!',
                            confidence: 0.95
                        },
                        {
                            questionNumber: 2,
                            correctAnswer: 'x = 5',
                            studentAnswer: 'x = 4',
                            isCorrect: false,
                            marksObtained: 5,
                            maxMarks: 10,
                            feedback: 'Close but incorrect. Check your calculation.',
                            confidence: 0.88
                        }
                    ],
                    overallFeedback: 'Good work! You showed strong understanding of basic concepts. Focus on double-checking calculations.',
                    strengths: ['Good problem-solving approach', 'Clear handwriting'],
                    weaknesses: ['Calculation errors', 'Need to verify answers'],
                    suggestions: ['Double-check calculations', 'Show all working steps'],
                    processingTime: 2500
                },
                confidence: 0.92
            }
        ];
        const createdSheets = await AnswerSheet.insertMany(testAnswerSheets);
        console.log(`✅ Created ${createdSheets.length} test answer sheets`);
        // Display summary
        console.log('\n📊 Test Data Summary:');
        console.log(`   Class: ${testClass.name} (${testClass.level}${testClass.section})`);
        console.log(`   Subject: ${testSubject.name}`);
        console.log(`   Teacher: ${testTeacher.name}`);
        console.log(`   Student: ${testStudent.name} (${testStudent.rollNumber})`);
        console.log(`   Exam: ${testExam.title}`);
        console.log(`   Answer Sheets: ${createdSheets.length}`);
        console.log('\n📋 Answer Sheet Statuses:');
        createdSheets.forEach((sheet, index) => {
            console.log(`   ${index + 1}. ${sheet.originalFileName} - ${sheet.status}`);
        });
        console.log('\n🎉 Test data created successfully!');
        console.log('You can now test the AI Answer Checking functionality.');
    }
    catch (error) {
        console.error('❌ Error:', error);
        logger.error('Error in clearAndCreateTestAnswerSheets:', error);
    }
    finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}
// Run the script
clearAndCreateTestAnswerSheets();
//# sourceMappingURL=clearAndCreateTestAnswerSheets.js.map
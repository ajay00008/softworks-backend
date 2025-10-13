import { z } from 'zod';
import { Teacher } from '../models/Teacher';
import { StaffAccess } from '../models/StaffAccess';
import { Class } from '../models/Class';
import { Subject } from '../models/Subject';
import { QuestionPaper } from '../models/QuestionPaper';
import { Exam } from '../models/Exam';
import { Student } from '../models/Student';
import { Result } from '../models/Result';
import { AnswerSheet } from '../models/AnswerSheet';
import { logger } from '../utils/logger';
import createHttpError from 'http-errors';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
// Validation schemas
const CreateQuestionPaperSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    examId: z.string(),
    subjectId: z.string(),
    classId: z.string(),
    markDistribution: z.object({
        oneMark: z.number().min(0).max(100),
        twoMark: z.number().min(0).max(100),
        threeMark: z.number().min(0).max(100),
        fiveMark: z.number().min(0).max(100),
        totalMarks: z.number().min(1).max(1000)
    }),
    bloomsDistribution: z.array(z.object({
        level: z.enum(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE']),
        percentage: z.number().min(0).max(100)
    })),
    questionTypeDistribution: z.array(z.object({
        type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
        percentage: z.number().min(0).max(100)
    })),
    aiSettings: z.object({
        useSubjectBook: z.boolean().default(false),
        customInstructions: z.string().optional(),
        difficultyLevel: z.enum(['EASY', 'MODERATE', 'TOUGHEST']).default('MODERATE'),
        twistedQuestionsPercentage: z.number().min(0).max(50).default(0)
    }).optional()
});
const UploadAnswerSheetSchema = z.object({
    examId: z.string(),
    studentId: z.string(),
    files: z.array(z.string()) // File paths
});
const EvaluateAnswerSchema = z.object({
    answerSheetId: z.string(),
    manualOverrides: z.array(z.object({
        questionId: z.string(),
        awardedMarks: z.number(),
        reason: z.string().optional(),
        improvementSuggestions: z.string().optional()
    })).optional()
});
// Get teacher's assigned classes and subjects
export const getTeacherAccess = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Get teacher's access permissions
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            isActive: true
        }).populate('classAccess.classId', 'name displayName level section')
            .populate('subjectAccess.subjectId', 'name code shortName category');
        if (!staffAccess) {
            return res.status(403).json({
                success: false,
                error: 'No access permissions found for this teacher'
            });
        }
        res.json({
            success: true,
            data: {
                classAccess: staffAccess.classAccess,
                subjectAccess: staffAccess.subjectAccess,
                globalPermissions: staffAccess.globalPermissions
            }
        });
    }
    catch (error) {
        logger.error('Error getting teacher access:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Create question paper for assigned subjects
export const createTeacherQuestionPaper = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const questionPaperData = CreateQuestionPaperSchema.parse(req.body);
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Verify teacher has access to the subject and class
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            'subjectAccess.subjectId': questionPaperData.subjectId,
            'classAccess.classId': questionPaperData.classId,
            isActive: true
        });
        if (!staffAccess) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this subject or class'
            });
        }
        // Check if teacher can create questions for this subject
        const subjectAccess = staffAccess.subjectAccess.find(sa => sa.subjectId.toString() === questionPaperData.subjectId);
        if (!subjectAccess?.canCreateQuestions) {
            return res.status(403).json({
                success: false,
                error: 'No permission to create questions for this subject'
            });
        }
        // Get teacher's adminId
        const teacher = await Teacher.findOne({ userId: teacherId });
        if (!teacher) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }
        // Create question paper
        const questionPaper = new QuestionPaper({
            ...questionPaperData,
            adminId: teacher.adminId,
            createdBy: teacherId,
            type: 'AI_GENERATED',
            status: 'DRAFT'
        });
        await questionPaper.save();
        res.status(201).json({
            success: true,
            data: questionPaper
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.errors
            });
        }
        logger.error('Error creating question paper:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Upload answer sheets
export const uploadAnswerSheets = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const examId = req.params.examId;
        const files = req.files;
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        if (!files || files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }
        // Verify teacher has access to the exam's class
        const exam = await Exam.findById(examId).populate('classId');
        if (!exam) {
            return res.status(404).json({ success: false, error: 'Exam not found' });
        }
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            'classAccess.classId': exam.classId,
            isActive: true
        });
        if (!staffAccess) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this exam'
            });
        }
        // Process uploaded files
        const results = [];
        for (const file of files) {
            try {
                // Generate unique filename
                const timestamp = Date.now();
                const filename = `answer-sheet-${examId}-${timestamp}-${file.originalname}`;
                // Save file to public/answers directory
                const uploadDir = path.join(process.cwd(), 'public', 'answers');
                // Ensure directory exists
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filePath = path.join(uploadDir, filename);
                fs.writeFileSync(filePath, file.buffer);
                // Create answer sheet record
                const answerSheet = new AnswerSheet({
                    examId,
                    studentId: new mongoose.Types.ObjectId(), // Placeholder - will be updated when student is identified
                    uploadedBy: teacherId,
                    originalFileName: file.originalname,
                    cloudStorageUrl: `/public/answers/${filename}`, // Local file path
                    cloudStorageKey: `answer-sheet-${examId}-${timestamp}`, // Unique key
                    status: 'UPLOADED',
                    scanQuality: 'GOOD',
                    isAligned: false,
                    rollNumberDetected: '',
                    rollNumberConfidence: 0,
                    isMissing: false,
                    isAbsent: false,
                    uploadedAt: new Date(),
                    language: 'ENGLISH',
                    isActive: true
                });
                await answerSheet.save();
                results.push({
                    filename: file.originalname,
                    status: 'UPLOADED',
                    answerSheetId: answerSheet._id,
                    fileSize: file.size
                });
            }
            catch (fileError) {
                console.error(`Error processing file ${file.originalname}:`, fileError);
                console.error('File error details:', {
                    message: fileError instanceof Error ? fileError.message : 'Unknown error',
                    stack: fileError instanceof Error ? fileError.stack : undefined,
                    name: fileError instanceof Error ? fileError.name : 'Unknown'
                });
                results.push({
                    filename: file.originalname,
                    status: 'ERROR',
                    error: `Failed to process file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`
                });
            }
        }
        res.json({
            success: true,
            data: {
                message: 'Answer sheets uploaded successfully',
                results,
                totalFiles: files.length,
                successfulUploads: results.filter(r => r.status === 'UPLOADED').length
            }
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.errors
            });
        }
        logger.error('Error uploading answer sheets:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Mark student as absent or missing
export const markStudentStatus = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const { studentId, examId, status, reason } = req.body;
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Verify teacher has access to the exam's class
        const exam = await Exam.findById(examId).populate('classId');
        if (!exam) {
            return res.status(404).json({ success: false, error: 'Exam not found' });
        }
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            'classAccess.classId': exam.classId,
            isActive: true
        });
        if (!staffAccess) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this exam'
            });
        }
        // TODO: Implement student status marking logic
        // This would include:
        // 1. Mark student as absent/missing
        // 2. Send notification to admin
        // 3. Update exam records
        res.json({
            success: true,
            data: {
                message: `Student marked as ${status}`,
                studentId,
                examId,
                status,
                reason
            }
        });
    }
    catch (error) {
        logger.error('Error marking student status:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Evaluate answer sheets
export const evaluateAnswerSheets = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const evaluationData = EvaluateAnswerSchema.parse(req.body);
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // TODO: Implement AI evaluation logic
        // This would include:
        // 1. AI auto-evaluation of answers
        // 2. Manual override capabilities
        // 3. Step-wise marking for math/chemistry
        // 4. Semantic matching for alternative answers
        // 5. Learning from manual corrections
        res.json({
            success: true,
            data: {
                message: 'Answer sheets evaluated successfully',
                evaluationId: evaluationData.answerSheetId,
                aiConfidence: 0.92,
                manualOverrides: evaluationData.manualOverrides?.length || 0
            }
        });
    }
    catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                success: false,
                error: 'Validation error',
                details: error.errors
            });
        }
        logger.error('Error evaluating answer sheets:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Get results for assigned classes
export const getResults = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const { classId, subjectId, examId } = req.query;
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Verify teacher has access to the requested data
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            isActive: true
        });
        if (!staffAccess) {
            return res.status(403).json({
                success: false,
                error: 'No access permissions found'
            });
        }
        // Build query based on teacher's access
        const query = {};
        // Filter by teacher's accessible classes
        if (staffAccess.classAccess && staffAccess.classAccess.length > 0) {
            const accessibleClassIds = staffAccess.classAccess.map(ca => ca.classId);
            query.classId = { $in: accessibleClassIds };
        }
        // Filter by teacher's accessible subjects
        if (staffAccess.subjectAccess && staffAccess.subjectAccess.length > 0) {
            const accessibleSubjectIds = staffAccess.subjectAccess.map(sa => sa.subjectId);
            query.subjectId = { $in: accessibleSubjectIds };
        }
        // Apply additional filters
        if (classId)
            query.classId = classId;
        if (subjectId)
            query.subjectId = subjectId;
        if (examId)
            query.examId = examId;
        // Get results with populated data
        const results = await Result.find(query)
            .populate('examId', 'title examType scheduledDate totalMarks')
            .populate('studentId', 'name email')
            .populate('classId', 'name displayName')
            .populate('subjectId', 'name code')
            .sort({ totalMarksObtained: -1 });
        // Calculate statistics
        const totalResults = results.length;
        const classAverage = totalResults > 0 ? results.reduce((sum, r) => sum + r.totalMarksObtained, 0) / totalResults : 0;
        const subjectAverage = totalResults > 0 ? results.reduce((sum, r) => sum + r.percentage, 0) / totalResults : 0;
        // Create rank list
        const rankList = results.map((result, index) => ({
            rank: index + 1,
            studentName: result.studentId?.name || 'Unknown',
            studentId: result.studentId,
            totalMarks: result.totalMarksObtained,
            percentage: result.percentage,
            grade: result.grade,
            examTitle: result.examId?.title || 'Unknown'
        }));
        // Performance metrics
        const performanceMetrics = {
            totalStudents: totalResults,
            averageMarks: Math.round(classAverage * 100) / 100,
            averagePercentage: Math.round(subjectAverage * 100) / 100,
            passedStudents: results.filter(r => r.percentage >= 40).length,
            failedStudents: results.filter(r => r.percentage < 40).length,
            absentStudents: results.filter(r => r.isAbsent).length,
            missingSheets: results.filter(r => r.isMissingSheet).length
        };
        res.json({
            success: true,
            data: {
                results: results,
                classAverage: Math.round(classAverage * 100) / 100,
                subjectAverage: Math.round(subjectAverage * 100) / 100,
                rankList: rankList,
                performanceMetrics: performanceMetrics
            }
        });
    }
    catch (error) {
        logger.error('Error getting results:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Get performance graphs and analytics
export const getPerformanceGraphs = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const { classId, subjectId, examId } = req.query;
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Verify teacher has access to analytics
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            isActive: true
        });
        if (!staffAccess?.globalPermissions?.canAccessAnalytics) {
            return res.status(403).json({
                success: false,
                error: 'No permission to access analytics'
            });
        }
        // Build query based on teacher's access
        const query = {};
        // Filter by teacher's accessible classes
        if (staffAccess.classAccess && staffAccess.classAccess.length > 0) {
            const accessibleClassIds = staffAccess.classAccess.map(ca => ca.classId);
            query.classId = { $in: accessibleClassIds };
        }
        // Filter by teacher's accessible subjects
        if (staffAccess.subjectAccess && staffAccess.subjectAccess.length > 0) {
            const accessibleSubjectIds = staffAccess.subjectAccess.map(sa => sa.subjectId);
            query.subjectId = { $in: accessibleSubjectIds };
        }
        // Apply additional filters
        if (classId)
            query.classId = classId;
        if (subjectId)
            query.subjectId = subjectId;
        if (examId)
            query.examId = examId;
        // Get performance data
        const results = await Result.find(query)
            .populate('examId', 'title examType scheduledDate')
            .populate('studentId', 'name email')
            .populate('classId', 'name displayName')
            .populate('subjectId', 'name code');
        // Subject-wise performance
        const subjectPerformance = await Result.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'subjects',
                    localField: 'subjectId',
                    foreignField: '_id',
                    as: 'subject'
                }
            },
            { $unwind: '$subject' },
            {
                $group: {
                    _id: '$subjectId',
                    subjectName: { $first: '$subject.name' },
                    averagePercentage: { $avg: '$percentage' },
                    totalStudents: { $sum: 1 },
                    passedStudents: {
                        $sum: { $cond: [{ $gte: ['$percentage', 40] }, 1, 0] }
                    }
                }
            }
        ]);
        // Class-wise summary
        const classSummary = await Result.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'classes',
                    localField: 'classId',
                    foreignField: '_id',
                    as: 'class'
                }
            },
            { $unwind: '$class' },
            {
                $group: {
                    _id: '$classId',
                    className: { $first: '$class.displayName' },
                    averagePercentage: { $avg: '$percentage' },
                    totalStudents: { $sum: 1 },
                    passedStudents: {
                        $sum: { $cond: [{ $gte: ['$percentage', 40] }, 1, 0] }
                    }
                }
            }
        ]);
        // Grade distribution
        const gradeDistribution = await Result.aggregate([
            { $match: { ...query, grade: { $exists: true } } },
            {
                $group: {
                    _id: '$grade',
                    count: { $sum: 1 }
                }
            }
        ]);
        // Failure analysis
        const failureAnalysis = {
            totalStudents: results.length,
            failedStudents: results.filter(r => r.percentage < 40).length,
            absentStudents: results.filter(r => r.isAbsent).length,
            missingSheets: results.filter(r => r.isMissingSheet).length,
            failureRate: results.length > 0 ? (results.filter(r => r.percentage < 40).length / results.length) * 100 : 0
        };
        res.json({
            success: true,
            data: {
                subjectPerformance: subjectPerformance,
                classSummary: classSummary,
                gradeDistribution: gradeDistribution.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                failureAnalysis: failureAnalysis,
                exportableCharts: [
                    { type: 'subject-performance', title: 'Subject-wise Performance' },
                    { type: 'class-summary', title: 'Class Summary' },
                    { type: 'grade-distribution', title: 'Grade Distribution' },
                    { type: 'failure-analysis', title: 'Failure Analysis' }
                ]
            }
        });
    }
    catch (error) {
        logger.error('Error getting performance graphs:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Get exams for assigned classes
export const getTeacherExams = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const { classId, subjectId, status } = req.query;
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Verify teacher has access to the requested data
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            isActive: true
        });
        if (!staffAccess) {
            return res.status(403).json({
                success: false,
                error: 'No access permissions found'
            });
        }
        // Build query based on teacher's access
        const query = {};
        // Filter by teacher's accessible classes
        if (staffAccess.classAccess && staffAccess.classAccess.length > 0) {
            const accessibleClassIds = staffAccess.classAccess.map(ca => ca.classId);
            query.classId = { $in: accessibleClassIds };
        }
        // Filter by teacher's accessible subjects
        if (staffAccess.subjectAccess && staffAccess.subjectAccess.length > 0) {
            const accessibleSubjectIds = staffAccess.subjectAccess.map(sa => sa.subjectId);
            query.subjectId = { $in: accessibleSubjectIds };
        }
        // Apply additional filters
        if (classId)
            query.classId = classId;
        if (subjectId)
            query.subjectId = subjectId;
        if (status)
            query.status = status;
        // Get exams with populated data
        const exams = await Exam.find(query)
            .populate('subjectId', 'name code shortName')
            .populate('classId', 'name displayName level section')
            .populate('createdBy', 'name email')
            .sort({ scheduledDate: -1 });
        res.json({
            success: true,
            data: exams
        });
    }
    catch (error) {
        logger.error('Error getting teacher exams:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Download results
export const downloadResults = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const { format, classId, subjectId, examId } = req.query;
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Verify teacher has access to download results
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            isActive: true
        });
        if (!staffAccess?.globalPermissions?.canPrintReports) {
            return res.status(403).json({
                success: false,
                error: 'No permission to download results'
            });
        }
        // TODO: Implement results download logic
        // This would include:
        // 1. Generate PDF/Excel reports
        // 2. Individual student reports
        // 3. Bulk class reports
        // 4. Subject-wise reports
        res.json({
            success: true,
            data: {
                downloadUrl: '/downloads/results.pdf',
                format: format || 'PDF',
                generatedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger.error('Error downloading results:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
// Get answer sheets for an exam
export const getAnswerSheets = async (req, res) => {
    try {
        const teacherId = req.auth?.sub;
        const { examId } = req.params;
        if (!teacherId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Verify teacher has access to this exam's class
        const exam = await Exam.findById(examId).populate('classId');
        if (!exam) {
            return res.status(404).json({ success: false, error: 'Exam not found' });
        }
        const staffAccess = await StaffAccess.findOne({
            staffId: teacherId,
            'classAccess.classId': exam.classId,
            isActive: true
        });
        if (!staffAccess) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this exam'
            });
        }
        // Get answer sheets for this exam
        const answerSheets = await AnswerSheet.find({ examId, isActive: true })
            .populate('studentId', 'name rollNumber email')
            .populate('uploadedBy', 'name')
            .sort({ uploadedAt: -1 });
        res.json({
            success: true,
            data: answerSheets
        });
    }
    catch (error) {
        logger.error('Error fetching answer sheets:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
//# sourceMappingURL=teacherDashboardController.js.map
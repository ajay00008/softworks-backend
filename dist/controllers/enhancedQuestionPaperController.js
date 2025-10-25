import { z } from 'zod';
import createHttpError from 'http-errors';
import { QuestionPaper } from '../models/QuestionPaper';
import QuestionPaperTemplate from '../models/QuestionPaperTemplate';
import { Exam } from '../models/Exam';
import { Subject } from '../models/Subject';
import { Class } from '../models/Class';
import { EnhancedAIService } from '../services/enhancedAIService';
import { PDFGenerationService } from '../services/pdfGenerationService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Multer configuration for PDF uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'public', 'question-papers');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `question-paper-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
// Multer configuration for pattern uploads
const patternStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'public', 'question-patterns');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `pattern-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});
const patternUpload = multer({
    storage: patternStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF, PNG, JPG, and JPEG files are allowed'), false);
        }
    }
});
export const uploadQuestionPaperPdf = upload.single('questionPaper');
export const uploadPatternFile = patternUpload.single('patternFile');
// Upload pattern file endpoint
export async function uploadPatternFileEndpoint(req, res, next) {
    try {
        if (!req.file) {
            throw new createHttpError.BadRequest("No pattern file uploaded");
        }
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Return pattern file information
        res.status(200).json({
            success: true,
            message: "Pattern file uploaded successfully",
            data: {
                patternId: req.file.filename,
                fileName: req.file.originalname,
                filePath: req.file.path,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                uploadedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        console.error('Error uploading pattern file:', error);
        next(error);
    }
}
// Helper function to flatten question type distribution for AI service
function flattenQuestionTypeDistribution(questionTypeDistribution) {
    const flattened = [];
    const markCategories = ['oneMark', 'twoMark', 'threeMark', 'fiveMark'];
    for (const mark of markCategories) {
        const distributions = questionTypeDistribution[mark];
        if (distributions && distributions.length > 0) {
            // Calculate the weight for this mark category
            const markWeight = mark === 'oneMark' ? 1 : mark === 'twoMark' ? 2 : mark === 'threeMark' ? 3 : 5;
            // Add each distribution with weighted percentage
            distributions.forEach((dist) => {
                flattened.push({
                    type: dist.type,
                    percentage: dist.percentage * markWeight / 100 // Normalize to overall percentage
                });
            });
        }
    }
    return flattened;
}
// Validation schemas
const CreateQuestionPaperSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    examId: z.string().min(1),
    subjectId: z.union([z.string(), z.object({
            _id: z.string(),
            code: z.string().optional(),
            name: z.string().optional(),
            shortName: z.string().optional()
        })]).optional(),
    classId: z.union([z.string(), z.object({
            _id: z.string(),
            name: z.string().optional(),
            displayName: z.string().optional(),
            level: z.number().optional(),
            section: z.string().optional()
        })]).optional(),
    markDistribution: z.object({
        oneMark: z.number().min(0).max(100),
        twoMark: z.number().min(0).max(100),
        threeMark: z.number().min(0).max(100),
        fiveMark: z.number().min(0).max(100),
        totalMarks: z.number().min(1).max(1000).optional()
    }),
    bloomsDistribution: z.array(z.object({
        level: z.enum(['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE']),
        percentage: z.number().min(0).max(100)
    })),
    questionTypeDistribution: z.object({
        oneMark: z.array(z.object({
            type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
            percentage: z.number().min(0).max(100)
        })).optional(),
        twoMark: z.array(z.object({
            type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
            percentage: z.number().min(0).max(100)
        })).optional(),
        threeMark: z.array(z.object({
            type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
            percentage: z.number().min(0).max(100)
        })).optional(),
        fiveMark: z.array(z.object({
            type: z.enum(['CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER']),
            percentage: z.number().min(0).max(100)
        })).optional()
    }),
    aiSettings: z.object({
        useSubjectBook: z.boolean().default(false),
        customInstructions: z.string().max(1000).optional(),
        difficultyLevel: z.enum(['EASY', 'MODERATE', 'TOUGHEST']).default('MODERATE'),
        twistedQuestionsPercentage: z.number().min(0).max(50).default(0)
    }).optional(),
    patternId: z.string().optional() // Optional pattern file ID
});
const GenerateQuestionPaperSchema = z.object({
    questionPaperId: z.string().min(1)
});
// Create Question Paper
export async function createQuestionPaper(req, res, next) {
    try {
        const questionPaperData = CreateQuestionPaperSchema.parse(req.body);
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Validate exam exists and belongs to admin, and get subject/class IDs from exam
        const exam = await Exam.findOne({
            _id: questionPaperData.examId,
            adminId,
            isActive: true
        }).populate([
            { path: 'subjectIds', select: 'name code classIds' },
            { path: 'classId', select: 'name displayName' }
        ]);
        if (!exam) {
            throw new createHttpError.NotFound("Exam not found or not accessible");
        }
        // Extract subject and class IDs from exam
        if (!exam.subjectIds || exam.subjectIds.length === 0) {
            throw new createHttpError.BadRequest("Exam has no subjects assigned");
        }
        const subjectId = exam.subjectIds[0]?._id?.toString();
        if (!subjectId) {
            throw new createHttpError.BadRequest("Invalid subject data in exam");
        }
        const classId = exam.classId._id.toString();
        // Handle case where frontend sends subjectId and classId as objects
        let finalSubjectId = subjectId;
        let finalClassId = classId;
        if (questionPaperData.subjectId && typeof questionPaperData.subjectId === 'object') {
            finalSubjectId = questionPaperData.subjectId._id;
        }
        else if (questionPaperData.subjectId) {
            finalSubjectId = questionPaperData.subjectId;
        }
        if (questionPaperData.classId && typeof questionPaperData.classId === 'object') {
            finalClassId = questionPaperData.classId._id;
        }
        else if (questionPaperData.classId) {
            finalClassId = questionPaperData.classId;
        }
        // Validate that subject is available for this class
        if (!exam.subjectIds[0].classIds.includes(finalClassId)) {
            throw new createHttpError.BadRequest("Subject is not available for this class");
        }
        // Validate percentages add up to 100
        const bloomsTotal = questionPaperData.bloomsDistribution.reduce((sum, dist) => sum + dist.percentage, 0);
        if (Math.abs(bloomsTotal - 100) > 0.01) {
            throw new createHttpError.BadRequest("Blooms taxonomy percentages must add up to 100%");
        }
        // Validate question type distributions for each mark category
        const markCategories = ['oneMark', 'twoMark', 'threeMark', 'fiveMark'];
        for (const mark of markCategories) {
            const distributions = questionPaperData.questionTypeDistribution[mark];
            if (distributions && distributions.length > 0) {
                const typeTotal = distributions.reduce((sum, dist) => sum + dist.percentage, 0);
                if (Math.abs(typeTotal - 100) > 0.01) {
                    throw new createHttpError.BadRequest(`Question type percentages for ${mark.replace('Mark', ' Mark')} must add up to 100%. Current total: ${typeTotal}%`);
                }
            }
        }
        // Create question paper with derived subject and class IDs
        const questionPaper = await QuestionPaper.create({
            ...questionPaperData,
            subjectId: finalSubjectId,
            classId: finalClassId,
            adminId,
            createdBy: auth.sub,
            type: 'AI_GENERATED',
            status: 'DRAFT'
        });
        // Populate references
        await questionPaper.populate([
            { path: 'examId', select: 'title examType scheduledDate' },
            { path: 'subjectId', select: 'name code' },
            { path: 'classId', select: 'name displayName' }
        ]);
        res.status(201).json({
            success: true,
            questionPaper
        });
    }
    catch (err) {
        next(err);
    }
}
// Get All Question Papers
export async function getQuestionPapers(req, res, next) {
    try {
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const { page = 1, limit = 10, status, examId, subjectId, classId } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        // Build filter
        const filter = { adminId, isActive: true };
        if (status)
            filter.status = status;
        if (examId)
            filter.examId = examId;
        if (subjectId)
            filter.subjectId = subjectId;
        if (classId)
            filter.classId = classId;
        const questionPapers = await QuestionPaper.find(filter)
            .populate([
            { path: 'examId', select: 'title examType scheduledDate' },
            { path: 'subjectId', select: 'name code' },
            { path: 'classId', select: 'name displayName' },
            { path: 'createdBy', select: 'name email' }
        ])
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));
        const total = await QuestionPaper.countDocuments(filter);
        res.json({
            success: true,
            questionPapers,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Question Paper by ID
export async function getQuestionPaper(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        }).populate([
            { path: 'examId', select: 'title examType scheduledDate duration' },
            { path: 'subjectId', select: 'name code referenceBook' },
            { path: 'classId', select: 'name displayName' },
            { path: 'createdBy', select: 'name email' }
        ]);
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        res.json({
            success: true,
            questionPaper
        });
    }
    catch (err) {
        next(err);
    }
}
// Generate Question Paper with AI
export async function generateAIQuestionPaper(req, res, next) {
    try {
        const { questionPaperId } = GenerateQuestionPaperSchema.parse(req.body);
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Get question paper
        const questionPaper = await QuestionPaper.findOne({
            _id: questionPaperId,
            adminId,
            isActive: true
        }).populate([
            { path: 'examId', select: 'title duration' },
            { path: 'subjectId', select: 'name code referenceBook' },
            { path: 'classId', select: 'name displayName' }
        ]);
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        if (questionPaper.status !== 'DRAFT') {
            throw new createHttpError.BadRequest("Question paper has already been generated");
        }
        // Prepare AI request
        const aiRequest = {
            subjectId: questionPaper.subjectId._id.toString(),
            classId: questionPaper.classId._id.toString(),
            subjectName: questionPaper.subjectId.name,
            className: questionPaper.classId.name,
            examTitle: questionPaper.examId.title,
            markDistribution: {
                ...questionPaper.markDistribution,
                totalQuestions: questionPaper.markDistribution.oneMark + questionPaper.markDistribution.twoMark + questionPaper.markDistribution.threeMark + questionPaper.markDistribution.fiveMark
            },
            bloomsDistribution: questionPaper.bloomsDistribution,
            questionTypeDistribution: flattenQuestionTypeDistribution(questionPaper.questionTypeDistribution),
            useSubjectBook: questionPaper.aiSettings?.useSubjectBook || false,
            customInstructions: questionPaper.aiSettings?.customInstructions || '',
            difficultyLevel: questionPaper.aiSettings?.difficultyLevel || 'MODERATE',
            twistedQuestionsPercentage: questionPaper.aiSettings?.twistedQuestionsPercentage || 0,
            language: 'ENGLISH'
        };
        // Generate questions using AI
        const generatedQuestions = await EnhancedAIService.generateQuestionPaper(aiRequest);
        // Save questions to database
        const { Question } = await import('../models/Question');
        const savedQuestions = [];
        for (const aiQuestion of generatedQuestions) {
            const question = new Question({
                questionText: aiQuestion.questionText,
                questionType: aiQuestion.questionType,
                subjectId: questionPaper.subjectId,
                classId: questionPaper.classId,
                adminId: adminId, // Add the required adminId field
                unit: 'AI Generated',
                bloomsTaxonomyLevel: aiQuestion.bloomsLevel,
                difficulty: aiQuestion.difficulty,
                isTwisted: aiQuestion.isTwisted,
                options: aiQuestion.options || [],
                correctAnswer: aiQuestion.correctAnswer,
                explanation: aiQuestion.explanation || '',
                marks: aiQuestion.marks,
                timeLimit: 1, // Set minimum time limit (1 minute)
                createdBy: adminId,
                isActive: true,
                tags: aiQuestion.tags || [],
                language: 'ENGLISH'
            });
            await question.save();
            savedQuestions.push(question);
        }
        // Update question paper with question references
        questionPaper.questions = savedQuestions.map(q => q._id);
        // Debug logging for PDF generation
        console.log('PDF Generation Data:', {
            subjectName: questionPaper.subjectId.name,
            className: questionPaper.classId.name,
            examTitle: questionPaper.examId.title,
            totalMarks: questionPaper.markDistribution.totalMarks,
            duration: questionPaper.examId.duration
        });
        // Generate PDF
        const pdfResult = await PDFGenerationService.generateQuestionPaperPDF(questionPaperId, generatedQuestions, questionPaper.subjectId.name || 'Mathematics', questionPaper.classId.name || 'Class 10', questionPaper.examId.title || 'Question Paper', questionPaper.markDistribution.totalMarks || 100, questionPaper.examId.duration || 180);
        // Update question paper
        questionPaper.status = 'GENERATED';
        questionPaper.generatedAt = new Date();
        questionPaper.generatedPdf = {
            fileName: pdfResult.fileName,
            filePath: pdfResult.filePath,
            fileSize: fs.statSync(pdfResult.filePath).size,
            generatedAt: new Date(),
            downloadUrl: pdfResult.downloadUrl
        };
        await questionPaper.save();
        res.json({
            success: true,
            message: "Question paper generated successfully",
            questionPaper,
            downloadUrl: pdfResult.downloadUrl
        });
    }
    catch (err) {
        next(err);
    }
}
// Upload PDF Question Paper
export async function uploadPDFQuestionPaper(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        if (!req.file) {
            throw new createHttpError.BadRequest("No PDF file uploaded");
        }
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        if (questionPaper.status !== 'DRAFT') {
            throw new createHttpError.BadRequest("Cannot upload PDF to generated question paper");
        }
        // Update question paper with PDF info
        questionPaper.type = 'PDF_UPLOADED';
        questionPaper.status = 'GENERATED';
        questionPaper.generatedAt = new Date();
        questionPaper.generatedPdf = {
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            generatedAt: new Date(),
            downloadUrl: `/public/question-papers/${req.file.filename}`
        };
        await questionPaper.save();
        res.json({
            success: true,
            message: "Question paper PDF uploaded successfully",
            questionPaper,
            downloadUrl: questionPaper.generatedPdf.downloadUrl
        });
    }
    catch (err) {
        next(err);
    }
}
// Download Question Paper PDF
export async function downloadQuestionPaperPDF(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        if (!questionPaper.generatedPdf) {
            throw new createHttpError.BadRequest("Question paper PDF not generated yet");
        }
        const filePath = questionPaper.generatedPdf.filePath;
        if (!fs.existsSync(filePath)) {
            throw new createHttpError.NotFound("PDF file not found");
        }
        res.download(filePath, questionPaper.generatedPdf.fileName);
    }
    catch (err) {
        next(err);
    }
}
// Update Question Paper
export async function updateQuestionPaper(req, res, next) {
    try {
        const { id } = req.params;
        const updateData = CreateQuestionPaperSchema.partial().parse(req.body);
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        if (questionPaper.status !== 'DRAFT') {
            throw new createHttpError.BadRequest("Cannot update generated question paper");
        }
        // Update question paper
        Object.assign(questionPaper, updateData);
        await questionPaper.save();
        await questionPaper.populate([
            { path: 'examId', select: 'title examType scheduledDate' },
            { path: 'subjectId', select: 'name code' },
            { path: 'classId', select: 'name displayName' }
        ]);
        res.json({
            success: true,
            questionPaper
        });
    }
    catch (err) {
        next(err);
    }
}
// Delete Question Paper
export async function deleteQuestionPaper(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        // Delete associated questions
        if (questionPaper.questions && questionPaper.questions.length > 0) {
            const { Question } = await import('../models/Question');
            await Question.updateMany({ _id: { $in: questionPaper.questions } }, { isActive: false });
        }
        // Delete PDF file if exists
        if (questionPaper.generatedPdf?.fileName) {
            await PDFGenerationService.deleteQuestionPaperPDF(questionPaper.generatedPdf.fileName);
        }
        // Soft delete
        questionPaper.isActive = false;
        await questionPaper.save();
        res.json({
            success: true,
            message: "Question paper deleted successfully"
        });
    }
    catch (err) {
        next(err);
    }
}
// Publish Question Paper
export async function publishQuestionPaper(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        if (questionPaper.status !== 'GENERATED') {
            throw new createHttpError.BadRequest("Question paper must be generated before publishing");
        }
        questionPaper.status = 'PUBLISHED';
        questionPaper.publishedAt = new Date();
        await questionPaper.save();
        res.json({
            success: true,
            message: "Question paper published successfully",
            questionPaper
        });
    }
    catch (err) {
        next(err);
    }
}
// Generate Complete Question Paper with AI (Direct Generation)
export async function generateCompleteAIQuestionPaper(req, res, next) {
    try {
        const questionPaperData = CreateQuestionPaperSchema.parse(req.body);
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Validate exam exists and belongs to admin, and get subject/class IDs from exam
        const exam = await Exam.findOne({
            _id: questionPaperData.examId,
            adminId,
            isActive: true
        }).populate([
            { path: 'subjectIds', select: 'name code classIds' },
            { path: 'classId', select: 'name displayName' }
        ]);
        if (!exam) {
            throw new createHttpError.NotFound("Exam not found or not accessible");
        }
        // Extract subject and class IDs from exam
        if (!exam.subjectIds || exam.subjectIds.length === 0) {
            throw new createHttpError.BadRequest("Exam has no subjects assigned");
        }
        const subjectId = exam.subjectIds[0]?._id?.toString();
        if (!subjectId) {
            throw new createHttpError.BadRequest("Invalid subject data in exam");
        }
        const classId = exam.classId._id.toString();
        // Handle case where frontend sends subjectId and classId as objects
        let finalSubjectId = subjectId;
        let finalClassId = classId;
        if (questionPaperData.subjectId && typeof questionPaperData.subjectId === 'object') {
            finalSubjectId = questionPaperData.subjectId._id;
        }
        else if (questionPaperData.subjectId) {
            finalSubjectId = questionPaperData.subjectId;
        }
        if (questionPaperData.classId && typeof questionPaperData.classId === 'object') {
            finalClassId = questionPaperData.classId._id;
        }
        else if (questionPaperData.classId) {
            finalClassId = questionPaperData.classId;
        }
        // Validate that subject is available for this class
        if (!exam.subjectIds[0].classIds.includes(finalClassId)) {
            throw new createHttpError.BadRequest("Subject is not available for this class");
        }
        // Create question paper with derived subject and class IDs
        const questionPaper = await QuestionPaper.create({
            ...questionPaperData,
            subjectId: finalSubjectId, // Now derived
            classId: finalClassId, // Now derived
            adminId,
            createdBy: auth.sub,
            type: 'AI_GENERATED',
            status: 'DRAFT'
        });
        // Populate the question paper with subject, class, and exam details
        await questionPaper.populate([
            { path: 'subjectId', select: 'name code referenceBook' },
            { path: 'classId', select: 'name displayName' },
            { path: 'examId', select: 'title duration' }
        ]);
        // Get reference book content for AI generation
        let referenceBookContent = '';
        const subject = questionPaper.subjectId;
        if (subject.referenceBook && subject.referenceBook.filePath) {
            try {
                // Read the reference book file content
                const referenceBookPath = subject.referenceBook.filePath;
                if (fs.existsSync(referenceBookPath)) {
                    // For PDF files, we would need a PDF parser, but for now we'll use the file path
                    // In a real implementation, you'd extract text from the PDF
                    referenceBookContent = `Reference book available: ${subject.referenceBook.originalName} (${subject.referenceBook.fileSize} bytes)`;
                    console.log('Reference book found for AI generation:', {
                        fileName: subject.referenceBook.fileName,
                        originalName: subject.referenceBook.originalName,
                        fileSize: subject.referenceBook.fileSize
                    });
                }
            }
            catch (error) {
                console.warn('Could not read reference book content:', error);
            }
        }
        // Get sample papers for the subject
        const { default: SamplePaper } = await import('../models/SamplePaper');
        const samplePapers = await SamplePaper.find({
            subjectId: finalSubjectId,
            isActive: true
        })
            .select('_id title description sampleFile analysis templateSettings version')
            .lean();
        console.log('Sample papers found for AI generation:', samplePapers.length);
        // Handle pattern file if provided
        let patternFilePath = null;
        if (questionPaperData.patternId) {
            // Construct pattern file path from pattern ID
            patternFilePath = path.join(process.cwd(), 'public', 'question-patterns', questionPaperData.patternId);
            // Check if pattern file exists
            if (!fs.existsSync(patternFilePath)) {
                throw new createHttpError.NotFound("Pattern file not found");
            }
        }
        // Prepare AI request with reference book and template data
        const aiRequest = {
            subjectId: finalSubjectId,
            classId: finalClassId,
            subjectName: questionPaper.subjectId.name,
            className: questionPaper.classId.name,
            examTitle: questionPaper.examId.title,
            markDistribution: {
                ...questionPaper.markDistribution,
                totalQuestions: questionPaper.markDistribution.oneMark + questionPaper.markDistribution.twoMark + questionPaper.markDistribution.threeMark + questionPaper.markDistribution.fiveMark
            },
            bloomsDistribution: questionPaper.bloomsDistribution,
            questionTypeDistribution: flattenQuestionTypeDistribution(questionPaper.questionTypeDistribution),
            useSubjectBook: questionPaper.aiSettings?.useSubjectBook || false,
            customInstructions: questionPaper.aiSettings?.customInstructions || '',
            difficultyLevel: questionPaper.aiSettings?.difficultyLevel || 'MODERATE',
            twistedQuestionsPercentage: questionPaper.aiSettings?.twistedQuestionsPercentage || 0,
            referenceBookContent: referenceBookContent,
            samplePapers: samplePapers,
            ...(patternFilePath && { patternFilePath }) // Add pattern file path to AI request only if it exists
        };
        // Generate questions using AI
        const generatedQuestions = await EnhancedAIService.generateQuestionPaper(aiRequest);
        // Save questions to database
        const { Question } = await import('../models/Question');
        const savedQuestions = [];
        for (const aiQuestion of generatedQuestions) {
            const question = new Question({
                questionText: aiQuestion.questionText,
                questionType: aiQuestion.questionType,
                subjectId: questionPaper.subjectId,
                classId: questionPaper.classId,
                adminId: adminId, // Add the required adminId field
                unit: 'AI Generated',
                bloomsTaxonomyLevel: aiQuestion.bloomsLevel,
                difficulty: aiQuestion.difficulty,
                isTwisted: aiQuestion.isTwisted,
                options: aiQuestion.options || [],
                correctAnswer: aiQuestion.correctAnswer,
                explanation: aiQuestion.explanation || '',
                marks: aiQuestion.marks,
                timeLimit: 1, // Set minimum time limit (1 minute)
                createdBy: adminId,
                isActive: true,
                tags: aiQuestion.tags || [],
                language: 'ENGLISH'
            });
            await question.save();
            savedQuestions.push(question);
        }
        // Update question paper with question references
        questionPaper.questions = savedQuestions.map(q => q._id);
        // Debug logging for PDF generation
        console.log('PDF Generation Data (Complete):', {
            subjectName: questionPaper.subjectId.name,
            className: questionPaper.classId.name,
            examTitle: questionPaper.examId.title,
            totalMarks: questionPaper.markDistribution.totalMarks,
            duration: questionPaper.examId.duration
        });
        // Generate PDF
        const pdfResult = await PDFGenerationService.generateQuestionPaperPDF(questionPaper._id.toString(), generatedQuestions, questionPaper.subjectId.name || 'Mathematics', questionPaper.classId.name || 'Class 10', questionPaper.examId.title || 'Question Paper', questionPaper.markDistribution.totalMarks || 100, questionPaper.examId.duration || 180);
        // Update question paper
        questionPaper.status = 'GENERATED';
        questionPaper.generatedAt = new Date();
        questionPaper.generatedPdf = {
            fileName: pdfResult.fileName,
            filePath: pdfResult.filePath,
            fileSize: fs.statSync(pdfResult.filePath).size,
            generatedAt: new Date(),
            downloadUrl: pdfResult.downloadUrl
        };
        await questionPaper.save();
        res.json({
            success: true,
            message: "Question paper generated successfully with AI",
            questionPaper,
            downloadUrl: pdfResult.downloadUrl
        });
    }
    catch (err) {
        next(err);
    }
}
// Get all questions for a question paper
export async function getQuestionPaperQuestions(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Get question paper
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        // Get questions from the question paper's questions array
        const { Question } = await import('../models/Question');
        const questions = await Question.find({
            _id: { $in: questionPaper.questions },
            isActive: true
        }).sort({ createdAt: 1 });
        res.json({
            success: true,
            questions
        });
    }
    catch (err) {
        next(err);
    }
}
// Add a question to a question paper
export async function addQuestionToPaper(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Get question paper
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        }).populate(['subjectId', 'classId']);
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        // Create new question
        const { Question } = await import('../models/Question');
        const question = new Question({
            questionText: req.body.questionText,
            questionType: req.body.questionType,
            subjectId: questionPaper.subjectId,
            classId: questionPaper.classId,
            unit: req.body.unit || 'General',
            bloomsTaxonomyLevel: req.body.bloomsTaxonomyLevel,
            difficulty: req.body.difficulty,
            isTwisted: req.body.isTwisted || false,
            options: req.body.options || [],
            correctAnswer: req.body.correctAnswer,
            explanation: req.body.explanation || '',
            marks: req.body.marks,
            timeLimit: req.body.timeLimit || 0,
            createdBy: adminId,
            isActive: true,
            tags: req.body.tags || [],
            language: req.body.language || 'en'
        });
        await question.save();
        // Add question to question paper
        questionPaper.questions.push(question._id);
        await questionPaper.save();
        res.status(201).json({
            success: true,
            message: "Question added successfully",
            question
        });
    }
    catch (err) {
        next(err);
    }
}
// Update a question in a question paper
export async function updateQuestionInPaper(req, res, next) {
    try {
        const { id, questionId } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Get question paper
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        // Check if question belongs to this question paper
        if (!questionPaper.questions.includes(questionId)) {
            throw new createHttpError.NotFound("Question not found in this question paper");
        }
        // Update question
        const { Question } = await import('../models/Question');
        const question = await Question.findOneAndUpdate({ _id: questionId, isActive: true }, {
            questionText: req.body.questionText,
            questionType: req.body.questionType,
            bloomsTaxonomyLevel: req.body.bloomsTaxonomyLevel,
            difficulty: req.body.difficulty,
            isTwisted: req.body.isTwisted,
            options: req.body.options,
            correctAnswer: req.body.correctAnswer,
            explanation: req.body.explanation,
            marks: req.body.marks,
            timeLimit: req.body.timeLimit,
            tags: req.body.tags,
            language: req.body.language
        }, { new: true, runValidators: true });
        if (!question) {
            throw new createHttpError.NotFound("Question not found");
        }
        res.json({
            success: true,
            message: "Question updated successfully",
            question
        });
    }
    catch (err) {
        next(err);
    }
}
// Delete a question from a question paper
export async function deleteQuestionFromPaper(req, res, next) {
    try {
        const { id, questionId } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Get question paper
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        // Check if question belongs to this question paper
        if (!questionPaper.questions.includes(questionId)) {
            throw new createHttpError.NotFound("Question not found in this question paper");
        }
        // Remove question from question paper
        questionPaper.questions = questionPaper.questions.filter((qId) => qId.toString() !== questionId);
        await questionPaper.save();
        // Soft delete the question
        const { Question } = await import('../models/Question');
        await Question.findOneAndUpdate({ _id: questionId }, { isActive: false });
        res.json({
            success: true,
            message: "Question deleted successfully"
        });
    }
    catch (err) {
        next(err);
    }
}
// Upload new PDF for a question paper
export async function uploadQuestionPaperPDF(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        if (!req.file) {
            throw new createHttpError.BadRequest("No PDF file uploaded");
        }
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        // Delete old PDF if exists
        if (questionPaper.generatedPdf?.fileName) {
            await PDFGenerationService.deleteQuestionPaperPDF(questionPaper.generatedPdf.fileName);
        }
        // Update question paper with new PDF info
        questionPaper.generatedPdf = {
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            generatedAt: new Date(),
            downloadUrl: `/public/question-papers/${req.file.filename}`
        };
        await questionPaper.save();
        res.json({
            success: true,
            message: "PDF uploaded successfully",
            questionPaper
        });
    }
    catch (err) {
        next(err);
    }
}
// Regenerate PDF for a question paper
export async function regenerateQuestionPaperPDF(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Get question paper with questions
        const questionPaper = await QuestionPaper.findOne({
            _id: id,
            adminId,
            isActive: true
        }).populate([
            { path: 'examId', select: 'title duration' },
            { path: 'subjectId', select: 'name code' },
            { path: 'classId', select: 'name displayName' },
            { path: 'questions', populate: { path: 'subjectId classId' } }
        ]);
        if (!questionPaper) {
            throw new createHttpError.NotFound("Question paper not found");
        }
        if (!questionPaper.questions || questionPaper.questions.length === 0) {
            throw new createHttpError.BadRequest("No questions found in question paper");
        }
        // Convert questions to the format expected by PDF generation
        const { Question } = await import('../models/Question');
        const questions = await Question.find({
            _id: { $in: questionPaper.questions },
            isActive: true
        });
        const generatedQuestions = questions.map(q => ({
            questionText: q.questionText,
            questionType: q.questionType,
            marks: q.marks,
            bloomsLevel: q.bloomsTaxonomyLevel,
            difficulty: q.difficulty,
            isTwisted: q.isTwisted,
            options: q.options || [],
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || '',
            tags: q.tags || []
        }));
        // Delete old PDF if exists
        if (questionPaper.generatedPdf?.fileName) {
            try {
                const oldFilePath = path.join(process.cwd(), 'public', 'question-papers', questionPaper.generatedPdf.fileName);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            catch (error) {
                console.warn('Could not delete old PDF file:', error);
            }
        }
        // Debug logging for PDF generation
        console.log('PDF Generation Data (Regenerate):', {
            subjectName: questionPaper.subjectId.name,
            className: questionPaper.classId.name,
            examTitle: questionPaper.examId.title,
            totalMarks: questionPaper.markDistribution.totalMarks,
            duration: questionPaper.examId.duration
        });
        // Generate new PDF
        const pdfResult = await PDFGenerationService.generateQuestionPaperPDF(questionPaper._id.toString(), generatedQuestions, questionPaper.subjectId.name || 'Mathematics', questionPaper.classId.name || 'Class 10', questionPaper.examId.title || 'Question Paper', questionPaper.markDistribution.totalMarks || 100, questionPaper.examId.duration || 180);
        // Update question paper with new PDF info
        questionPaper.generatedPdf = {
            fileName: pdfResult.fileName,
            filePath: pdfResult.filePath,
            fileSize: fs.statSync(pdfResult.filePath).size,
            generatedAt: new Date(),
            downloadUrl: pdfResult.downloadUrl
        };
        await questionPaper.save();
        res.json({
            success: true,
            message: "PDF regenerated successfully",
            questionPaper,
            downloadUrl: pdfResult.downloadUrl
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=enhancedQuestionPaperController.js.map
import * as createHttpError from 'http-errors';
import * as z from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import multer from 'multer';
import QuestionPaperTemplate from '../models/QuestionPaperTemplate';
import { Subject } from '../models/Subject';
import { Class } from '../models/Class';
import { PDFGenerationService } from '../services/pdfGenerationService';
// Validation schemas
const CreateTemplateSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    subjectId: z.string().min(1, 'Subject ID is required'),
    classId: z.string().min(1, 'Class ID is required'),
    language: z.string().default('ENGLISH')
});
const UpdateTemplateSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    aiSettings: z.object({
        useTemplate: z.boolean().optional(),
        followPattern: z.boolean().optional(),
        maintainStructure: z.boolean().optional(),
        customInstructions: z.string().optional()
    }).optional()
});
// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'public', 'question-paper-templates');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `template-${uniqueSuffix}${path.extname(file.originalname)}`);
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
            cb(null, false);
        }
    }
});
export const uploadTemplate = upload.single('templateFile');
// Create Question Paper Template
export async function createTemplate(req, res, next) {
    try {
        const templateData = CreateTemplateSchema.parse(req.body);
        const auth = req.auth;
        const userId = auth?.sub;
        const adminId = auth?.adminId;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        if (!req.file) {
            throw new createHttpError.BadRequest("Template file is required");
        }
        // Validate subject and class exist and belong to the same admin
        const [subject, classExists] = await Promise.all([
            Subject.findOne({ _id: templateData.subjectId, adminId, isActive: true }),
            Class.findOne({ _id: templateData.classId, adminId, isActive: true })
        ]);
        if (!subject)
            throw new createHttpError.NotFound("Subject not found or not accessible");
        if (!classExists)
            throw new createHttpError.NotFound("Class not found or not accessible");
        // Check if template already exists for this subject and class
        const existingTemplate = await QuestionPaperTemplate.findOne({
            subjectId: templateData.subjectId,
            classId: templateData.classId,
            adminId,
            isActive: true
        });
        if (existingTemplate) {
            throw new createHttpError.Conflict("Template already exists for this subject and class");
        }
        // Create download URL
        const downloadUrl = `/public/question-paper-templates/${req.file.filename}`;
        // TODO: Analyze the PDF to extract template information
        // For now, we'll create a basic analysis
        const analysis = {
            totalQuestions: 0,
            questionTypes: [],
            markDistribution: {
                oneMark: 0,
                twoMark: 0,
                threeMark: 0,
                fiveMark: 0,
                totalMarks: 0
            },
            difficultyLevels: [],
            bloomsDistribution: {
                remember: 0,
                understand: 0,
                apply: 0,
                analyze: 0,
                evaluate: 0,
                create: 0
            },
            timeDistribution: {
                totalTime: 0,
                perQuestion: 0
            },
            sections: []
        };
        const template = await QuestionPaperTemplate.create({
            ...templateData,
            adminId,
            uploadedBy: userId,
            templateFile: {
                fileName: req.file.filename,
                filePath: req.file.path,
                fileSize: req.file.size,
                uploadedAt: new Date(),
                downloadUrl: downloadUrl
            },
            analysis: analysis
        });
        const populatedTemplate = await QuestionPaperTemplate.findById(template._id)
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email');
        res.status(201).json({
            success: true,
            template: populatedTemplate
        });
    }
    catch (err) {
        next(err);
    }
}
// Get All Templates
export async function getTemplates(req, res, next) {
    try {
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const { subjectId, classId } = req.query;
        const filter = { adminId, isActive: true };
        if (subjectId)
            filter.subjectId = subjectId;
        if (classId)
            filter.classId = classId;
        const templates = await QuestionPaperTemplate.find(filter)
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json({
            success: true,
            templates
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Template by ID
export async function getTemplateById(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const template = await QuestionPaperTemplate.findOne({
            _id: id,
            adminId,
            isActive: true
        })
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email');
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        res.json({
            success: true,
            template
        });
    }
    catch (err) {
        next(err);
    }
}
// Update Template
export async function updateTemplate(req, res, next) {
    try {
        const { id } = req.params;
        const updateData = UpdateTemplateSchema.parse(req.body);
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const template = await QuestionPaperTemplate.findOneAndUpdate({ _id: id, adminId, isActive: true }, updateData, { new: true })
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email');
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        res.json({
            success: true,
            template
        });
    }
    catch (err) {
        next(err);
    }
}
// Delete Template
export async function deleteTemplate(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const template = await QuestionPaperTemplate.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        // Delete the file
        if (template.templateFile?.filePath) {
            try {
                if (fs.existsSync(template.templateFile.filePath)) {
                    fs.unlinkSync(template.templateFile.filePath);
                }
            }
            catch (error) {
                console.warn('Could not delete template file:', error);
            }
        }
        // Soft delete
        template.isActive = false;
        await template.save();
        res.json({
            success: true,
            message: "Template deleted successfully"
        });
    }
    catch (err) {
        next(err);
    }
}
// Download Template
export async function downloadTemplate(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const template = await QuestionPaperTemplate.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        const filePath = template.templateFile?.filePath;
        if (!filePath || !fs.existsSync(filePath)) {
            throw new createHttpError.NotFound("Template file not found");
        }
        res.download(filePath, template.templateFile.fileName);
    }
    catch (err) {
        next(err);
    }
}
// Analyze Template (extract pattern from PDF)
export async function analyzeTemplate(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const template = await QuestionPaperTemplate.findOne({
            _id: id,
            adminId,
            isActive: true
        });
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        // TODO: Implement PDF analysis to extract:
        // - Question types and distribution
        // - Mark distribution
        // - Difficulty levels
        // - Bloom's taxonomy distribution
        // - Time allocation
        // - Section structure
        // For now, return a placeholder analysis
        const analysis = {
            totalQuestions: 25,
            questionTypes: ['CHOOSE_BEST_ANSWER', 'SHORT_ANSWER', 'LONG_ANSWER'],
            markDistribution: {
                oneMark: 10,
                twoMark: 8,
                threeMark: 5,
                fiveMark: 2,
                totalMarks: 50
            },
            difficultyLevels: ['EASY', 'MODERATE', 'TOUGHEST'],
            bloomsDistribution: {
                remember: 20,
                understand: 30,
                apply: 25,
                analyze: 15,
                evaluate: 7,
                create: 3
            },
            timeDistribution: {
                totalTime: 180,
                perQuestion: 7.2
            },
            sections: [
                { name: 'Section A', questions: 10, marks: 10 },
                { name: 'Section B', questions: 8, marks: 16 },
                { name: 'Section C', questions: 5, marks: 15 },
                { name: 'Section D', questions: 2, marks: 10 }
            ]
        };
        // Update template with analysis
        template.analysis = analysis;
        await template.save();
        res.json({
            success: true,
            analysis
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=questionPaperTemplateController.js.map
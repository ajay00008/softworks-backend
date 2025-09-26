import { z } from "zod";
import createHttpError from "http-errors";
import { QuestionPaperTemplate } from "../models/QuestionPaperTemplate";
import { Question } from "../models/Question";
import { Subject } from "../models/Subject";
import { Class } from "../models/Class";
import AIService from "../services/aiService";
// Schema for creating question paper template
const CreateTemplateSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    subjectId: z.string().min(1),
    classId: z.string().min(1),
    gradeLevel: z.enum(["PRE_KG", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"]),
    totalMarks: z.number().min(1).max(1000),
    examName: z.string().min(1).max(100),
    duration: z.number().min(15).max(480),
    markDistribution: z.array(z.object({
        marks: z.number().min(1).max(100),
        count: z.number().min(0),
        percentage: z.number().min(0).max(100)
    })),
    bloomsDistribution: z.array(z.object({
        level: z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]),
        percentage: z.number().min(0).max(100),
        twistedPercentage: z.number().min(0).max(100).optional()
    })),
    questionTypeDistribution: z.array(z.object({
        type: z.enum(["MULTIPLE_CHOICE", "FILL_BLANKS", "ONE_WORD_ANSWER", "TRUE_FALSE", "MULTIPLE_ANSWERS", "MATCHING_PAIRS", "DRAWING_DIAGRAM", "MARKING_PARTS"]),
        percentage: z.number().min(0).max(100),
        marksPerQuestion: z.number().min(1).max(100)
    })),
    unitSelections: z.array(z.object({
        unitId: z.string(),
        unitName: z.string(),
        pages: z.object({
            startPage: z.number().min(1),
            endPage: z.number().min(1)
        }).optional(),
        topics: z.array(z.string()).optional()
    })),
    twistedQuestionsPercentage: z.number().min(0).max(50).default(0),
    gradeSpecificSettings: z.object({
        ageAppropriate: z.boolean().default(true),
        cognitiveLevel: z.enum(["PRE_SCHOOL", "PRIMARY", "MIDDLE", "SECONDARY", "SENIOR_SECONDARY"]),
        languageComplexity: z.enum(["VERY_SIMPLE", "SIMPLE", "MODERATE", "COMPLEX", "VERY_COMPLEX"]),
        visualAids: z.boolean().default(false),
        interactiveElements: z.boolean().default(false)
    }),
    isPublic: z.boolean().default(false),
    tags: z.array(z.string()).optional()
});
// Schema for generating question paper from template
const GeneratePaperSchema = z.object({
    templateId: z.string().min(1),
    customSettings: z.object({
        totalMarks: z.number().min(1).max(1000).optional(),
        duration: z.number().min(15).max(480).optional(),
        twistedQuestionsPercentage: z.number().min(0).max(50).optional(),
        unitSelections: z.array(z.object({
            unitId: z.string(),
            unitName: z.string(),
            pages: z.object({
                startPage: z.number().min(1),
                endPage: z.number().min(1)
            }).optional(),
            topics: z.array(z.string()).optional()
        })).optional()
    }).optional()
});
// Schema for getting templates with filters
const GetTemplatesQuerySchema = z.object({
    page: z.union([z.string(), z.number()]).transform(val => Number(val)).default(1),
    limit: z.union([z.string(), z.number()]).transform(val => Number(val)).default(10),
    search: z.string().optional(),
    subjectId: z.string().optional(),
    classId: z.string().optional(),
    gradeLevel: z.string().optional(),
    isPublic: z.union([z.string(), z.boolean()]).transform(val => val === 'true' || val === true).optional(),
    createdBy: z.string().optional()
});
// Create question paper template
export async function createTemplate(req, res, next) {
    try {
        const templateData = CreateTemplateSchema.parse(req.body);
        const userId = req.auth?.sub;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        // Validate subject and class exist
        const [subject, classExists] = await Promise.all([
            Subject.findById(templateData.subjectId),
            Class.findById(templateData.classId)
        ]);
        if (!subject)
            throw new createHttpError.NotFound("Subject not found");
        if (!classExists)
            throw new createHttpError.NotFound("Class not found");
        // Check if template name already exists for this user
        const existingTemplate = await QuestionPaperTemplate.findOne({
            name: templateData.name,
            createdBy: userId,
            isActive: true
        });
        if (existingTemplate) {
            throw new createHttpError.Conflict("Template with this name already exists");
        }
        // Validate mark distribution adds up to 100%
        const totalMarkPercentage = templateData.markDistribution.reduce((sum, dist) => sum + dist.percentage, 0);
        if (Math.abs(totalMarkPercentage - 100) > 0.01) {
            throw new createHttpError.BadRequest("Mark distribution percentages must add up to 100%");
        }
        // Validate Bloom's taxonomy distribution adds up to 100%
        const totalBloomsPercentage = templateData.bloomsDistribution.reduce((sum, dist) => sum + dist.percentage, 0);
        if (Math.abs(totalBloomsPercentage - 100) > 0.01) {
            throw new createHttpError.BadRequest("Bloom's taxonomy distribution percentages must add up to 100%");
        }
        // Validate question type distribution adds up to 100%
        const totalTypePercentage = templateData.questionTypeDistribution.reduce((sum, dist) => sum + dist.percentage, 0);
        if (Math.abs(totalTypePercentage - 100) > 0.01) {
            throw new createHttpError.BadRequest("Question type distribution percentages must add up to 100%");
        }
        const template = new QuestionPaperTemplate({
            ...templateData,
            createdBy: userId
        });
        await template.save();
        res.status(201).json({
            success: true,
            message: "Question paper template created successfully",
            data: template
        });
    }
    catch (error) {
        next(error);
    }
}
// Get question paper templates
export async function getTemplates(req, res, next) {
    try {
        const { page, limit, search, subjectId, classId, gradeLevel, isPublic, createdBy } = GetTemplatesQuerySchema.parse(req.query);
        const userId = req.auth?.sub;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        const query = { isActive: true };
        // Add search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { examName: { $regex: search, $options: 'i' } }
            ];
        }
        // Add filters
        if (subjectId)
            query.subjectId = subjectId;
        if (classId)
            query.classId = classId;
        if (gradeLevel)
            query.gradeLevel = gradeLevel;
        if (isPublic !== undefined)
            query.isPublic = isPublic;
        if (createdBy)
            query.createdBy = createdBy;
        // If not searching for public templates, only show user's templates
        if (!isPublic) {
            query.$or = [
                { createdBy: userId },
                { isPublic: true }
            ];
        }
        const skip = (page - 1) * limit;
        const [templates, total] = await Promise.all([
            QuestionPaperTemplate.find(query)
                .populate('subjectId', 'name')
                .populate('classId', 'name level')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            QuestionPaperTemplate.countDocuments(query)
        ]);
        res.json({
            success: true,
            data: {
                templates,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
}
// Get single template
export async function getTemplate(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.auth?.sub;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        const template = await QuestionPaperTemplate.findOne({
            _id: id,
            isActive: true,
            $or: [
                { createdBy: userId },
                { isPublic: true }
            ]
        })
            .populate('subjectId', 'name')
            .populate('classId', 'name level')
            .populate('createdBy', 'name email');
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        res.json({
            success: true,
            data: template
        });
    }
    catch (error) {
        next(error);
    }
}
// Update template
export async function updateTemplate(req, res, next) {
    try {
        const { id } = req.params;
        const updateData = CreateTemplateSchema.partial().parse(req.body);
        const userId = req.auth?.sub;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        const template = await QuestionPaperTemplate.findOne({
            _id: id,
            createdBy: userId,
            isActive: true
        });
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        // Update template
        Object.assign(template, updateData);
        await template.save();
        res.json({
            success: true,
            message: "Template updated successfully",
            data: template
        });
    }
    catch (error) {
        next(error);
    }
}
// Delete template
export async function deleteTemplate(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.auth?.sub;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        const template = await QuestionPaperTemplate.findOne({
            _id: id,
            createdBy: userId,
            isActive: true
        });
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        template.isActive = false;
        await template.save();
        res.json({
            success: true,
            message: "Template deleted successfully"
        });
    }
    catch (error) {
        next(error);
    }
}
// Generate question paper from template
export async function generateQuestionPaper(req, res, next) {
    try {
        const { templateId, customSettings } = GeneratePaperSchema.parse(req.body);
        const userId = req.auth?.sub;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        // Get template
        const template = await QuestionPaperTemplate.findOne({
            _id: templateId,
            isActive: true,
            $or: [
                { createdBy: userId },
                { isPublic: true }
            ]
        });
        if (!template) {
            throw new createHttpError.NotFound("Template not found");
        }
        // Apply custom settings if provided
        const finalSettings = {
            ...template.toObject(),
            ...customSettings
        };
        // Generate questions using AI
        const generatedQuestions = await AIService.generateQuestions({
            subjectId: template.subjectId.toString(),
            classId: template.classId.toString(),
            unit: template.unitSelections.map(u => u.unitName).join(', '),
            questionDistribution: finalSettings.bloomsDistribution.map(dist => ({
                bloomsLevel: dist.level,
                difficulty: 'MODERATE', // Default difficulty
                percentage: dist.percentage,
                twistedPercentage: dist.twistedPercentage || 0
            })),
            totalQuestions: Math.ceil(finalSettings.totalMarks / 2), // Estimate based on average marks per question
            language: 'ENGLISH',
            subjectName: template.subjectId.name,
            className: template.classId.name
        });
        // Convert AI generated questions to database format with enhanced question types
        const questions = generatedQuestions.map((aiQuestion, index) => {
            // Determine question type based on template distribution
            const questionType = getQuestionTypeFromDistribution(finalSettings.questionTypeDistribution, index, finalSettings.questionTypeDistribution.length);
            return {
                questionText: enhanceQuestionForType(aiQuestion.questionText, questionType, finalSettings.gradeLevel),
                questionType,
                subjectId: template.subjectId,
                classId: template.classId,
                unit: template.unitSelections[0]?.unitName || 'General',
                bloomsTaxonomyLevel: finalSettings.bloomsDistribution[0]?.level || 'REMEMBER',
                difficulty: 'MODERATE',
                isTwisted: Math.random() < (finalSettings.twistedQuestionsPercentage / 100),
                options: questionType === 'MULTIPLE_CHOICE' ? aiQuestion.options || [] : [],
                correctAnswer: aiQuestion.correctAnswer,
                explanation: aiQuestion.explanation,
                marks: getMarksForQuestionType(questionType, finalSettings.markDistribution),
                timeLimit: getTimeLimitForGrade(finalSettings.gradeLevel),
                tags: aiQuestion.tags || [],
                createdBy: userId,
                language: 'ENGLISH',
                // Enhanced fields for new question types
                matchingPairs: questionType === 'MATCHING_PAIRS' ? generateMatchingPairs(aiQuestion.questionText) : undefined,
                multipleCorrectAnswers: questionType === 'MULTIPLE_ANSWERS' ? [aiQuestion.correctAnswer] : undefined,
                drawingInstructions: questionType === 'DRAWING_DIAGRAM' ? generateDrawingInstructions(aiQuestion.questionText, finalSettings.gradeLevel) : undefined,
                markingInstructions: questionType === 'MARKING_PARTS' ? generateMarkingInstructions(aiQuestion.questionText, finalSettings.gradeLevel) : undefined,
                visualAids: finalSettings.gradeSpecificSettings.visualAids ? generateVisualAids(questionType) : undefined,
                interactiveElements: finalSettings.gradeSpecificSettings.interactiveElements ? generateInteractiveElements(questionType) : undefined
            };
        });
        // Save generated questions
        const savedQuestions = await Question.insertMany(questions);
        // Update template usage statistics
        template.usageCount += 1;
        template.lastUsed = new Date();
        await template.save();
        res.json({
            success: true,
            message: "Question paper generated successfully",
            data: {
                questions: savedQuestions,
                template: {
                    name: template.name,
                    totalMarks: finalSettings.totalMarks,
                    duration: finalSettings.duration,
                    gradeLevel: finalSettings.gradeLevel
                },
                statistics: {
                    totalQuestions: savedQuestions.length,
                    questionTypes: getQuestionTypeStatistics(savedQuestions),
                    bloomsDistribution: getBloomsStatistics(savedQuestions),
                    twistedQuestions: savedQuestions.filter(q => q.isTwisted).length
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
}
// Helper functions
function getQuestionTypeFromDistribution(distribution, index, total) {
    const random = Math.random() * 100;
    let cumulative = 0;
    for (const dist of distribution) {
        cumulative += dist.percentage;
        if (random <= cumulative) {
            return dist.type;
        }
    }
    return distribution[0]?.type || 'MULTIPLE_CHOICE';
}
function enhanceQuestionForType(questionText, questionType, gradeLevel) {
    switch (questionType) {
        case 'FILL_BLANKS':
            return questionText.replace(/___/g, '______');
        case 'ONE_WORD_ANSWER':
            return questionText + ' (Answer in one word)';
        case 'TRUE_FALSE':
            return questionText + ' (True/False)';
        case 'MULTIPLE_ANSWERS':
            return questionText + ' (Choose all correct answers)';
        case 'MATCHING_PAIRS':
            return questionText + ' (Match the items in Column A with Column B)';
        case 'DRAWING_DIAGRAM':
            return questionText + ' (Draw and label the diagram)';
        case 'MARKING_PARTS':
            return questionText + ' (Mark the parts on the given diagram)';
        default:
            return questionText;
    }
}
function getMarksForQuestionType(questionType, markDistribution) {
    // Return appropriate marks based on question type and distribution
    const typeMarks = {
        'MULTIPLE_CHOICE': 1,
        'TRUE_FALSE': 1,
        'ONE_WORD_ANSWER': 1,
        'FILL_BLANKS': 2,
        'MULTIPLE_ANSWERS': 2,
        'MATCHING_PAIRS': 3,
        'DRAWING_DIAGRAM': 5,
        'MARKING_PARTS': 3
    };
    return typeMarks[questionType] || 2;
}
function getTimeLimitForGrade(gradeLevel) {
    const timeLimits = {
        'PRE_KG': 2,
        'LKG': 3,
        'UKG': 5,
        '1': 5,
        '2': 5,
        '3': 5,
        '4': 5,
        '5': 5,
        '6': 5,
        '7': 5,
        '8': 5,
        '9': 5,
        '10': 5,
        '11': 5,
        '12': 5
    };
    return timeLimits[gradeLevel] || 5;
}
function generateMatchingPairs(questionText) {
    // Generate sample matching pairs based on question content
    return [
        { left: 'Capital of India', right: 'New Delhi' },
        { left: 'Largest Planet', right: 'Jupiter' },
        { left: 'Chemical Symbol for Gold', right: 'Au' }
    ];
}
function generateDrawingInstructions(questionText, gradeLevel) {
    const instructions = {
        'PRE_KG': 'Draw a simple circle and color it red',
        'LKG': 'Draw a house with a triangle roof and square base',
        'UKG': 'Draw a tree with branches and leaves',
        '1': 'Draw a human body and label 3 parts',
        '2': 'Draw a plant and label the parts',
        '3': 'Draw a water cycle diagram',
        '4': 'Draw a food chain with 3 organisms',
        '5': 'Draw a solar system with planets'
    };
    return instructions[gradeLevel] || 'Draw the diagram as described';
}
function generateMarkingInstructions(questionText, gradeLevel) {
    return `Mark the following parts on the diagram: 1) Main structure, 2) Supporting elements, 3) Key features`;
}
function generateVisualAids(questionType) {
    const aids = {
        'DRAWING_DIAGRAM': ['Reference diagram', 'Step-by-step guide'],
        'MARKING_PARTS': ['Labeled diagram', 'Part identification guide'],
        'MATCHING_PAIRS': ['Visual chart', 'Color-coded items']
    };
    return aids[questionType] || [];
}
function generateInteractiveElements(questionType) {
    const elements = {
        'DRAWING_DIAGRAM': ['Drag and drop labels', 'Color picker'],
        'MARKING_PARTS': ['Click to mark', 'Highlight tool'],
        'MATCHING_PAIRS': ['Drag and drop matching', 'Timer']
    };
    return elements[questionType] || [];
}
function getQuestionTypeStatistics(questions) {
    const stats = {};
    questions.forEach(q => {
        stats[q.questionType] = (stats[q.questionType] || 0) + 1;
    });
    return stats;
}
function getBloomsStatistics(questions) {
    const stats = {};
    questions.forEach(q => {
        stats[q.bloomsTaxonomyLevel] = (stats[q.bloomsTaxonomyLevel] || 0) + 1;
    });
    return stats;
}
//# sourceMappingURL=questionPaperController.js.map
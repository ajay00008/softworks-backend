import { z } from "zod";
import createHttpError from "http-errors";
import { Question } from "../models/Question";
import { Subject } from "../models/Subject";
import { Class } from "../models/Class";
import { Syllabus } from "../models/Syllabus";
import AIService from "../services/aiService";
const CreateQuestionSchema = z.object({
    questionText: z.string().min(10),
    questionType: z.enum([
        "CHOOSE_BEST_ANSWER",
        "FILL_BLANKS",
        "ONE_WORD_ANSWER",
        "TRUE_FALSE",
        "CHOOSE_MULTIPLE_ANSWERS",
        "MATCHING_PAIRS",
        "DRAWING_DIAGRAM",
        "MARKING_PARTS",
        "SHORT_ANSWER",
        "LONG_ANSWER"
    ]),
    subjectId: z.string().min(1),
    classId: z.string().min(1),
    unit: z.string().min(1),
    bloomsTaxonomyLevel: z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]),
    difficulty: z.enum(["EASY", "MODERATE", "TOUGHEST"]),
    isTwisted: z.boolean().default(false),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().min(1),
    explanation: z.string().optional(),
    marks: z.number().min(1).max(100),
    timeLimit: z.number().min(1).max(300).optional(),
    tags: z.array(z.string()).optional(),
    language: z.enum(["ENGLISH", "TAMIL", "HINDI", "MALAYALAM", "TELUGU", "KANNADA"]).default("ENGLISH"),
    // Additional fields for new question types
    matchingPairs: z.array(z.object({
        left: z.string(),
        right: z.string()
    })).optional(),
    multipleCorrectAnswers: z.array(z.string()).optional(),
    drawingInstructions: z.string().optional(),
    markingInstructions: z.string().optional(),
    visualAids: z.array(z.string()).optional(),
    interactiveElements: z.array(z.string()).optional()
});
const UpdateQuestionSchema = CreateQuestionSchema.partial();
const GetQuestionsQuerySchema = z.object({
    page: z.union([z.string(), z.number()]).transform(Number).default(1),
    limit: z.union([z.string(), z.number()]).transform(Number).default(10),
    search: z.string().optional(),
    subjectId: z.string().optional(),
    classId: z.string().optional(),
    unit: z.string().optional(),
    bloomsTaxonomyLevel: z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]).optional(),
    difficulty: z.enum(["EASY", "MODERATE", "TOUGHEST"]).optional(),
    isTwisted: z.string().transform(Boolean).optional(),
    language: z.string().optional(),
    isActive: z.string().transform(Boolean).optional()
});
const GenerateQuestionsSchema = z.object({
    subjectId: z.string().min(1),
    classId: z.string().min(1),
    unit: z.string().min(1),
    questionDistribution: z.array(z.object({
        bloomsLevel: z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]),
        difficulty: z.enum(["EASY", "MODERATE", "TOUGHEST"]),
        percentage: z.number().min(0).max(100),
        twistedPercentage: z.number().min(0).max(100).optional()
    })),
    totalQuestions: z.number().min(1).max(100),
    language: z.enum(["ENGLISH", "TAMIL", "HINDI", "MALAYALAM", "TELUGU", "KANNADA"]).default("ENGLISH")
});
// Create Question
export async function createQuestion(req, res, next) {
    try {
        const questionData = CreateQuestionSchema.parse(req.body);
        const auth = req.auth;
        const userId = auth?.sub;
        const adminId = auth?.adminId;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Validate subject and class exist and belong to the same admin
        const [subject, classExists] = await Promise.all([
            Subject.findOne({ _id: questionData.subjectId, adminId, isActive: true }),
            Class.findOne({ _id: questionData.classId, adminId, isActive: true })
        ]);
        if (!subject)
            throw new createHttpError.NotFound("Subject not found or not accessible");
        if (!classExists)
            throw new createHttpError.NotFound("Class not found or not accessible");
        // Validate that syllabus exists for this subject and class combination
        const syllabus = await Syllabus.findOne({
            subjectId: questionData.subjectId,
            classId: questionData.classId,
            adminId,
            isActive: true
        });
        if (!syllabus) {
            throw new createHttpError.BadRequest("No syllabus found for this subject and class combination. Please upload syllabus first.");
        }
        // Validate options for multiple choice questions
        if (questionData.questionType === "CHOOSE_BEST_ANSWER" && (!questionData.options || questionData.options.length < 2)) {
            throw new createHttpError.BadRequest("Choose best answer questions must have at least 2 options");
        }
        // Validate multiple correct answers for CHOOSE_MULTIPLE_ANSWERS
        if (questionData.questionType === "CHOOSE_MULTIPLE_ANSWERS" && (!questionData.multipleCorrectAnswers || questionData.multipleCorrectAnswers.length < 2)) {
            throw new createHttpError.BadRequest("Choose multiple answers questions must have at least 2 correct answers");
        }
        // Validate matching pairs for MATCHING_PAIRS
        if (questionData.questionType === "MATCHING_PAIRS" && (!questionData.matchingPairs || questionData.matchingPairs.length < 2)) {
            throw new createHttpError.BadRequest("Matching pairs questions must have at least 2 pairs");
        }
        // Validate drawing instructions for DRAWING_DIAGRAM
        if (questionData.questionType === "DRAWING_DIAGRAM" && !questionData.drawingInstructions) {
            throw new createHttpError.BadRequest("Drawing diagram questions must have drawing instructions");
        }
        // Validate marking instructions for MARKING_PARTS
        if (questionData.questionType === "MARKING_PARTS" && !questionData.markingInstructions) {
            throw new createHttpError.BadRequest("Marking parts questions must have marking instructions");
        }
        const question = await Question.create({
            ...questionData,
            adminId,
            createdBy: userId
        });
        const populatedQuestion = await Question.findById(question._id)
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('createdBy', 'name email');
        res.status(201).json({
            success: true,
            question: populatedQuestion
        });
    }
    catch (err) {
        next(err);
    }
}
// Get All Questions
export async function getQuestions(req, res, next) {
    try {
        const queryParams = GetQuestionsQuerySchema.parse(req.query);
        const { page, limit, search, subjectId, classId, unit, bloomsTaxonomyLevel, difficulty, isTwisted, language, isActive } = queryParams;
        const auth = req.auth;
        const adminId = auth.adminId;
        const query = { adminId };
        if (subjectId)
            query.subjectId = subjectId;
        if (classId)
            query.classId = classId;
        if (unit)
            query.unit = { $regex: unit, $options: "i" };
        if (bloomsTaxonomyLevel)
            query.bloomsTaxonomyLevel = bloomsTaxonomyLevel;
        if (difficulty)
            query.difficulty = difficulty;
        if (isTwisted !== undefined)
            query.isTwisted = isTwisted;
        if (language)
            query.language = language;
        if (isActive !== undefined)
            query.isActive = isActive;
        if (search) {
            query.$or = [
                { questionText: { $regex: search, $options: "i" } },
                { unit: { $regex: search, $options: "i" } },
                { tags: { $in: [new RegExp(search, "i")] } }
            ];
        }
        const skip = (page - 1) * limit;
        const [questions, total] = await Promise.all([
            Question.find(query)
                .populate('subjectId', 'code name shortName')
                .populate('classId', 'name displayName level section')
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Question.countDocuments(query)
        ]);
        res.json({
            success: true,
            data: questions,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Single Question
export async function getQuestion(req, res, next) {
    try {
        const { id } = req.params;
        const question = await Question.findById(id)
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('createdBy', 'name email');
        if (!question)
            throw new createHttpError.NotFound("Question not found");
        res.json({
            success: true,
            question
        });
    }
    catch (err) {
        next(err);
    }
}
// Update Question
export async function updateQuestion(req, res, next) {
    try {
        const { id } = req.params;
        const updateData = UpdateQuestionSchema.parse(req.body);
        const question = await Question.findById(id);
        if (!question)
            throw new createHttpError.NotFound("Question not found");
        // Validate subject and class if being updated
        if (updateData.subjectId) {
            const subject = await Subject.findById(updateData.subjectId);
            if (!subject)
                throw new createHttpError.NotFound("Subject not found");
        }
        if (updateData.classId) {
            const classExists = await Class.findById(updateData.classId);
            if (!classExists)
                throw new createHttpError.NotFound("Class not found");
        }
        // Validate options for multiple choice questions
        if (updateData.questionType === "MULTIPLE_CHOICE" && (!updateData.options || updateData.options.length < 2)) {
            throw new createHttpError.BadRequest("Multiple choice questions must have at least 2 options");
        }
        const updatedQuestion = await Question.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('createdBy', 'name email');
        res.json({
            success: true,
            question: updatedQuestion
        });
    }
    catch (err) {
        next(err);
    }
}
// Delete Question
export async function deleteQuestion(req, res, next) {
    try {
        const { id } = req.params;
        const question = await Question.findById(id);
        if (!question)
            throw new createHttpError.NotFound("Question not found");
        await Question.findByIdAndDelete(id);
        res.json({
            success: true,
            message: "Question deleted successfully"
        });
    }
    catch (err) {
        next(err);
    }
}
// Generate Questions with AI (Mock implementation)
export async function generateQuestions(req, res, next) {
    try {
        const { subjectId, classId, unit, questionDistribution, totalQuestions, language } = GenerateQuestionsSchema.parse(req.body);
        const userId = req.auth?.sub;
        if (!userId) {
            throw new createHttpError.Unauthorized("User not authenticated");
        }
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        // Validate subject and class exist and belong to the same admin
        const [subject, classExists] = await Promise.all([
            Subject.findOne({ _id: subjectId, adminId, isActive: true }),
            Class.findOne({ _id: classId, adminId, isActive: true })
        ]);
        if (!subject)
            throw new createHttpError.NotFound("Subject not found or not accessible");
        if (!classExists)
            throw new createHttpError.NotFound("Class not found or not accessible");
        // Validate that syllabus exists for this subject and class combination
        const syllabus = await Syllabus.findOne({
            subjectId,
            classId,
            adminId,
            isActive: true
        });
        if (!syllabus) {
            throw new createHttpError.BadRequest("No syllabus found for this subject and class combination. Please upload syllabus first.");
        }
        // Generate questions using AI service
        const aiGeneratedQuestions = await AIService.generateQuestions({
            subjectId,
            classId,
            unit,
            questionDistribution,
            totalQuestions,
            language,
            subjectName: subject.name,
            className: classExists.name
        });
        // Convert AI generated questions to database format
        const generatedQuestions = aiGeneratedQuestions.map(aiQuestion => ({
            questionText: aiQuestion.questionText,
            questionType: aiQuestion.questionType,
            subjectId,
            classId,
            unit,
            bloomsTaxonomyLevel: questionDistribution[0]?.bloomsLevel || 'REMEMBER',
            difficulty: questionDistribution[0]?.difficulty || 'MODERATE',
            isTwisted: false,
            options: aiQuestion.options || [],
            correctAnswer: aiQuestion.correctAnswer,
            explanation: aiQuestion.explanation,
            marks: aiQuestion.marks,
            timeLimit: aiQuestion.timeLimit,
            tags: aiQuestion.tags || [],
            adminId,
            createdBy: userId,
            language
        }));
        // Save generated questions
        const savedQuestions = await Question.insertMany(generatedQuestions);
        // Populate the saved questions
        const populatedQuestions = await Question.find({ _id: { $in: savedQuestions.map(q => q._id) } })
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('createdBy', 'name email');
        res.status(201).json({
            success: true,
            message: `${savedQuestions.length} questions generated successfully`,
            questions: populatedQuestions
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Question Statistics
export async function getQuestionStatistics(req, res, next) {
    try {
        const { subjectId, classId } = req.query;
        const matchQuery = {};
        if (subjectId)
            matchQuery.subjectId = subjectId;
        if (classId)
            matchQuery.classId = classId;
        const stats = await Question.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalQuestions: { $sum: 1 },
                    byBloomsLevel: {
                        $push: {
                            level: "$bloomsTaxonomyLevel",
                            difficulty: "$difficulty",
                            isTwisted: "$isTwisted"
                        }
                    },
                    byDifficulty: {
                        $push: "$difficulty"
                    },
                    byUnit: {
                        $push: "$unit"
                    }
                }
            },
            {
                $project: {
                    totalQuestions: 1,
                    bloomsLevelDistribution: {
                        $reduce: {
                            input: "$byBloomsLevel",
                            initialValue: {},
                            in: {
                                $mergeObjects: [
                                    "$$value",
                                    {
                                        $let: {
                                            vars: {
                                                key: { $concat: ["$$this.level", "_", "$$this.difficulty"] }
                                            },
                                            in: {
                                                $arrayToObject: [
                                                    [{
                                                            k: "$$key",
                                                            v: {
                                                                $add: [
                                                                    { $ifNull: [{ $getField: { field: "$$key", input: "$$value" } }, 0] },
                                                                    1
                                                                ]
                                                            }
                                                        }]
                                                ]
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    },
                    difficultyDistribution: {
                        $reduce: {
                            input: "$byDifficulty",
                            initialValue: { EASY: 0, MODERATE: 0, TOUGHEST: 0 },
                            in: {
                                $mergeObjects: [
                                    "$$value",
                                    {
                                        $arrayToObject: [
                                            [{
                                                    k: "$$this",
                                                    v: {
                                                        $add: [
                                                            { $ifNull: [{ $getField: { field: "$$this", input: "$$value" } }, 0] },
                                                            1
                                                        ]
                                                    }
                                                }]
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    twistedQuestions: {
                        $sum: {
                            $cond: [{ $eq: ["$isTwisted", true] }, 1, 0]
                        }
                    }
                }
            }
        ]);
        res.json({
            success: true,
            statistics: stats[0] || {
                totalQuestions: 0,
                bloomsLevelDistribution: {},
                difficultyDistribution: { EASY: 0, MODERATE: 0, TOUGHEST: 0 },
                twistedQuestions: 0
            }
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=questionController.js.map
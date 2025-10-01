import { z } from "zod";
import createHttpError from "http-errors";
import { Syllabus } from "../models/Syllabus";
import { Subject } from "../models/Subject";
import { Class } from "../models/Class";
const CreateSyllabusSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    subjectId: z.string().min(1),
    classId: z.string().min(1),
    academicYear: z.string().min(1),
    fileUrl: z.string().optional(),
    version: z.string().default("1.0"),
    language: z.enum(["ENGLISH", "TAMIL", "HINDI", "MALAYALAM", "TELUGU", "KANNADA"]).default("ENGLISH")
});
const UpdateSyllabusSchema = CreateSyllabusSchema.partial();
const GetSyllabusQuerySchema = z.object({
    page: z.union([z.string(), z.number()]).transform(Number).default(1),
    limit: z.union([z.string(), z.number()]).transform(Number).default(10),
    search: z.string().optional(),
    subjectId: z.string().optional(),
    classId: z.string().optional(),
    academicYear: z.string().optional(),
    language: z.string().optional(),
    isActive: z.string().transform(Boolean).optional()
});
// Create Syllabus
export async function createSyllabus(req, res, next) {
    try {
        const syllabusData = CreateSyllabusSchema.parse(req.body);
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
            Subject.findOne({ _id: syllabusData.subjectId, adminId, isActive: true }),
            Class.findOne({ _id: syllabusData.classId, adminId, isActive: true })
        ]);
        if (!subject)
            throw new createHttpError.NotFound("Subject not found or not accessible");
        if (!classExists)
            throw new createHttpError.NotFound("Class not found or not accessible");
        // Check if syllabus already exists for this subject, class, and academic year
        const existingSyllabus = await Syllabus.findOne({
            subjectId: syllabusData.subjectId,
            classId: syllabusData.classId,
            academicYear: syllabusData.academicYear,
            adminId,
            isActive: true
        });
        if (existingSyllabus) {
            throw new createHttpError.Conflict("Syllabus already exists for this subject, class, and academic year");
        }
        const syllabus = await Syllabus.create({
            ...syllabusData,
            adminId,
            uploadedBy: userId
        });
        const populatedSyllabus = await Syllabus.findById(syllabus._id)
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email');
        res.status(201).json({
            success: true,
            syllabus: populatedSyllabus
        });
    }
    catch (err) {
        next(err);
    }
}
// Get All Syllabi
export async function getSyllabi(req, res, next) {
    try {
        const queryParams = GetSyllabusQuerySchema.parse(req.query);
        const { page, limit, search, subjectId, classId, academicYear, language, isActive } = queryParams;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const query = { adminId };
        if (subjectId)
            query.subjectId = subjectId;
        if (classId)
            query.classId = classId;
        if (academicYear)
            query.academicYear = academicYear;
        if (language)
            query.language = language;
        if (isActive !== undefined)
            query.isActive = isActive;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
                { "units.unitName": { $regex: search, $options: "i" } }
            ];
        }
        const skip = (page - 1) * limit;
        const [syllabi, total] = await Promise.all([
            Syllabus.find(query)
                .populate('subjectId', 'code name shortName')
                .populate('classId', 'name displayName level section')
                .populate('uploadedBy', 'name email')
                .sort({ academicYear: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Syllabus.countDocuments(query)
        ]);
        res.json({
            success: true,
            data: syllabi,
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
// Get Single Syllabus
export async function getSyllabus(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const syllabus = await Syllabus.findOne({ _id: id, adminId })
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email');
        if (!syllabus)
            throw new createHttpError.NotFound("Syllabus not found or not accessible");
        res.json({
            success: true,
            syllabus
        });
    }
    catch (err) {
        next(err);
    }
}
// Update Syllabus
export async function updateSyllabus(req, res, next) {
    try {
        const { id } = req.params;
        const updateData = UpdateSyllabusSchema.parse(req.body);
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const syllabus = await Syllabus.findOne({ _id: id, adminId });
        if (!syllabus)
            throw new createHttpError.NotFound("Syllabus not found or not accessible");
        // Validate subject and class if being updated
        if (updateData.subjectId) {
            const subject = await Subject.findOne({ _id: updateData.subjectId, adminId, isActive: true });
            if (!subject)
                throw new createHttpError.NotFound("Subject not found or not accessible");
        }
        if (updateData.classId) {
            const classExists = await Class.findOne({ _id: updateData.classId, adminId, isActive: true });
            if (!classExists)
                throw new createHttpError.NotFound("Class not found or not accessible");
        }
        // Check for conflicts if subject, class, or academic year is being updated
        if (updateData.subjectId || updateData.classId || updateData.academicYear) {
            const conflictQuery = {
                _id: { $ne: id },
                isActive: true
            };
            if (updateData.subjectId)
                conflictQuery.subjectId = updateData.subjectId;
            if (updateData.classId)
                conflictQuery.classId = updateData.classId;
            if (updateData.academicYear)
                conflictQuery.academicYear = updateData.academicYear;
            const existingSyllabus = await Syllabus.findOne(conflictQuery);
            if (existingSyllabus) {
                throw new createHttpError.Conflict("Syllabus already exists for this subject, class, and academic year");
            }
        }
        const updatedSyllabus = await Syllabus.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email');
        res.json({
            success: true,
            syllabus: updatedSyllabus
        });
    }
    catch (err) {
        next(err);
    }
}
// Delete Syllabus
export async function deleteSyllabus(req, res, next) {
    try {
        const { id } = req.params;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const syllabus = await Syllabus.findOne({ _id: id, adminId });
        if (!syllabus)
            throw new createHttpError.NotFound("Syllabus not found or not accessible");
        await Syllabus.findByIdAndDelete(id);
        res.json({
            success: true,
            message: "Syllabus deleted successfully"
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Syllabus by Subject and Class
export async function getSyllabusBySubjectClass(req, res, next) {
    try {
        const { subjectId, classId } = req.params;
        const { academicYear } = req.query;
        const auth = req.auth;
        const adminId = auth?.adminId;
        if (!adminId) {
            throw new createHttpError.Unauthorized("Admin ID not found in token");
        }
        const query = {
            subjectId,
            classId,
            adminId,
            isActive: true
        };
        if (academicYear) {
            query.academicYear = academicYear;
        }
        const syllabus = await Syllabus.findOne(query)
            .populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email')
            .sort({ academicYear: -1, version: -1 });
        if (!syllabus) {
            throw new createHttpError.NotFound("Syllabus not found for this subject and class");
        }
        res.json({
            success: true,
            syllabus
        });
    }
    catch (err) {
        next(err);
    }
}
// Upload Syllabus File
export async function uploadSyllabusFile(req, res, next) {
    try {
        const { id } = req.params;
        const { fileUrl } = req.body;
        const syllabus = await Syllabus.findById(id);
        if (!syllabus)
            throw new createHttpError.NotFound("Syllabus not found");
        const updatedSyllabus = await Syllabus.findByIdAndUpdate(id, { fileUrl }, { new: true }).populate('subjectId', 'code name shortName')
            .populate('classId', 'name displayName level section')
            .populate('uploadedBy', 'name email');
        res.json({
            success: true,
            syllabus: updatedSyllabus,
            message: "Syllabus file uploaded successfully"
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Syllabus Statistics
export async function getSyllabusStatistics(req, res, next) {
    try {
        const { academicYear } = req.query;
        const matchQuery = { isActive: true };
        if (academicYear)
            matchQuery.academicYear = academicYear;
        const stats = await Syllabus.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalSyllabi: { $sum: 1 },
                    totalSubjects: { $addToSet: "$subjectId" },
                    totalClasses: { $addToSet: "$classId" },
                    totalHours: { $sum: "$totalHours" },
                    byLanguage: {
                        $push: "$language"
                    },
                    byAcademicYear: {
                        $push: "$academicYear"
                    }
                }
            },
            {
                $project: {
                    totalSyllabi: 1,
                    totalSubjects: { $size: "$totalSubjects" },
                    totalClasses: { $size: "$totalClasses" },
                    totalHours: 1,
                    languageDistribution: {
                        $reduce: {
                            input: "$byLanguage",
                            initialValue: {},
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
                    academicYearDistribution: {
                        $reduce: {
                            input: "$byAcademicYear",
                            initialValue: {},
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
                    }
                }
            }
        ]);
        res.json({
            success: true,
            statistics: stats[0] || {
                totalSyllabi: 0,
                totalSubjects: 0,
                totalClasses: 0,
                totalHours: 0,
                languageDistribution: {},
                academicYearDistribution: {}
            }
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=syllabusController.js.map
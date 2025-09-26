import { z } from "zod";
import createHttpError from "http-errors";
import { Result } from "../models/Result";
import { Exam } from "../models/Exam";
import { Student } from "../models/Student";
import { Class } from "../models/Class";
import { Subject } from "../models/Subject";
const GetPerformanceQuerySchema = z.object({
    studentId: z.string().optional(),
    classId: z.string().optional(),
    subjectId: z.string().optional(),
    examType: z.enum(["UNIT_TEST", "MID_TERM", "FINAL", "QUIZ", "ASSIGNMENT", "PRACTICAL"]).optional(),
    startDate: z.string().transform(str => new Date(str)).optional(),
    endDate: z.string().transform(str => new Date(str)).optional(),
    academicYear: z.string().optional()
});
// Get Individual Student Performance
export async function getIndividualPerformance(req, res, next) {
    try {
        const { studentId } = req.params;
        const queryParams = GetPerformanceQuerySchema.parse(req.query);
        const student = await Student.findOne({ userId: studentId });
        if (!student)
            throw new createHttpError.NotFound("Student not found");
        const matchQuery = { studentId };
        if (queryParams.subjectId)
            matchQuery["exam.subjectId"] = queryParams.subjectId;
        if (queryParams.examType)
            matchQuery["exam.examType"] = queryParams.examType;
        if (queryParams.startDate)
            matchQuery["exam.scheduledDate"] = { $gte: queryParams.startDate };
        if (queryParams.endDate)
            matchQuery["exam.scheduledDate"] = { ...matchQuery["exam.scheduledDate"], $lte: queryParams.endDate };
        const performance = await Result.aggregate([
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            { $match: matchQuery },
            {
                $lookup: {
                    from: "subjects",
                    localField: "exam.subjectId",
                    foreignField: "_id",
                    as: "subject"
                }
            },
            { $unwind: "$subject" },
            {
                $group: {
                    _id: "$subjectId",
                    subjectName: { $first: "$subject.name" },
                    subjectCode: { $first: "$subject.code" },
                    totalExams: { $sum: 1 },
                    averageMarks: { $avg: "$totalMarksObtained" },
                    averagePercentage: { $avg: "$percentage" },
                    highestMarks: { $max: "$totalMarksObtained" },
                    lowestMarks: { $min: "$totalMarksObtained" },
                    totalMarks: { $sum: "$totalMarksObtained" },
                    exams: {
                        $push: {
                            examId: "$examId",
                            examTitle: "$exam.title",
                            examType: "$exam.examType",
                            marksObtained: "$totalMarksObtained",
                            percentage: "$percentage",
                            grade: "$grade",
                            date: "$exam.scheduledDate",
                            status: "$submissionStatus"
                        }
                    }
                }
            },
            {
                $project: {
                    subjectName: 1,
                    subjectCode: 1,
                    totalExams: 1,
                    averageMarks: { $round: ["$averageMarks", 2] },
                    averagePercentage: { $round: ["$averagePercentage", 2] },
                    highestMarks: 1,
                    lowestMarks: 1,
                    totalMarks: 1,
                    performance: {
                        $cond: [
                            { $gte: ["$averagePercentage", 80] }, "EXCELLENT",
                            { $cond: [
                                    { $gte: ["$averagePercentage", 60] }, "GOOD",
                                    { $cond: [
                                            { $gte: ["$averagePercentage", 40] }, "AVERAGE",
                                            "NEEDS_IMPROVEMENT"
                                        ] }
                                ] }
                        ]
                    },
                    exams: 1
                }
            },
            { $sort: { subjectName: 1 } }
        ]);
        // Calculate overall performance
        const overallStats = await Result.aggregate([
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            { $match: { studentId } },
            {
                $group: {
                    _id: null,
                    totalExams: { $sum: 1 },
                    overallAverage: { $avg: "$percentage" },
                    totalMarksObtained: { $sum: "$totalMarksObtained" },
                    totalPossibleMarks: { $sum: "$exam.totalMarks" },
                    passedExams: {
                        $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
                    }
                }
            }
        ]);
        res.json({
            success: true,
            student: {
                id: student.userId,
                name: student.name,
                rollNumber: student.rollNumber,
                class: student.class
            },
            performance: {
                bySubject: performance,
                overall: {
                    ...overallStats[0],
                    overallAverage: overallStats[0] ? Math.round(overallStats[0].overallAverage * 100) / 100 : 0,
                    passPercentage: overallStats[0] ? (overallStats[0].passedExams / overallStats[0].totalExams) * 100 : 0
                }
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Class Performance
export async function getClassPerformance(req, res, next) {
    try {
        const { classId } = req.params;
        const queryParams = GetPerformanceQuerySchema.parse(req.query);
        const classExists = await Class.findById(classId);
        if (!classExists)
            throw new createHttpError.NotFound("Class not found");
        const matchQuery = { "student.classId": classId };
        if (queryParams.subjectId)
            matchQuery["exam.subjectId"] = queryParams.subjectId;
        if (queryParams.examType)
            matchQuery["exam.examType"] = queryParams.examType;
        if (queryParams.startDate)
            matchQuery["exam.scheduledDate"] = { $gte: queryParams.startDate };
        if (queryParams.endDate)
            matchQuery["exam.scheduledDate"] = { ...matchQuery["exam.scheduledDate"], $lte: queryParams.endDate };
        const classPerformance = await Result.aggregate([
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            {
                $lookup: {
                    from: "students",
                    localField: "studentId",
                    foreignField: "userId",
                    as: "student"
                }
            },
            { $unwind: "$student" },
            { $match: matchQuery },
            {
                $lookup: {
                    from: "subjects",
                    localField: "exam.subjectId",
                    foreignField: "_id",
                    as: "subject"
                }
            },
            { $unwind: "$subject" },
            {
                $group: {
                    _id: {
                        subjectId: "$exam.subjectId",
                        subjectName: "$subject.name"
                    },
                    totalStudents: { $sum: 1 },
                    averageMarks: { $avg: "$totalMarksObtained" },
                    averagePercentage: { $avg: "$percentage" },
                    highestMarks: { $max: "$totalMarksObtained" },
                    lowestMarks: { $min: "$totalMarksObtained" },
                    passedStudents: {
                        $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
                    },
                    excellentStudents: {
                        $sum: { $cond: [{ $gte: ["$percentage", 80] }, 1, 0] }
                    },
                    goodStudents: {
                        $sum: { $cond: [{ $and: [{ $gte: ["$percentage", 60] }, { $lt: ["$percentage", 80] }] }, 1, 0] }
                    },
                    averageStudents: {
                        $sum: { $cond: [{ $and: [{ $gte: ["$percentage", 40] }, { $lt: ["$percentage", 60] }] }, 1, 0] }
                    },
                    needsImprovementStudents: {
                        $sum: { $cond: [{ $lt: ["$percentage", 40] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    subjectName: "$_id.subjectName",
                    totalStudents: 1,
                    averageMarks: { $round: ["$averageMarks", 2] },
                    averagePercentage: { $round: ["$averagePercentage", 2] },
                    highestMarks: 1,
                    lowestMarks: 1,
                    passPercentage: { $round: [{ $multiply: [{ $divide: ["$passedStudents", "$totalStudents"] }, 100] }, 2] },
                    performanceDistribution: {
                        excellent: "$excellentStudents",
                        good: "$goodStudents",
                        average: "$averageStudents",
                        needsImprovement: "$needsImprovementStudents"
                    }
                }
            },
            { $sort: { subjectName: 1 } }
        ]);
        // Get top and bottom performers
        const topPerformers = await Result.aggregate([
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            {
                $lookup: {
                    from: "students",
                    localField: "studentId",
                    foreignField: "userId",
                    as: "student"
                }
            },
            { $unwind: "$student" },
            { $match: { "student.classId": classId } },
            {
                $group: {
                    _id: "$studentId",
                    studentName: { $first: "$student.name" },
                    rollNumber: { $first: "$student.rollNumber" },
                    averagePercentage: { $avg: "$percentage" },
                    totalExams: { $sum: 1 }
                }
            },
            { $sort: { averagePercentage: -1 } },
            { $limit: 10 }
        ]);
        const bottomPerformers = await Result.aggregate([
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            {
                $lookup: {
                    from: "students",
                    localField: "studentId",
                    foreignField: "userId",
                    as: "student"
                }
            },
            { $unwind: "$student" },
            { $match: { "student.classId": classId } },
            {
                $group: {
                    _id: "$studentId",
                    studentName: { $first: "$student.name" },
                    rollNumber: { $first: "$student.rollNumber" },
                    averagePercentage: { $avg: "$percentage" },
                    totalExams: { $sum: 1 }
                }
            },
            { $sort: { averagePercentage: 1 } },
            { $limit: 10 }
        ]);
        res.json({
            success: true,
            class: {
                id: classExists._id,
                name: classExists.name,
                displayName: classExists.displayName,
                level: classExists.level,
                section: classExists.section
            },
            performance: {
                bySubject: classPerformance,
                topPerformers: topPerformers.map(p => ({
                    ...p,
                    averagePercentage: Math.round(p.averagePercentage * 100) / 100
                })),
                bottomPerformers: bottomPerformers.map(p => ({
                    ...p,
                    averagePercentage: Math.round(p.averagePercentage * 100) / 100
                }))
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Performance Analytics Dashboard
export async function getPerformanceAnalytics(req, res, next) {
    try {
        const queryParams = GetPerformanceQuerySchema.parse(req.query);
        const matchQuery = {};
        if (queryParams.classId)
            matchQuery["student.classId"] = queryParams.classId;
        if (queryParams.subjectId)
            matchQuery["exam.subjectId"] = queryParams.subjectId;
        if (queryParams.examType)
            matchQuery["exam.examType"] = queryParams.examType;
        if (queryParams.startDate)
            matchQuery["exam.scheduledDate"] = { $gte: queryParams.startDate };
        if (queryParams.endDate)
            matchQuery["exam.scheduledDate"] = { ...matchQuery["exam.scheduledDate"], $lte: queryParams.endDate };
        const analytics = await Result.aggregate([
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            {
                $lookup: {
                    from: "students",
                    localField: "studentId",
                    foreignField: "userId",
                    as: "student"
                }
            },
            { $unwind: "$student" },
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalResults: { $sum: 1 },
                    averagePercentage: { $avg: "$percentage" },
                    highestPercentage: { $max: "$percentage" },
                    lowestPercentage: { $min: "$percentage" },
                    passedResults: {
                        $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
                    },
                    excellentResults: {
                        $sum: { $cond: [{ $gte: ["$percentage", 80] }, 1, 0] }
                    },
                    goodResults: {
                        $sum: { $cond: [{ $and: [{ $gte: ["$percentage", 60] }, { $lt: ["$percentage", 80] }] }, 1, 0] }
                    },
                    averageResults: {
                        $sum: { $cond: [{ $and: [{ $gte: ["$percentage", 40] }, { $lt: ["$percentage", 60] }] }, 1, 0] }
                    },
                    failedResults: {
                        $sum: { $cond: [{ $lt: ["$percentage", 40] }, 1, 0] }
                    },
                    absentResults: {
                        $sum: { $cond: [{ $eq: ["$isAbsent", true] }, 1, 0] }
                    },
                    missingSheets: {
                        $sum: { $cond: [{ $eq: ["$isMissingSheet", true] }, 1, 0] }
                    }
                }
            }
        ]);
        // Performance trends over time
        const trends = await Result.aggregate([
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        year: { $year: "$exam.scheduledDate" },
                        month: { $month: "$exam.scheduledDate" }
                    },
                    averagePercentage: { $avg: "$percentage" },
                    totalExams: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);
        // Subject-wise performance
        const subjectPerformance = await Result.aggregate([
            {
                $lookup: {
                    from: "exams",
                    localField: "examId",
                    foreignField: "_id",
                    as: "exam"
                }
            },
            { $unwind: "$exam" },
            {
                $lookup: {
                    from: "subjects",
                    localField: "exam.subjectId",
                    foreignField: "_id",
                    as: "subject"
                }
            },
            { $unwind: "$subject" },
            { $match: matchQuery },
            {
                $group: {
                    _id: "$exam.subjectId",
                    subjectName: { $first: "$subject.name" },
                    averagePercentage: { $avg: "$percentage" },
                    totalExams: { $sum: 1 },
                    passedExams: {
                        $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    subjectName: 1,
                    averagePercentage: { $round: ["$averagePercentage", 2] },
                    totalExams: 1,
                    passPercentage: { $round: [{ $multiply: [{ $divide: ["$passedExams", "$totalExams"] }, 100] }, 2] }
                }
            },
            { $sort: { averagePercentage: -1 } }
        ]);
        res.json({
            success: true,
            analytics: {
                overview: {
                    ...analytics[0],
                    averagePercentage: analytics[0] ? Math.round(analytics[0].averagePercentage * 100) / 100 : 0,
                    passPercentage: analytics[0] ? (analytics[0].passedResults / analytics[0].totalResults) * 100 : 0
                },
                trends: trends.map(t => ({
                    ...t,
                    averagePercentage: Math.round(t.averagePercentage * 100) / 100
                })),
                subjectPerformance
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Performance Reports for Printing
export async function getPerformanceReport(req, res, next) {
    try {
        const { type } = req.params; // 'individual' or 'class'
        const { studentId, classId, subjectId, examId } = req.query;
        if (type === 'individual' && studentId) {
            const performance = await getIndividualPerformance(req, res, next);
            return performance;
        }
        else if (type === 'class' && classId) {
            const performance = await getClassPerformance(req, res, next);
            return performance;
        }
        else {
            throw new createHttpError.BadRequest("Invalid report type or missing required parameters");
        }
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=performanceController.js.map
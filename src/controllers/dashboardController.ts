import type { Request, Response, NextFunction } from "express";
import { Result } from "../models/Result.js";
import { Exam } from "../models/Exam.js";
import { Student } from "../models/Student.js";
import { Class } from "../models/Class.js";
import { Subject } from "../models/Subject.js";
import { User } from "../models/User.js";
import createHttpError from "http-errors";

// Helper function to get date filter based on timeRange
const getDateFilter = (timeRange?: string) => {
  const now = new Date();
  
  switch (timeRange) {
    case "current":
      return {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      };
    case "lastMonth":
      return {
        $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        $lt: new Date(now.getFullYear(), now.getMonth(), 1)
      };
    case "last3Months":
      return {
        $gte: new Date(now.getFullYear(), now.getMonth() - 3, 1),
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      };
    case "last6Months":
      return {
        $gte: new Date(now.getFullYear(), now.getMonth() - 6, 1),
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
      };
    case "lastYear":
      return {
        $gte: new Date(now.getFullYear() - 1, 0, 1),
        $lt: new Date(now.getFullYear() + 1, 0, 1)
      };
    default:
      return {};
  }
};

// Get dashboard statistics
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParams = req.query;
    const dateFilter = getDateFilter(queryParams.timeRange as string);

    // Get basic counts
    const [totalStudents, totalTeachers, totalClasses, totalSubjects, totalExams] = await Promise.all([
      // Count active students by joining with User collection
      Student.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        { $match: { "user.isActive": true, "user.role": "STUDENT" } },
        { $count: "total" }
      ]).then(result => result[0]?.total || 0),
      User.countDocuments({ role: "TEACHER", isActive: true }),
      Class.countDocuments({ isActive: true }),
      Subject.countDocuments({ isActive: true }),
      Exam.countDocuments({ 
        isActive: true,
        ...(Object.keys(dateFilter).length > 0 && { scheduledDate: dateFilter })
      })
    ]);

    // Get performance statistics
    const performanceStats = await Result.aggregate([
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
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "userId",
          as: "studentProfile"
        }
      },
      { $unwind: "$studentProfile" },
      {
        $match: {
          ...(queryParams.classId && { "studentProfile.classId": queryParams.classId }),
          ...(queryParams.subjectId && { "exam.subjectId": queryParams.subjectId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
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
          poorResults: {
            $sum: { $cond: [{ $lt: ["$percentage", 40] }, 1, 0] }
          }
        }
      }
    ]);

    // Get class performance
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
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "userId",
          as: "studentProfile"
        }
      },
      { $unwind: "$studentProfile" },
      {
        $lookup: {
          from: "classes",
          localField: "studentProfile.classId",
          foreignField: "_id",
          as: "class"
        }
      },
      { $unwind: "$class" },
      {
        $match: {
          ...(queryParams.subjectId && { "exam.subjectId": queryParams.subjectId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
      {
        $group: {
          _id: "$class._id",
          className: { $first: "$class.name" },
          totalResults: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          lowestPercentage: { $min: "$percentage" },
          passedResults: {
            $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          passPercentage: {
            $multiply: [{ $divide: ["$passedResults", "$totalResults"] }, 100]
          }
        }
      },
      { $sort: { averagePercentage: -1 } },
      { $limit: 10 }
    ]);

    // Get subject performance
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
      {
        $lookup: {
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "userId",
          as: "studentProfile"
        }
      },
      { $unwind: "$studentProfile" },
      {
        $match: {
          ...(queryParams.classId && { "studentProfile.classId": queryParams.classId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
      {
        $group: {
          _id: "$subject._id",
          subjectName: { $first: "$subject.name" },
          totalResults: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          lowestPercentage: { $min: "$percentage" },
          passedResults: {
            $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          passPercentage: {
            $multiply: [{ $divide: ["$passedResults", "$totalResults"] }, 100]
          }
        }
      },
      { $sort: { averagePercentage: -1 } },
      { $limit: 10 }
    ]);

    // Get top performers
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
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "userId",
          as: "studentProfile"
        }
      },
      { $unwind: "$studentProfile" },
      {
        $lookup: {
          from: "classes",
          localField: "studentProfile.classId",
          foreignField: "_id",
          as: "class"
        }
      },
      { $unwind: "$class" },
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
        $match: {
          ...(queryParams.classId && { "studentProfile.classId": queryParams.classId }),
          ...(queryParams.subjectId && { "exam.subjectId": queryParams.subjectId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
      {
        $group: {
          _id: {
            studentId: "$student._id",
            studentName: "$student.name",
            rollNumber: "$studentProfile.rollNumber",
            className: "$class.name"
          },
          totalExams: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          totalMarks: { $sum: "$totalMarksObtained" },
          subjects: { $addToSet: "$subject.name" }
        }
      },
      {
        $addFields: {
          studentName: "$_id.studentName",
          rollNumber: "$_id.rollNumber",
          className: "$_id.className"
        }
      },
      { $sort: { averagePercentage: -1 } },
      { $limit: 10 }
    ]);

    // Get recent activity
    const recentActivity = await Exam.aggregate([
      {
        $lookup: {
          from: "subjects",
          localField: "subjectId",
          foreignField: "_id",
          as: "subject"
        }
      },
      { $unwind: "$subject" },
      {
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "class"
        }
      },
      { $unwind: "$class" },
      {
        $lookup: {
          from: "results",
          localField: "_id",
          foreignField: "examId",
          as: "results"
        }
      },
      {
        $addFields: {
          subjectName: "$subject.name",
          className: "$class.name",
          totalResults: { $size: "$results" },
          averagePercentage: {
            $cond: {
              if: { $gt: [{ $size: "$results" }, 0] },
              then: { $avg: "$results.percentage" },
              else: 0
            }
          }
        }
      },
      {
        $match: {
          isActive: true,
          ...(queryParams.classId && { classId: queryParams.classId }),
          ...(queryParams.subjectId && { subjectId: queryParams.subjectId }),
          ...(queryParams.examType && { examType: queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { scheduledDate: dateFilter })
        }
      },
      { $sort: { scheduledDate: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 1,
          title: 1,
          examType: 1,
          status: 1,
          scheduledDate: 1,
          subjectName: 1,
          className: 1,
          totalResults: 1,
          averagePercentage: 1
        }
      }
    ]);

    // Get grade distribution
    const gradeDistribution = await Result.aggregate([
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
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "userId",
          as: "studentProfile"
        }
      },
      { $unwind: "$studentProfile" },
      {
        $match: {
          ...(queryParams.classId && { "studentProfile.classId": queryParams.classId }),
          ...(queryParams.subjectId && { "exam.subjectId": queryParams.subjectId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
      {
        $group: {
          _id: "$grade",
          count: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" }
        }
      },
      {
        $addFields: {
          grade: "$_id"
        }
      },
      { $sort: { count: -1 } }
    ]);

    const stats = performanceStats[0] || {
      totalResults: 0,
      averagePercentage: 0,
      highestPercentage: 0,
      lowestPercentage: 0,
      passedResults: 0,
      excellentResults: 0,
      goodResults: 0,
      averageResults: 0,
      poorResults: 0
    };

    const passPercentage = stats.totalResults > 0 
      ? (stats.passedResults / stats.totalResults) * 100 
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          totalTeachers,
          totalClasses,
          totalSubjects,
          totalExams
        },
        performance: {
          averagePercentage: Math.round(stats.averagePercentage * 100) / 100,
          passPercentage: Math.round(passPercentage * 100) / 100
        },
        classPerformance,
        subjectPerformance,
        topPerformers,
        recentActivity,
        gradeDistribution
      }
    });
  } catch (error) {
    next(createHttpError(500, "Failed to fetch dashboard statistics", { cause: error }));
  }
};

// Get detailed analytics
export const getDashboardAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queryParams = req.query;
    const dateFilter = getDateFilter(queryParams.timeRange as string);

    // Get performance trends over time
    const performanceTrends = await Result.aggregate([
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
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "userId",
          as: "studentProfile"
        }
      },
      { $unwind: "$studentProfile" },
      {
        $match: {
          ...(queryParams.classId && { "studentProfile.classId": queryParams.classId }),
          ...(queryParams.subjectId && { "exam.subjectId": queryParams.subjectId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$exam.scheduledDate" },
            month: { $month: "$exam.scheduledDate" }
          },
          averagePercentage: { $avg: "$percentage" },
          totalResults: { $sum: 1 },
          passedResults: {
            $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          passPercentage: {
            $multiply: [{ $divide: ["$passedResults", "$totalResults"] }, 100]
          }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Get subject-wise performance comparison
    const subjectComparison = await Result.aggregate([
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
      {
        $lookup: {
          from: "users",
          localField: "studentId",
          foreignField: "_id",
          as: "student"
        }
      },
      { $unwind: "$student" },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "userId",
          as: "studentProfile"
        }
      },
      { $unwind: "$studentProfile" },
      {
        $match: {
          ...(queryParams.classId && { "studentProfile.classId": queryParams.classId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
      {
        $group: {
          _id: "$subject._id",
          subjectName: { $first: "$subject.name" },
          totalResults: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          lowestPercentage: { $min: "$percentage" },
          passedResults: {
            $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
          },
          excellentResults: {
            $sum: { $cond: [{ $gte: ["$percentage", 80] }, 1, 0] }
          }
        }
      },
      {
        $addFields: {
          passPercentage: {
            $multiply: [{ $divide: ["$passedResults", "$totalResults"] }, 100]
          },
          excellencePercentage: {
            $multiply: [{ $divide: ["$excellentResults", "$totalResults"] }, 100]
          }
        }
      },
      { $sort: { averagePercentage: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        performanceTrends,
        subjectComparison
      }
    });
  } catch (error) {
    next(createHttpError(500, "Failed to fetch dashboard analytics", { cause: error }));
  }
};

// Get individual student performance
export const getIndividualStudentPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const queryParams = req.query;
    const dateFilter = getDateFilter(queryParams.timeRange as string);

    // Get student details
    const student = await User.findById(studentId).select("-password");
    if (!student) {
      return next(createHttpError(404, "Student not found"));
    }

    const studentProfile = await Student.findOne({ userId: studentId });
    if (!studentProfile) {
      return next(createHttpError(404, "Student profile not found"));
    }

    // Get student's performance data
    const performanceData = await Result.aggregate([
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
      {
        $lookup: {
          from: "classes",
          localField: "exam.classId",
          foreignField: "_id",
          as: "class"
        }
      },
      { $unwind: "$class" },
      {
        $match: {
          studentId: studentId,
          ...(queryParams.subjectId && { "exam.subjectId": queryParams.subjectId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
      {
        $group: {
          _id: "$subject._id",
          subjectName: { $first: "$subject.name" },
          totalExams: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          lowestPercentage: { $min: "$percentage" },
          totalMarks: { $sum: "$totalMarksObtained" },
          recentPerformance: {
            $push: {
              examId: "$exam._id",
              examTitle: "$exam.title",
              examType: "$exam.examType",
              percentage: "$percentage",
              grade: "$grade",
              examDate: "$exam.scheduledDate"
            }
          }
        }
      },
      {
        $addFields: {
          recentPerformance: {
            $slice: [
              {
                $sortArray: {
                  input: "$recentPerformance",
                  sortBy: { examDate: -1 }
                }
              },
              5
            ]
          }
        }
      },
      { $sort: { averagePercentage: -1 } }
    ]);

    // Get overall statistics
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
      {
        $match: {
          studentId: studentId,
          ...(queryParams.subjectId && { "exam.subjectId": queryParams.subjectId }),
          ...(queryParams.examType && { "exam.examType": queryParams.examType }),
          ...(Object.keys(dateFilter).length > 0 && { "exam.scheduledDate": dateFilter })
        }
      },
      {
        $group: {
          _id: null,
          totalExams: { $sum: 1 },
          averagePercentage: { $avg: "$percentage" },
          highestPercentage: { $max: "$percentage" },
          lowestPercentage: { $min: "$percentage" },
          passedExams: {
            $sum: { $cond: [{ $gte: ["$percentage", 40] }, 1, 0] }
          },
          excellentExams: {
            $sum: { $cond: [{ $gte: ["$percentage", 80] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = overallStats[0] || {
      totalExams: 0,
      averagePercentage: 0,
      highestPercentage: 0,
      lowestPercentage: 0,
      passedExams: 0,
      excellentExams: 0
    };

    res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          rollNumber: studentProfile.rollNumber,
          classId: studentProfile.classId
        },
        overallStats: {
          totalExams: stats.totalExams,
          averagePercentage: Math.round(stats.averagePercentage * 100) / 100,
          highestPercentage: Math.round(stats.highestPercentage * 100) / 100,
          lowestPercentage: Math.round(stats.lowestPercentage * 100) / 100,
          passPercentage: stats.totalExams > 0 
            ? Math.round((stats.passedExams / stats.totalExams) * 100 * 100) / 100 
            : 0,
          excellencePercentage: stats.totalExams > 0 
            ? Math.round((stats.excellentExams / stats.totalExams) * 100 * 100) / 100 
            : 0
        },
        subjectPerformance: performanceData
      }
    });
  } catch (error) {
    next(createHttpError(500, "Failed to fetch student performance", { cause: error }));
  }
};
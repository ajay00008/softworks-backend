import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import { Exam } from "../models/Exam";
import { Question } from "../models/Question";
import { Result } from "../models/Result";
import { Subject } from "../models/Subject";
import { Class } from "../models/Class";
import { Student } from "../models/Student";

const CreateExamSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  examType: z.enum([
    "UNIT_TEST", "MID_TERM", "FINAL", "QUIZ", "ASSIGNMENT", "PRACTICAL",
    "DAILY", "WEEKLY", "MONTHLY", "UNIT_WISE", "PAGE_WISE", "TERM_TEST", "ANNUAL_EXAM"
  ]),
  subjectIds: z.array(z.string().min(1)).min(1, "At least one subject must be selected"),
  classId: z.string().min(1),
  adminId: z.string().min(1).optional(), // Optional in request, will be set from auth if not provided
  duration: z.number().min(15).max(480),
  scheduledDate: z.string().transform(str => {
    if (!str || str.trim() === '') {
      return undefined;
    }
    const date = new Date(str);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    return date;
  }).optional(),
  endDate: z.string().transform(str => {
    if (!str || str.trim() === '') {
      return undefined;
    }
    const date = new Date(str);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    return date;
  }).optional(),
  questions: z.array(z.string()).optional(),
  questionDistribution: z.array(z.object({
    unit: z.string(),
    bloomsLevel: z.enum(["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"]),
    difficulty: z.enum(["EASY", "MODERATE", "TOUGHEST"]),
    percentage: z.number().min(0).max(100),
    twistedPercentage: z.number().min(0).max(100).optional()
  })).optional(),
  instructions: z.string().optional(),
  allowLateSubmission: z.boolean().default(false),
  lateSubmissionPenalty: z.number().min(0).max(100).optional()
});

const UpdateExamSchema = CreateExamSchema.partial().extend({
  status: z.enum(["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).optional()
});

const GetExamsQuerySchema = z.object({
  page: z.union([z.string(), z.number()]).transform(Number).default(1),
  limit: z.union([z.string(), z.number()]).transform(Number).default(10),
  search: z.string().optional(),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  examType: z.enum([
    "UNIT_TEST", "MID_TERM", "FINAL", "QUIZ", "ASSIGNMENT", "PRACTICAL",
    "DAILY", "WEEKLY", "MONTHLY", "UNIT_WISE", "PAGE_WISE", "TERM_TEST", "ANNUAL_EXAM"
  ]).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
  isActive: z.string().transform(Boolean).optional()
});

// Create Exam
export async function createExam(req: Request, res: Response, next: NextFunction) {
  try {
    const examData = CreateExamSchema.parse(req.body);
    const userId = (req as any).auth?.sub;
    
    // Validate subjects and class exist
    const [subjects, classExists] = await Promise.all([
      Subject.find({ _id: { $in: examData.subjectIds } }),
      Class.findById(examData.classId)
    ]);
    
    if (subjects.length !== examData.subjectIds.length) {
      throw new createHttpError.NotFound("One or more subjects not found");
    }
    if (!classExists) throw new createHttpError.NotFound("Class not found");
    
    // Validate that all subjects are available for the selected class
    const invalidSubjects = subjects.filter(subject => 
      !subject.classIds.includes(examData.classId)
    );
    
    if (invalidSubjects.length > 0) {
      const invalidSubjectIds = invalidSubjects.map(s => s._id.toString());
      throw new createHttpError.BadRequest(`Subjects ${invalidSubjectIds.join(', ')} are not available for the selected class`);
    }
    
    // Validate questions if provided
    if (examData.questions && examData.questions.length > 0) {
      const questions = await Question.find({ 
        _id: { $in: examData.questions },
        isActive: true 
      });
      
      if (questions.length !== examData.questions.length) {
        throw new createHttpError.BadRequest("One or more questions not found or inactive");
      }
    }
    
    // Add fallback for scheduledDate if not provided
    const fallbackDate = new Date();
    const scheduledDate = examData.scheduledDate || fallbackDate;
    
    console.log('Exam creation - Date handling:', {
      providedDate: examData.scheduledDate,
      fallbackDate: fallbackDate,
      finalDate: scheduledDate,
      dateString: scheduledDate.toISOString()
    });
    
    const examDataWithFallback = {
      ...examData,
      scheduledDate: scheduledDate,
      status: 'SCHEDULED', // Set status to SCHEDULED since exam has a scheduled date
      createdBy: userId,
      adminId: examData.adminId || userId // Use provided adminId or default to current user
    };
    
    const exam = await Exam.create(examDataWithFallback);
    
    const populatedExam = await Exam.findById(exam._id)
      .populate('subjectIds', 'code name shortName')
      .populate('classId', 'name displayName level section')
      .populate('createdBy', 'name email')
      .populate('questions');
    
    res.status(201).json({
      success: true,
      exam: populatedExam
    });
  } catch (err) {
    next(err);
  }
}

// Get All Exams
export async function getExams(req: Request, res: Response, next: NextFunction) {
  try {
    const queryParams = GetExamsQuerySchema.parse(req.query);
    const { page, limit, search, subjectId, classId, examType, status, isActive } = queryParams;
    
    const query: any = {};
    
    if (subjectId) query.subjectIds = { $in: [subjectId] };
    if (classId) query.classId = classId;
    if (examType) query.examType = examType;
    if (status) query.status = status;
    if (isActive !== undefined) query.isActive = isActive;
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [exams, total] = await Promise.all([
      Exam.find(query)
        .populate('subjectIds', 'code name shortName')
        .populate('classId', 'name displayName level section')
        .populate('createdBy', 'name email')
        .populate('questions')
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit),
      Exam.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: exams,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get Single Exam
export async function getExam(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findById(id)
      .populate('subjectIds', 'code name shortName')
      .populate('classId', 'name displayName level section')
      .populate('createdBy', 'name email')
      .populate('questions');
    
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    res.json({
      success: true,
      exam
    });
  } catch (err) {
    next(err);
  }
}

// Update Exam
export async function updateExam(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateExamSchema.parse(req.body);
    
    const exam = await Exam.findById(id);
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    // Validate subjects and class if being updated
    if (updateData.subjectIds && updateData.subjectIds.length > 0) {
      const subjects = await Subject.find({ _id: { $in: updateData.subjectIds } });
      if (subjects.length !== updateData.subjectIds.length) {
        throw new createHttpError.NotFound("One or more subjects not found");
      }
    }
    
    if (updateData.classId) {
      const classExists = await Class.findById(updateData.classId);
      if (!classExists) throw new createHttpError.NotFound("Class not found");
    }
    
    // Validate questions if being updated
    if (updateData.questions && updateData.questions.length > 0) {
      const questions = await Question.find({ 
        _id: { $in: updateData.questions },
        isActive: true 
      });
      
      if (questions.length !== updateData.questions.length) {
        throw new createHttpError.BadRequest("One or more questions not found or inactive");
      }
    }
    
    const updatedExam = await Exam.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('subjectIds', 'code name shortName')
     .populate('classId', 'name displayName level section')
     .populate('createdBy', 'name email')
     .populate('questions');
    
    res.json({
      success: true,
      exam: updatedExam
    });
  } catch (err) {
    next(err);
  }
}

// Delete Exam
export async function deleteExam(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findById(id);
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    // Check if exam has results
    const resultsCount = await Result.countDocuments({ examId: id });
    if (resultsCount > 0) {
      throw new createHttpError.BadRequest("Cannot delete exam with existing results");
    }
    
    await Exam.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: "Exam deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Start Exam
export async function startExam(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findById(id);
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    if (exam.status !== "SCHEDULED") {
      throw new createHttpError.BadRequest("Exam is not in scheduled status");
    }
    
    const updatedExam = await Exam.findByIdAndUpdate(
      id,
      { 
        status: "ONGOING",
        endDate: new Date(Date.now() + exam.duration * 60 * 1000)
      },
      { new: true }
    );
    
    res.json({
      success: true,
      exam: updatedExam,
      message: "Exam started successfully"
    });
  } catch (err) {
    next(err);
  }
}

// End Exam
export async function endExam(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findById(id);
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    if (exam.status !== "ONGOING") {
      throw new createHttpError.BadRequest("Exam is not currently ongoing");
    }
    
    const updatedExam = await Exam.findByIdAndUpdate(
      id,
      { 
        status: "COMPLETED",
        endDate: new Date()
      },
      { new: true }
    );
    
    res.json({
      success: true,
      exam: updatedExam,
      message: "Exam ended successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Get Exam Results
export async function getExamResults(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const exam = await Exam.findById(id);
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [results, total] = await Promise.all([
      Result.find({ examId: id })
        .populate('studentId', 'name email')
        .populate('markedBy', 'name email')
        .sort({ totalMarksObtained: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Result.countDocuments({ examId: id })
    ]);
    
    res.json({
      success: true,
      data: results,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get Exam Statistics
export async function getExamStatistics(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const exam = await Exam.findById(id);
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    const stats = await Result.aggregate([
      { $match: { examId: exam._id } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          averageMarks: { $avg: "$totalMarksObtained" },
          averagePercentage: { $avg: "$percentage" },
          highestMarks: { $max: "$totalMarksObtained" },
          lowestMarks: { $min: "$totalMarksObtained" },
          passedStudents: {
            $sum: {
              $cond: [{ $gte: ["$percentage", 40] }, 1, 0]
            }
          },
          absentStudents: {
            $sum: {
              $cond: [{ $eq: ["$isAbsent", true] }, 1, 0]
            }
          },
          missingSheets: {
            $sum: {
              $cond: [{ $eq: ["$isMissingSheet", true] }, 1, 0]
            }
          }
        }
      }
    ]);
    
    const gradeDistribution = await Result.aggregate([
      { $match: { examId: exam._id, grade: { $exists: true } } },
      {
        $group: {
          _id: "$grade",
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      statistics: {
        ...stats[0],
        passPercentage: stats[0] ? (stats[0].passedStudents / stats[0].totalStudents) * 100 : 0,
        gradeDistribution: gradeDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (err) {
    next(err);
  }
}

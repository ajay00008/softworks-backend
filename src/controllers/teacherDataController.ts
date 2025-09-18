import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import { Teacher } from "../models/Teacher";
import { Student } from "../models/Student";
import { Subject } from "../models/Subject";
import { Class } from "../models/Class";
import { Exam } from "../models/Exam";
import { Question } from "../models/Question";
import { Result } from "../models/Result";

const GetStudentsQuerySchema = z.object({
  page: z.string().transform(Number).default(1),
  limit: z.string().transform(Number).default(10),
  search: z.string().optional(),
  classId: z.string().optional(),
});

const GetExamsQuerySchema = z.object({
  page: z.string().transform(Number).default(1),
  limit: z.string().transform(Number).default(10),
  search: z.string().optional(),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  examType: z.string().optional(),
  status: z.string().optional(),
});

const GetQuestionsQuerySchema = z.object({
  page: z.string().transform(Number).default(1),
  limit: z.string().transform(Number).default(10),
  search: z.string().optional(),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
  unit: z.string().optional(),
  bloomsTaxonomyLevel: z.string().optional(),
  difficulty: z.string().optional(),
  isTwisted: z.string().transform(Boolean).optional(),
  language: z.string().optional(),
});

// Get Teacher's Assigned Students
export async function getMyStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).auth.sub; // From JWT token
    const { page, limit, search, classId } = GetStudentsQuerySchema.parse(req.query);
    
    // Get teacher's assigned classes
    const teacher = await Teacher.findOne({ userId: teacherId }).populate('classIds');
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    const assignedClassIds = teacher.classIds.map((cls: any) => cls._id);
    
    if (assignedClassIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, pages: 0 },
        message: "No classes assigned to this teacher"
      });
    }
    
    // Build query for students in assigned classes
    const query: any = { 
      classId: { $in: assignedClassIds },
      isActive: true 
    };
    
    // Filter by specific class if provided
    if (classId && assignedClassIds.includes(classId)) {
      query.classId = classId;
    }
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { rollNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [students, total] = await Promise.all([
      Student.find(query)
        .populate('userId', 'name email isActive')
        .populate('classId', 'name displayName level section')
        .sort({ rollNumber: 1 })
        .skip(skip)
        .limit(limit),
      Student.countDocuments(query)
    ]);
    
    const transformedStudents = students.map(student => ({
      id: student.userId._id,
      email: (student.userId as any).email,
      name: (student.userId as any).name,
      rollNumber: student.rollNumber,
      class: {
        id: student.classId._id,
        name: (student.classId as any).name,
        displayName: (student.classId as any).displayName,
        level: (student.classId as any).level,
        section: (student.classId as any).section
      },
      fatherName: student.fatherName,
      motherName: student.motherName,
      dateOfBirth: student.dateOfBirth,
      parentsPhone: student.parentsPhone,
      parentsEmail: student.parentsEmail,
      address: student.address,
      whatsappNumber: student.whatsappNumber,
      isActive: (student.userId as any).isActive,
      createdAt: (student.userId as any).createdAt,
      updatedAt: (student as any).updatedAt
    }));
    
    res.json({
      success: true,
      data: transformedStudents,
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

// Get Teacher's Assigned Subjects
export async function getMySubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).auth.sub;
    
    const teacher = await Teacher.findOne({ userId: teacherId })
      .populate('subjectIds', 'code name shortName category level isActive');
    
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    const subjects = teacher.subjectIds ? teacher.subjectIds.map((subject: any) => ({
      id: subject._id,
      code: subject.code,
      name: subject.name,
      shortName: subject.shortName,
      category: subject.category,
      level: subject.level,
      isActive: subject.isActive
    })) : [];
    
    res.json({ success: true, subjects });
  } catch (err) {
    next(err);
  }
}

// Get Teacher's Assigned Classes
export async function getMyClasses(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).auth.sub;
    
    const teacher = await Teacher.findOne({ userId: teacherId })
      .populate('classIds', 'name displayName level section isActive');
    
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    const classes = teacher.classIds ? teacher.classIds.map((classItem: any) => ({
      id: classItem._id,
      name: classItem.name,
      displayName: classItem.displayName,
      level: classItem.level,
      section: classItem.section,
      isActive: classItem.isActive
    })) : [];
    
    res.json({ success: true, classes });
  } catch (err) {
    next(err);
  }
}

// Get Teacher's Assigned Exams
export async function getMyExams(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).auth.sub;
    const { page, limit, search, subjectId, classId, examType, status } = GetExamsQuerySchema.parse(req.query);
    
    // Get teacher's assigned subjects and classes
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    const assignedSubjectIds = teacher.subjectIds || [];
    const assignedClassIds = teacher.classIds || [];
    
    if (assignedSubjectIds.length === 0 && assignedClassIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, pages: 0 },
        message: "No subjects or classes assigned to this teacher"
      });
    }
    
    // Build query for exams in assigned subjects/classes
    const query: any = { isActive: true };
    
    if (assignedSubjectIds.length > 0) {
      query.subjectId = { $in: assignedSubjectIds };
    }
    if (assignedClassIds.length > 0) {
      query.classId = { $in: assignedClassIds };
    }
    
    // Apply filters
    if (subjectId && assignedSubjectIds.includes(subjectId)) {
      query.subjectId = subjectId;
    }
    if (classId && assignedClassIds.includes(classId)) {
      query.classId = classId;
    }
    if (examType) query.examType = examType;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [exams, total] = await Promise.all([
      Exam.find(query)
        .populate('subjectId', 'code name shortName')
        .populate('classId', 'name displayName level section')
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit),
      Exam.countDocuments(query)
    ]);
    
    const transformedExams = exams.map(exam => ({
      id: exam._id,
      title: exam.title,
      description: exam.description,
      examType: exam.examType,
      subject: {
        id: exam.subjectId._id,
        code: (exam.subjectId as any).code,
        name: (exam.subjectId as any).name,
        shortName: (exam.subjectId as any).shortName
      },
      class: {
        id: exam.classId._id,
        name: (exam.classId as any).name,
        displayName: (exam.classId as any).displayName,
        level: (exam.classId as any).level,
        section: (exam.classId as any).section
      },
      totalMarks: exam.totalMarks,
      duration: exam.duration,
      scheduledDate: exam.scheduledDate,
      endDate: exam.endDate,
      status: exam.status,
      isActive: exam.isActive,
      createdAt: (exam as any).createdAt,
      updatedAt: (exam as any).updatedAt
    }));
    
    res.json({
      success: true,
      data: transformedExams,
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

// Get Teacher's Assigned Questions
export async function getMyQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).auth.sub;
    const { page, limit, search, subjectId, classId, unit, bloomsTaxonomyLevel, difficulty, isTwisted, language } = GetQuestionsQuerySchema.parse(req.query);
    
    // Get teacher's assigned subjects and classes
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    const assignedSubjectIds = teacher.subjectIds || [];
    const assignedClassIds = teacher.classIds || [];
    
    if (assignedSubjectIds.length === 0 && assignedClassIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, pages: 0 },
        message: "No subjects or classes assigned to this teacher"
      });
    }
    
    // Build query for questions in assigned subjects/classes
    const query: any = { isActive: true };
    
    if (assignedSubjectIds.length > 0) {
      query.subjectId = { $in: assignedSubjectIds };
    }
    if (assignedClassIds.length > 0) {
      query.classId = { $in: assignedClassIds };
    }
    
    // Apply filters
    if (subjectId && assignedSubjectIds.includes(subjectId)) {
      query.subjectId = subjectId;
    }
    if (classId && assignedClassIds.includes(classId)) {
      query.classId = classId;
    }
    if (unit) query.unit = unit;
    if (bloomsTaxonomyLevel) query.bloomsTaxonomyLevel = bloomsTaxonomyLevel;
    if (difficulty) query.difficulty = difficulty;
    if (isTwisted !== undefined) query.isTwisted = isTwisted;
    if (language) query.language = language;
    if (search) {
      query.$or = [
        { questionText: { $regex: search, $options: "i" } },
        { explanation: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [questions, total] = await Promise.all([
      Question.find(query)
        .populate('subjectId', 'code name shortName')
        .populate('classId', 'name displayName level section')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Question.countDocuments(query)
    ]);
    
    const transformedQuestions = questions.map(question => ({
      id: question._id,
      questionText: question.questionText,
      questionType: question.questionType,
      subject: {
        id: question.subjectId._id,
        code: (question.subjectId as any).code,
        name: (question.subjectId as any).name,
        shortName: (question.subjectId as any).shortName
      },
      class: {
        id: question.classId._id,
        name: (question.classId as any).name,
        displayName: (question.classId as any).displayName,
        level: (question.classId as any).level,
        section: (question.classId as any).section
      },
      unit: question.unit,
      bloomsTaxonomyLevel: question.bloomsTaxonomyLevel,
      difficulty: question.difficulty,
      isTwisted: question.isTwisted,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      marks: question.marks,
      timeLimit: question.timeLimit,
      tags: question.tags,
      language: question.language,
      isActive: question.isActive,
      createdAt: (question as any).createdAt,
      updatedAt: (question as any).updatedAt
    }));
    
    res.json({
      success: true,
      data: transformedQuestions,
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

// Get Teacher's Exam Results (for their assigned classes/subjects)
export async function getMyExamResults(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).auth.sub;
    const { examId } = req.params;
    const { page, limit } = z.object({
      page: z.string().transform(Number).default(1),
      limit: z.string().transform(Number).default(50)
    }).parse(req.query);
    
    // Get teacher's assigned subjects and classes
    const teacher = await Teacher.findOne({ userId: teacherId });
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    const assignedSubjectIds = teacher.subjectIds || [];
    const assignedClassIds = teacher.classIds || [];
    
    // Verify the exam is assigned to this teacher
    const exam = await Exam.findById(examId)
      .populate('subjectId', 'code name shortName')
      .populate('classId', 'name displayName level section');
    
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    const isExamAssigned = 
      assignedSubjectIds.includes(exam.subjectId._id.toString()) &&
      assignedClassIds.includes(exam.classId._id.toString());
    
    if (!isExamAssigned) {
      throw new createHttpError.Forbidden("You don't have permission to view this exam's results");
    }
    
    const skip = (page - 1) * limit;
    
    const [results, total] = await Promise.all([
      Result.find({ examId })
        .populate('studentId', 'name email')
        .populate('examId', 'title examType totalMarks')
        .sort({ score: -1 })
        .skip(skip)
        .limit(limit),
      Result.countDocuments({ examId })
    ]);
    
    const transformedResults = results.map(result => ({
      id: result._id,
      student: {
        id: result.studentId._id,
        name: (result.studentId as any).name,
        email: (result.studentId as any).email
      },
      exam: {
        id: result.examId._id,
        title: (result.examId as any).title,
        examType: (result.examId as any).examType,
        totalMarks: (result.examId as any).totalMarks
      },
      score: result.score,
      percentage: result.percentage,
      grade: result.grade,
      answers: result.answers,
      timeSpent: result.timeSpent,
      submittedAt: result.submittedAt,
      isPassed: result.isPassed,
      createdAt: (result as any).createdAt,
      updatedAt: (result as any).updatedAt
    }));
    
    res.json({
      success: true,
      data: transformedResults,
      exam: {
        id: exam._id,
        title: exam.title,
        examType: exam.examType,
        subject: {
          id: exam.subjectId._id,
          code: (exam.subjectId as any).code,
          name: (exam.subjectId as any).name,
          shortName: (exam.subjectId as any).shortName
        },
        class: {
          id: exam.classId._id,
          name: (exam.classId as any).name,
          displayName: (exam.classId as any).displayName,
          level: (exam.classId as any).level,
          section: (exam.classId as any).section
        },
        totalMarks: exam.totalMarks,
        duration: exam.duration,
        scheduledDate: exam.scheduledDate,
        status: exam.status
      },
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

// Get Teacher's Dashboard Data
export async function getMyDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).auth.sub;
    
    const teacher = await Teacher.findOne({ userId: teacherId })
      .populate('subjectIds', 'code name shortName')
      .populate('classIds', 'name displayName level section');
    
    if (!teacher) throw new createHttpError.NotFound("Teacher not found");
    
    const assignedSubjectIds = teacher.subjectIds || [];
    const assignedClassIds = teacher.classIds || [];
    
    // Get counts for dashboard
    const [studentCount, examCount, questionCount, recentExams] = await Promise.all([
      Student.countDocuments({ 
        classId: { $in: assignedClassIds }, 
        isActive: true 
      }),
      Exam.countDocuments({ 
        subjectId: { $in: assignedSubjectIds },
        classId: { $in: assignedClassIds },
        isActive: true 
      }),
      Question.countDocuments({ 
        subjectId: { $in: assignedSubjectIds },
        classId: { $in: assignedClassIds },
        isActive: true 
      }),
      Exam.find({ 
        subjectId: { $in: assignedSubjectIds },
        classId: { $in: assignedClassIds },
        isActive: true 
      })
        .populate('subjectId', 'code name shortName')
        .populate('classId', 'name displayName level section')
        .sort({ scheduledDate: -1 })
        .limit(5)
    ]);
    
    const dashboard = {
      teacher: {
        id: teacher.userId._id,
        name: (teacher.userId as any).name,
        email: (teacher.userId as any).email,
        subjects: teacher.subjectIds ? teacher.subjectIds.map((subject: any) => ({
          id: subject._id,
          code: subject.code,
          name: subject.name,
          shortName: subject.shortName
        })) : [],
        classes: teacher.classIds ? teacher.classIds.map((classItem: any) => ({
          id: classItem._id,
          name: classItem.name,
          displayName: classItem.displayName,
          level: classItem.level,
          section: classItem.section
        })) : []
      },
      statistics: {
        totalStudents: studentCount,
        totalExams: examCount,
        totalQuestions: questionCount
      },
      recentExams: recentExams.map(exam => ({
        id: exam._id,
        title: exam.title,
        examType: exam.examType,
        subject: {
          id: exam.subjectId._id,
          code: (exam.subjectId as any).code,
          name: (exam.subjectId as any).name,
          shortName: (exam.subjectId as any).shortName
        },
        class: {
          id: exam.classId._id,
          name: (exam.classId as any).name,
          displayName: (exam.classId as any).displayName,
          level: (exam.classId as any).level,
          section: (exam.classId as any).section
        },
        scheduledDate: exam.scheduledDate,
        status: exam.status
      }))
    };
    
    res.json({ success: true, dashboard });
  } catch (err) {
    next(err);
  }
}

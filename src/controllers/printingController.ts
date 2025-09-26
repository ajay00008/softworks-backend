import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import { Result } from "../models/Result";
import { Exam } from "../models/Exam";
import { Student } from "../models/Student";
import { Class } from "../models/Class";

const PrintQuerySchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().optional(),
  classId: z.string().optional(),
  includeAnswers: z.union([z.string(), z.boolean()]).transform(Boolean).default(true),
  includeGrades: z.union([z.string(), z.boolean()]).transform(Boolean).default(true),
  includeStatistics: z.union([z.string(), z.boolean()]).transform(Boolean).default(false)
});

// Print All Students' Answers for an Exam
export async function printAllStudentsAnswers(req: Request, res: Response, next: NextFunction) {
  try {
    const { examId } = req.params;
    const { includeAnswers, includeGrades, includeStatistics } = PrintQuerySchema.parse(req.query);
    
    const exam = await Exam.findById(examId)
      .populate('subjectId', 'code name shortName')
      .populate('classId', 'name displayName level section')
      .populate('questions');
    
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    // Get all results for this exam
    const results = await Result.find({ examId })
      .populate('studentId', 'name email')
      .populate('answers.questionId')
      .sort({ 'studentId.name': 1 });
    
    // Get student details
    const students = await Student.find({ 
      classId: exam.classId 
    }).populate('userId', 'name email');
    
    // Create print data
    const printData = {
      exam: {
        title: exam.title,
        examType: exam.examType,
        subject: exam.subjectId,
        class: exam.classId,
        totalMarks: exam.totalMarks,
        duration: exam.duration,
        scheduledDate: exam.scheduledDate,
        instructions: exam.instructions
      },
      students: results.map(result => {
        const student = students.find(s => s.userId.toString() === result.studentId.toString());
        return {
          student: {
            name: (result.studentId as any).name,
            email: (result.studentId as any).email,
            rollNumber: student?.rollNumber,
            class: student?.classId
          },
          result: {
            totalMarksObtained: result.totalMarksObtained,
            percentage: result.percentage,
            grade: result.grade,
            submissionStatus: result.submissionStatus,
            submittedAt: result.submittedAt,
            isAbsent: result.isAbsent,
            isMissingSheet: result.isMissingSheet,
            answers: includeAnswers ? result.answers.map(answer => ({
              question: (answer.questionId as any).questionText,
              answer: answer.answer,
              isCorrect: answer.isCorrect,
              marksObtained: answer.marksObtained
            })) : undefined
          }
        };
      }),
      statistics: includeStatistics ? {
        totalStudents: results.length,
        averageMarks: results.reduce((sum, r) => sum + r.totalMarksObtained, 0) / results.length,
        averagePercentage: results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
        passedStudents: results.filter(r => r.percentage >= 40).length,
        absentStudents: results.filter(r => r.isAbsent).length,
        missingSheets: results.filter(r => r.isMissingSheet).length
      } : undefined
    };
    
    res.json({
      success: true,
      message: "Print data generated successfully",
      printData,
      metadata: {
        generatedAt: new Date(),
        totalPages: Math.ceil(results.length / 20), // Assuming 20 students per page
        examId,
        printType: "ALL_STUDENTS"
      }
    });
  } catch (err) {
    next(err);
  }
}

// Print Individual Student's Answer
export async function printIndividualStudentAnswer(req: Request, res: Response, next: NextFunction) {
  try {
    const { examId, studentId } = req.params;
    const { includeAnswers, includeGrades } = PrintQuerySchema.parse(req.query);
    
    const exam = await Exam.findById(examId)
      .populate('subjectId', 'code name shortName')
      .populate('classId', 'name displayName level section')
      .populate('questions');
    
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    const result = await Result.findOne({ examId, studentId })
      .populate('studentId', 'name email')
      .populate('answers.questionId')
      .populate('markedBy', 'name email');
    
    if (!result) throw new createHttpError.NotFound("Result not found");
    
    const student = await Student.findOne({ userId: studentId })
      .populate('classId', 'name displayName level section');
    
    // Create print data
    const printData = {
      exam: {
        title: exam.title,
        examType: exam.examType,
        subject: exam.subjectId,
        class: exam.classId,
        totalMarks: exam.totalMarks,
        duration: exam.duration,
        scheduledDate: exam.scheduledDate,
        instructions: exam.instructions
      },
      student: {
        name: (result.studentId as any).name,
        email: (result.studentId as any).email,
        rollNumber: student?.rollNumber,
        class: student?.classId
      },
      result: {
        totalMarksObtained: result.totalMarksObtained,
        percentage: result.percentage,
        grade: result.grade,
        submissionStatus: result.submissionStatus,
        submittedAt: result.submittedAt,
        startedAt: result.startedAt,
        timeSpent: result.timeSpent,
        isAbsent: result.isAbsent,
        isMissingSheet: result.isMissingSheet,
        absentReason: result.absentReason,
        missingSheetReason: result.missingSheetReason,
        markedBy: result.markedBy,
        markedAt: result.markedAt,
        remarks: result.remarks,
        answers: includeAnswers ? result.answers.map(answer => ({
          question: (answer.questionId as any).questionText,
          questionType: (answer.questionId as any).questionType,
          answer: answer.answer,
          isCorrect: answer.isCorrect,
          marksObtained: answer.marksObtained,
          timeSpent: answer.timeSpent
        })) : undefined
      }
    };
    
    res.json({
      success: true,
      message: "Print data generated successfully",
      printData,
      metadata: {
        generatedAt: new Date(),
        examId,
        studentId,
        printType: "INDIVIDUAL_STUDENT"
      }
    });
  } catch (err) {
    next(err);
  }
}

// Print Class Results Summary
export async function printClassResultsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { examId } = req.params;
    const { includeStatistics } = PrintQuerySchema.parse(req.query);
    
    const exam = await Exam.findById(examId)
      .populate('subjectId', 'code name shortName')
      .populate('classId', 'name displayName level section');
    
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    
    // Get all results for this exam
    const results = await Result.find({ examId })
      .populate('studentId', 'name email')
      .sort({ totalMarksObtained: -1 });
    
    // Get student details
    const students = await Student.find({ 
      classId: exam.classId 
    }).populate('userId', 'name email');
    
    // Create summary data
    const summaryData = {
      exam: {
        title: exam.title,
        examType: exam.examType,
        subject: exam.subjectId,
        class: exam.classId,
        totalMarks: exam.totalMarks,
        scheduledDate: exam.scheduledDate
      },
      results: results.map(result => {
        const student = students.find(s => s.userId.toString() === result.studentId.toString());
        return {
          rank: results.indexOf(result) + 1,
          student: {
            name: (result.studentId as any).name,
            rollNumber: student?.rollNumber
          },
          marks: {
            obtained: result.totalMarksObtained,
            percentage: result.percentage,
            grade: result.grade
          },
          status: {
            submissionStatus: result.submissionStatus,
            isAbsent: result.isAbsent,
            isMissingSheet: result.isMissingSheet
          }
        };
      }),
      statistics: includeStatistics ? {
        totalStudents: results.length,
        averageMarks: results.reduce((sum, r) => sum + r.totalMarksObtained, 0) / results.length,
        averagePercentage: results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
        highestMarks: Math.max(...results.map(r => r.totalMarksObtained)),
        lowestMarks: Math.min(...results.map(r => r.totalMarksObtained)),
        passedStudents: results.filter(r => r.percentage >= 40).length,
        passPercentage: (results.filter(r => r.percentage >= 40).length / results.length) * 100,
        absentStudents: results.filter(r => r.isAbsent).length,
        missingSheets: results.filter(r => r.isMissingSheet).length
      } : undefined
    };
    
    res.json({
      success: true,
      message: "Class results summary generated successfully",
      printData: summaryData,
      metadata: {
        generatedAt: new Date(),
        examId,
        printType: "CLASS_SUMMARY"
      }
    });
  } catch (err) {
    next(err);
  }
}

// Print Performance Report
export async function printPerformanceReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { type } = req.params; // 'individual' or 'class'
    const { studentId, classId, subjectId, startDate, endDate } = req.query;
    
    if (type === 'individual' && studentId) {
      // Individual performance report
      const student = await Student.findOne({ userId: studentId })
        .populate('userId', 'name email')
        .populate('classId', 'name displayName level section');
      
      if (!student) throw new createHttpError.NotFound("Student not found");
      
      // Get performance data (simplified version)
      const results = await Result.find({ studentId })
        .populate('examId')
        .populate('answers.questionId')
        .sort({ 'examId.scheduledDate': -1 });
      
      const printData = {
        student: {
          name: (student.userId as any).name,
          email: (student.userId as any).email,
          rollNumber: student.rollNumber,
          class: student.classId
        },
        performance: results.map(result => ({
          exam: {
            title: (result.examId as any).title,
            examType: (result.examId as any).examType,
            scheduledDate: (result.examId as any).scheduledDate
          },
          result: {
            totalMarksObtained: result.totalMarksObtained,
            percentage: result.percentage,
            grade: result.grade,
            submissionStatus: result.submissionStatus
          }
        })),
        summary: {
          totalExams: results.length,
          averagePercentage: results.reduce((sum, r) => sum + r.percentage, 0) / results.length,
          passedExams: results.filter(r => r.percentage >= 40).length
        }
      };
      
      res.json({
        success: true,
        message: "Individual performance report generated successfully",
        printData,
        metadata: {
          generatedAt: new Date(),
          studentId,
          printType: "INDIVIDUAL_PERFORMANCE"
        }
      });
      
    } else if (type === 'class' && classId) {
      // Class performance report
      const classExists = await Class.findById(classId);
      if (!classExists) throw new createHttpError.NotFound("Class not found");
      
      // Get class performance data (simplified version)
      const students = await Student.find({ classId })
        .populate('userId', 'name email');
      
      const printData = {
        class: {
          name: classExists.name,
          displayName: classExists.displayName,
          level: classExists.level,
          section: classExists.section
        },
        students: students.map(student => ({
          name: (student.userId as any).name,
          rollNumber: student.rollNumber,
          // Add performance data here
        })),
        summary: {
          totalStudents: students.length
        }
      };
      
      res.json({
        success: true,
        message: "Class performance report generated successfully",
        printData,
        metadata: {
          generatedAt: new Date(),
          classId,
          printType: "CLASS_PERFORMANCE"
        }
      });
      
    } else {
      throw new createHttpError.BadRequest("Invalid report type or missing required parameters");
    }
  } catch (err) {
    next(err);
  }
}

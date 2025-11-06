import { Exam } from '../models/Exam';
import { Class } from '../models/Class';
import { Subject } from '../models/Subject';
import { Student } from '../models/Student';
import { Teacher } from '../models/Teacher';
import { StaffAccess } from '../models/StaffAccess';
import { EvaluationSettings } from '../models/EvaluationSettings';
import { logger } from '../utils/logger';

export interface ExamContextData {
  exam: any;
  accessibleClasses: any[];
  accessibleSubjects: any[];
  students: any[];
  evaluationSettings?: any;
  teacherAccess: {
    canUpload: boolean;
    canEvaluate: boolean;
    canViewResults: boolean;
  };
}

export class ExamContextService {
  /**
   * Get comprehensive exam context data for a teacher
   */
  static async getExamContext(examId: string, teacherId: string): Promise<ExamContextData> {
    try {
      logger.info(`Getting exam context for exam: ${examId}, teacher: ${teacherId}`);

      // Get exam with populated data
      const exam = await Exam.findById(examId)
        .populate('classId')
        .populate('subjectIds')
        .populate('questionPaperId');

      if (!exam) {
        throw new Error('Exam not found');
      }

      // Check teacher access to this exam's class
      const staffAccess = await StaffAccess.findOne({
        staffId: teacherId,
        'classAccess.classId': exam.classId,
        isActive: true
      });

      if (!staffAccess) {
        throw new Error('Access denied to this exam');
      }

      // Get teacher details
      const teacher = await Teacher.findOne({ userId: teacherId });
      if (!teacher) {
        throw new Error('Teacher not found');
      }

      // Get accessible classes (classes teacher has access to for this exam)
      const accessibleClasses = await Class.find({
        _id: { $in: teacher.classIds, $eq: exam.classId } // Only the exam's class
      });

      // Get accessible subjects (subjects teacher teaches for this exam's class)
      const accessibleSubjects = await Subject.find({
        _id: { $in: exam.subjectIds },
        classIds: exam.classId
      }).where('_id').in(teacher.subjectIds);

      // Get students for this exam's class
      const students = await Student.find({
        classId: exam.classId,
        isActive: true
      }).select('name rollNumber email userId');

      // Get evaluation settings for this exam
      const evaluationSettings = await EvaluationSettings.findOne({
        examId: examId,
        classId: exam.classId,
        isActive: true
      });

      // Determine teacher permissions
      const teacherAccess = {
        canUpload: true, // Teachers can always upload for their assigned classes
        canEvaluate: true, // Teachers can evaluate for their subjects
        canViewResults: true // Teachers can view results for their classes
      };

      const contextData: ExamContextData = {
        exam: {
          _id: exam._id,
          title: exam.title,
          description: exam.description,
          examType: exam.examType,
          duration: exam.duration,
          scheduledDate: exam.scheduledDate,
          endDate: exam.endDate,
          status: exam.status,
          classId: exam.classId,
          subjectIds: exam.subjectIds,
          questionPaperId: exam.questionPaperId,
          instructions: exam.instructions
        },
        accessibleClasses,
        accessibleSubjects,
        students,
        evaluationSettings,
        teacherAccess
      };

      logger.info(`Exam context retrieved successfully for exam: ${examId}`);
      return contextData;

    } catch (error: unknown) {
      logger.error(`Error getting exam context for exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * Get exams accessible to a teacher with context data
   */
  static async getTeacherExamsWithContext(teacherId: string): Promise<any[]> {
    try {
      logger.info(`Getting teacher exams with context for teacher: ${teacherId}`);

      // Get teacher details
      const teacher = await Teacher.findOne({ userId: teacherId });
      if (!teacher) {
        throw new Error('Teacher not found');
      }

      // Get staff access for teacher
      const staffAccess = await StaffAccess.find({
        staffId: teacherId,
        isActive: true
      }).populate('classAccess.classId');

      logger.info(`Found ${staffAccess.length} staff access records for teacher: ${teacherId}`);
      
      const accessibleClassIds = staffAccess.flatMap(access => 
        access.classAccess.map(ca => ca.classId)
      );

      logger.info(`Accessible class IDs: ${accessibleClassIds.length}`, accessibleClassIds);

      // Get exams for accessible classes
      const exams = await Exam.find({
        classId: { $in: accessibleClassIds },
        isActive: true
      })
      .populate('classId')
      .populate('subjectIds')
      .sort({ scheduledDate: -1 });

      logger.info(`Found ${exams.length} exams for accessible classes`);

      // Filter exams based on teacher's subject assignments
      const teacherSubjectIds = teacher.subjectIds.map(id => id.toString());
      logger.info(`Teacher subject IDs: ${teacherSubjectIds.length}`, teacherSubjectIds);
      
      // Debug: Log exam subject IDs for comparison
      exams.forEach((exam, index) => {
        const examSubjectIds = exam.subjectIds.map(s => s._id ? s._id.toString() : s.toString());
        const hasMatchingSubject = exam.subjectIds.some(subjectId => 
          teacherSubjectIds.includes(subjectId._id ? subjectId._id.toString() : subjectId.toString())
        );
        logger.info(`Exam ${index + 1} (${exam.title}):`, {
          examSubjectIds,
          teacherSubjectIds,
          hasMatchingSubject,
          matchingSubjects: exam.subjectIds.filter(subjectId => 
            teacherSubjectIds.includes(subjectId._id ? subjectId._id.toString() : subjectId.toString())
          ).map(s => (s as any)?.name || s.toString())
        });
      });
      
      const accessibleExams = exams.filter(exam => 
        exam.subjectIds.some(subjectId => teacherSubjectIds.includes(subjectId._id ? subjectId._id.toString() : subjectId.toString()))
      );

      logger.info(`Accessible exams after subject filtering: ${accessibleExams.length}`);

      // Add context data for each exam
      const examsWithContext = await Promise.all(
        accessibleExams.map(async (exam) => {
          const evaluationSettings = await EvaluationSettings.findOne({
            examId: exam._id,
            classId: exam.classId,
            isActive: true
          });

          return {
            _id: exam._id,
            title: exam.title,
            description: exam.description,
            examType: exam.examType,
            duration: exam.duration,
            scheduledDate: exam.scheduledDate,
            endDate: exam.endDate,
            status: exam.status,
            classId: exam.classId,
            subjectIds: exam.subjectIds,
            questionPaperId: exam.questionPaperId,
            instructions: exam.instructions,
            hasEvaluationSettings: !!evaluationSettings,
            studentCount: await Student.countDocuments({
              classId: exam.classId,
              isActive: true
            })
          };
        })
      );

      logger.info(`Retrieved ${examsWithContext.length} exams with context for teacher: ${teacherId}`);
      return examsWithContext;

    } catch (error: unknown) {
      logger.error(`Error getting teacher exams with context for teacher ${teacherId}:`, error);
      throw error;
    }
  }

  /**
   * Validate teacher access to specific exam operations
   */
  static async validateTeacherAccess(
    examId: string, 
    teacherId: string, 
    operation: 'upload' | 'evaluate' | 'view'
  ): Promise<boolean> {
    try {
      const exam = await Exam.findById(examId);
      if (!exam) return false;

      const staffAccess = await StaffAccess.findOne({
        staffId: teacherId,
        'classAccess.classId': exam.classId,
        isActive: true
      });

      if (!staffAccess) return false;

      const teacher = await Teacher.findOne({ userId: teacherId });
      if (!teacher) return false;

      // Check if teacher teaches subjects for this exam
      const teacherSubjectIds = teacher.subjectIds.map(id => id.toString());
      const examSubjectIds = exam.subjectIds.map(id => id.toString());
      
      const hasSubjectAccess = examSubjectIds.some(subjectId => 
        teacherSubjectIds.includes(subjectId)
      );

      return hasSubjectAccess;

    } catch (error: unknown) {
      logger.error(`Error validating teacher access:`, error);
      return false;
    }
  }
}

import type { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { Teacher } from "../models/Teacher";

export type TeacherPermission = 'createQuestions' | 'viewResults' | 'manageStudents' | 'accessAnalytics';

export function requireTeacherPermission(permission: TeacherPermission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teacherId = (req as any).auth.sub;
      
      const teacher = await Teacher.findOne({ userId: teacherId });
      if (!teacher) {
        return next(new createHttpError.NotFound("Teacher not found"));
      }
      
      // Check if teacher has the required permission
      if (!teacher.permissions || !teacher.permissions[permission]) {
        return next(new createHttpError.Forbidden(`Permission denied: ${permission} access required`));
      }
      
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Helper function to check multiple permissions (any one of them)
export function requireAnyTeacherPermission(...permissions: TeacherPermission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teacherId = (req as any).auth.sub;
      
      const teacher = await Teacher.findOne({ userId: teacherId });
      if (!teacher) {
        return next(new createHttpError.NotFound("Teacher not found"));
      }
      
      // Check if teacher has any of the required permissions
      const hasPermission = permissions.some(permission => 
        teacher.permissions && teacher.permissions[permission]
      );
      
      if (!hasPermission) {
        return next(new createHttpError.Forbidden(`Permission denied: One of [${permissions.join(', ')}] access required`));
      }
      
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Helper function to check if teacher has access to specific subject/class
export function requireTeacherSubjectClassAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const teacherId = (req as any).auth.sub;
      const { subjectId, classId } = req.params;
      
      const teacher = await Teacher.findOne({ userId: teacherId });
      if (!teacher) {
        return next(new createHttpError.NotFound("Teacher not found"));
      }
      
      // Check if teacher has access to the subject (if provided)
      if (subjectId && teacher.subjectIds && !teacher.subjectIds.includes(subjectId)) {
        return next(new createHttpError.Forbidden("Access denied: Teacher not assigned to this subject"));
      }
      
      // Check if teacher has access to the class (if provided)
      if (classId && teacher.classIds && !teacher.classIds.includes(classId)) {
        return next(new createHttpError.Forbidden("Access denied: Teacher not assigned to this class"));
      }
      
      next();
    } catch (err) {
      next(err);
    }
  };
}

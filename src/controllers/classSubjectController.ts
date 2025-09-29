import type { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { 
  getAllClassSubjectMappings,
  getSubjectsForClassLevel,
  getTeachersForClass as getTeachersForClassUtil,
  getClassesForTeacher as getClassesForTeacherUtil,
  getAssignedClassesForTeacher as getAssignedClassesForTeacherUtil,
  validateDataConsistency
} from "../utils/classSubjectValidator";

/**
 * Get all class-subject mappings
 */
export async function getClassSubjectMappings(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    
    
    const mappings = await getAllClassSubjectMappings(adminId);
    
    res.json({
      success: true,
      data: mappings
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get subjects available for a specific class level
 */
export async function getSubjectsForLevel(req: Request, res: Response, next: NextFunction) {
  try {
    const { level } = req.params;
    if (typeof level !== "string") {
      throw new createHttpError.BadRequest("Missing or invalid class level parameter");
    }
    const levelNumber = parseInt(level, 10);

    if (isNaN(levelNumber) || levelNumber < 1 || levelNumber > 12) {
      throw new createHttpError.BadRequest("Invalid class level. Must be between 1 and 12");
    }
    
    const auth = (req as any).auth;
    const adminId = auth.adminId;
    
    const subjects = await getSubjectsForClassLevel(levelNumber, adminId);
    
    res.json({
      success: true,
      data: subjects
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get teachers who can teach a specific class
 */
export async function getTeachersForClass(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId } : any  = req.params;
    
    const teachers = await getTeachersForClassUtil(classId);
    
    res.json({
      success: true,
      data: teachers
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get classes that a teacher can teach
 */
export async function getClassesForTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { teacherId } = req.params;

    if (!teacherId) {
      throw new createHttpError.BadRequest("Missing teacherId parameter");
    }

    const classes = await getClassesForTeacherUtil(teacherId);

    res.json({
      success: true,
      data: classes
    });
  } catch (err) {
    next(err);
  }
}
/**
 * Get assigned classes for a teacher
 */
export async function getAssignedClassesForTeacher(req: Request, res: Response, next: NextFunction) {
  try {
    const { teacherId } = req.params;

    if (!teacherId) {
      throw new createHttpError.BadRequest("Missing teacherId parameter");
    }

    const classes = await getAssignedClassesForTeacherUtil(teacherId);

    res.json({
      success: true,
      data: classes
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Validate data consistency across all models
 */
export async function validateConsistency(req: Request, res: Response, next: NextFunction) {
  try {
    const validation = await validateDataConsistency();
    
    res.json({
      success: true,
      data: validation
    });
  } catch (err) {
    next(err);
  }
}

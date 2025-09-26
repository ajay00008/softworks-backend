import type { Request, Response, NextFunction } from "express";
/**
 * Get all class-subject mappings
 */
export declare function getClassSubjectMappings(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Get subjects available for a specific class level
 */
export declare function getSubjectsForLevel(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Get teachers who can teach a specific class
 */
export declare function getTeachersForClass(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Get classes that a teacher can teach
 */
export declare function getClassesForTeacher(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Get assigned classes for a teacher
 */
export declare function getAssignedClassesForTeacher(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Validate data consistency across all models
 */
export declare function validateConsistency(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=classSubjectController.d.ts.map
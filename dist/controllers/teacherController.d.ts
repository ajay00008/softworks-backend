import type { Request, Response, NextFunction } from "express";
export declare function createTeacher(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getTeachers(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getTeacher(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateTeacher(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteTeacher(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function activateTeacher(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function assignSubjects(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function assignClasses(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=teacherController.d.ts.map
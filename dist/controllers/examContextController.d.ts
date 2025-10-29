import type { Request, Response } from 'express';
/**
 * Get exam context data for a specific exam
 */
export declare const getExamContext: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get all exams accessible to teacher with context data
 */
export declare const getTeacherExamsWithContext: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Validate teacher access to exam operations
 */
export declare const validateTeacherAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get exam statistics for teacher dashboard
 */
export declare const getTeacherExamStatistics: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=examContextController.d.ts.map
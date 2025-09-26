import type { Request, Response, NextFunction } from "express";
export declare function createExam(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getExams(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getExam(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateExam(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteExam(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function startExam(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function endExam(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getExamResults(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getExamStatistics(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=examController.d.ts.map
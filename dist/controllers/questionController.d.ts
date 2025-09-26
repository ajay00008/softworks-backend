import type { Request, Response, NextFunction } from "express";
export declare function createQuestion(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getQuestions(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getQuestion(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateQuestion(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteQuestion(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function generateQuestions(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getQuestionStatistics(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=questionController.d.ts.map
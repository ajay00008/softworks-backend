import type { Request, Response, NextFunction } from 'express';
export declare function createQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getQuestionPapers(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function generateQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function downloadQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function publishQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=questionPaperController.d.ts.map
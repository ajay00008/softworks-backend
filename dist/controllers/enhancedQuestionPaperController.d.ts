import type { Request, Response, NextFunction } from 'express';
export declare const uploadQuestionPaperPdf: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function createQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getQuestionPapers(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function generateAIQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function uploadPDFQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function downloadQuestionPaperPDF(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function publishQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function generateCompleteAIQuestionPaper(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=enhancedQuestionPaperController.d.ts.map
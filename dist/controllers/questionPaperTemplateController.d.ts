import { Request, Response, NextFunction } from 'express';
export declare const uploadTemplate: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function createTemplate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getTemplates(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getTemplateById(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function downloadTemplate(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function analyzeTemplate(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=questionPaperTemplateController.d.ts.map
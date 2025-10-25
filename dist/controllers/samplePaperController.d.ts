import type { Request, Response, NextFunction } from 'express';
export declare const uploadSamplePaper: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function createSamplePaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSamplePapers(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSamplePaperById(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateSamplePaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteSamplePaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function downloadSamplePaper(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function analyzeSamplePaper(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=samplePaperController.d.ts.map
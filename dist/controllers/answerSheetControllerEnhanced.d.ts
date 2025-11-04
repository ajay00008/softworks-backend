import type { Request, Response } from 'express';
export declare const batchUploadAnswerSheetsEnhanced: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const uploadAnswerSheetEnhanced: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const matchAnswerSheetToStudentEnhanced: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAnswerSheetsWithAIResults: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const autoMatchUnmatchedSheets: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=answerSheetControllerEnhanced.d.ts.map
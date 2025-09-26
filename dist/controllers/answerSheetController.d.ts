import type { Request, Response } from 'express';
export declare const uploadAnswerSheet: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAnswerSheetsByExam: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const markAsMissing: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const markAsAbsent: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const acknowledgeNotification: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAnswerSheetDetails: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateAICorrectionResults: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const addManualOverride: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const batchUploadAnswerSheets: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const processAnswerSheet: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=answerSheetController.d.ts.map
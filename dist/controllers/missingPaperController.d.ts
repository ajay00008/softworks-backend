import type { Request, Response } from 'express';
export declare const reportMissingPaper: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getStaffMissingPapers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAdminMissingPapers: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const acknowledgeMissingPaper: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const resolveMissingPaper: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getExamCompletionStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getRedFlagSummary: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=missingPaperController.d.ts.map
import type { Request, Response } from 'express';
export declare const printIndividualAnswerSheet: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const printBatchAnswerSheets: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const downloadPrintedFile: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPrintHistory: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPrintOptions: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=printingController.d.ts.map
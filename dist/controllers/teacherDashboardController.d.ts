import type { Request, Response } from 'express';
export declare const getTeacherAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createTeacherQuestionPaper: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const uploadAnswerSheets: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const markStudentStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const evaluateAnswerSheets: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getResults: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getPerformanceGraphs: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getTeacherExams: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const downloadResults: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAnswerSheets: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=teacherDashboardController.d.ts.map
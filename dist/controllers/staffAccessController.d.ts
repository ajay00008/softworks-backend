import type { Request, Response } from 'express';
export declare const createStaffAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getStaffAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateStaffAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getAllStaffAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deactivateStaffAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const checkClassAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const checkSubjectAccess: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getStaffClasses: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getStaffSubjects: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=staffAccessController.d.ts.map
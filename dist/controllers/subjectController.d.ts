import type { Request, Response, NextFunction } from "express";
export declare const uploadReferenceBook: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
export declare function createSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSubjects(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSubjectsByCategory(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSubjectsByLevel(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function uploadReferenceBookToSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function downloadReferenceBook(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteReferenceBook(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=subjectController.d.ts.map
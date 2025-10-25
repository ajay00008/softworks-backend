import type { Request, Response, NextFunction } from "express";
export declare const uploadReferenceBook: (req: Request, res: Response, next: NextFunction) => void;
export declare function createSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSubjects(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSubjectsByCategory(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSubjectsByLevel(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function uploadReferenceBookBase64(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function uploadReferenceBookToSubject(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function checkReferenceBookExists(req: Request, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function downloadReferenceBook(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteReferenceBook(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=subjectController.d.ts.map
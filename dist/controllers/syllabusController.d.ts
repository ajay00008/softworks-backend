import type { Request, Response, NextFunction } from "express";
export declare function createSyllabus(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSyllabi(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSyllabus(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateSyllabus(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteSyllabus(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSyllabusBySubjectClass(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function uploadSyllabusFile(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getSyllabusStatistics(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=syllabusController.d.ts.map
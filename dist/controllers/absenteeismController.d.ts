import type { Request, Response, NextFunction } from "express";
export declare function reportAbsenteeism(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAbsenteeismReports(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAbsenteeismReport(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function acknowledgeAbsenteeism(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function resolveAbsenteeism(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function escalateAbsenteeism(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updateAbsenteeism(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deleteAbsenteeism(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getAbsenteeismStatistics(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=absenteeismController.d.ts.map
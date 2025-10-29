import type { Request, Response } from 'express';
/**
 * Add a flag to an answer sheet
 */
export declare const addFlag: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Resolve a specific flag
 */
export declare const resolveFlag: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Resolve all flags for an answer sheet
 */
export declare const resolveAllFlags: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get flags for an answer sheet
 */
export declare const getAnswerSheetFlags: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get flagged answer sheets for an exam
 */
export declare const getFlaggedAnswerSheets: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get flag statistics for an exam
 */
export declare const getFlagStatistics: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Auto-detect flags for an answer sheet
 */
export declare const autoDetectFlags: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Bulk resolve flags for multiple answer sheets
 */
export declare const bulkResolveFlags: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=flagManagementController.d.ts.map
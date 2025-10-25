import type { Request, Response } from 'express';
/**
 * Check single answer sheet with AI
 */
export declare const checkAnswerSheetWithAI: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Batch check multiple answer sheets with AI
 */
export declare const batchCheckAnswerSheetsWithAI: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get AI checking results for an answer sheet
 */
export declare const getAIResults: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get AI statistics for an exam
 */
export declare const getAIStats: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Manual override for AI results
 */
export declare const overrideAIResult: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Get answer sheets ready for AI checking
 */
export declare const getAnswerSheetsForAIChecking: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Recheck answer sheet with AI (for failed or low confidence results)
 */
export declare const recheckAnswerSheetWithAI: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=aiAnswerCheckerController.d.ts.map
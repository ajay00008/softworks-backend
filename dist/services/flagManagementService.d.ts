import type { IAnswerSheetFlag, FlagType, FlagSeverity } from '../models/AnswerSheet';
export interface FlagCreationData {
    type: FlagType;
    severity: FlagSeverity;
    description: string;
    detectedBy?: string;
    autoResolved?: boolean;
}
export interface FlagResolutionData {
    resolvedBy: string;
    resolutionNotes?: string;
    autoResolved?: boolean;
}
export interface FlagStatistics {
    totalFlags: number;
    resolvedFlags: number;
    unresolvedFlags: number;
    criticalFlags: number;
    flagsByType: Record<FlagType, number>;
    flagsBySeverity: Record<FlagSeverity, number>;
    averageResolutionTime: number;
    resolutionRate: number;
}
export declare class FlagManagementService {
    /**
     * Add a flag to an answer sheet
     */
    static addFlag(answerSheetId: string, flagData: FlagCreationData): Promise<IAnswerSheetFlag>;
    /**
     * Resolve a specific flag
     */
    static resolveFlag(answerSheetId: string, flagIndex: number, resolutionData: FlagResolutionData): Promise<void>;
    /**
     * Resolve all flags for an answer sheet
     */
    static resolveAllFlags(answerSheetId: string, resolutionData: FlagResolutionData): Promise<void>;
    /**
     * Get flags for an answer sheet
     */
    static getAnswerSheetFlags(answerSheetId: string): Promise<IAnswerSheetFlag[]>;
    /**
     * Get flagged answer sheets for an exam
     */
    static getFlaggedAnswerSheets(examId: string, filters?: {
        severity?: FlagSeverity;
        type?: FlagType;
        resolved?: boolean;
    }): Promise<any[]>;
    /**
     * Get flag statistics for an exam
     */
    static getFlagStatistics(examId: string): Promise<FlagStatistics>;
    /**
     * Auto-detect and add flags based on answer sheet analysis
     */
    static autoDetectFlags(answerSheetId: string, analysisData: {
        rollNumberDetected?: string;
        rollNumberConfidence?: number;
        scanQuality?: string;
        isAligned?: boolean;
        fileSize?: number;
        fileFormat?: string;
    }): Promise<IAnswerSheetFlag[]>;
    /**
     * Bulk resolve flags for multiple answer sheets
     */
    static bulkResolveFlags(answerSheetIds: string[], resolutionData: FlagResolutionData): Promise<void>;
}
//# sourceMappingURL=flagManagementService.d.ts.map
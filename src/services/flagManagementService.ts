import { AnswerSheet } from '../models/AnswerSheet';
import type { IAnswerSheetFlag, FlagType, FlagSeverity } from '../models/AnswerSheet';
import { logger } from '../utils/logger';

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
  averageResolutionTime: number; // in hours
  resolutionRate: number; // percentage
}

export class FlagManagementService {
  /**
   * Add a flag to an answer sheet
   */
  static async addFlag(answerSheetId: string, flagData: FlagCreationData): Promise<IAnswerSheetFlag> {
    try {
      logger.info(`Adding flag to answer sheet: ${answerSheetId}`);

      const answerSheet = await AnswerSheet.findById(answerSheetId);
      if (!answerSheet) {
        throw new Error('Answer sheet not found');
      }

      const newFlag: IAnswerSheetFlag = {
        type: flagData.type,
        severity: flagData.severity,
        description: flagData.description,
        detectedAt: new Date(),
        detectedBy: flagData.detectedBy ? flagData.detectedBy as any : undefined,
        resolved: false,
        autoResolved: flagData.autoResolved || false
      };

      answerSheet.flags.push(newFlag);
      await answerSheet.save();

      logger.info(`Flag added successfully to answer sheet: ${answerSheetId}`);
      return newFlag;

    } catch (error: unknown) {
      logger.error(`Error adding flag to answer sheet ${answerSheetId}:`, error);
      throw error;
    }
  }

  /**
   * Resolve a specific flag
   */
  static async resolveFlag(answerSheetId: string, flagIndex: number, resolutionData: FlagResolutionData): Promise<void> {
    try {
      logger.info(`Resolving flag ${flagIndex} for answer sheet: ${answerSheetId}`);

      const answerSheet = await AnswerSheet.findById(answerSheetId);
      if (!answerSheet) {
        throw new Error('Answer sheet not found');
      }

      if (flagIndex < 0 || flagIndex >= answerSheet.flags.length) {
        throw new Error('Invalid flag index');
      }

      const flag = answerSheet.flags[flagIndex];
      if (!flag) {
        throw new Error('Flag not found');
      }
      if (flag.resolved) {
        throw new Error('Flag is already resolved');
      }

      flag.resolved = true;
      flag.resolvedBy = resolutionData.resolvedBy as any;
      flag.resolvedAt = new Date();
      if (resolutionData.resolutionNotes) {
        if (resolutionData.resolutionNotes !== undefined) {
          flag.resolutionNotes = resolutionData.resolutionNotes;
        }
      }
      flag.autoResolved = resolutionData.autoResolved || false;

      await answerSheet.save();

      logger.info(`Flag ${flagIndex} resolved successfully for answer sheet: ${answerSheetId}`);

    } catch (error: unknown) {
      logger.error(`Error resolving flag ${flagIndex} for answer sheet ${answerSheetId}:`, error);
      throw error;
    }
  }

  /**
   * Resolve all flags for an answer sheet
   */
  static async resolveAllFlags(answerSheetId: string, resolutionData: FlagResolutionData): Promise<void> {
    try {
      logger.info(`Resolving all flags for answer sheet: ${answerSheetId}`);

      const answerSheet = await AnswerSheet.findById(answerSheetId);
      if (!answerSheet) {
        throw new Error('Answer sheet not found');
      }

      const unresolvedFlags = answerSheet.flags.filter(flag => !flag.resolved);
      
      for (const flag of unresolvedFlags) {
        flag.resolved = true;
        flag.resolvedBy = resolutionData.resolvedBy as any;
        flag.resolvedAt = new Date();
        if (resolutionData.resolutionNotes !== undefined) {
          flag.resolutionNotes = resolutionData.resolutionNotes;
        }
        flag.autoResolved = resolutionData.autoResolved || false;
      }

      await answerSheet.save();

      logger.info(`All flags resolved successfully for answer sheet: ${answerSheetId}`);

    } catch (error: unknown) {
      logger.error(`Error resolving all flags for answer sheet ${answerSheetId}:`, error);
      throw error;
    }
  }

  /**
   * Get flags for an answer sheet
   */
  static async getAnswerSheetFlags(answerSheetId: string): Promise<IAnswerSheetFlag[]> {
    try {
      const answerSheet = await AnswerSheet.findById(answerSheetId);
      if (!answerSheet) {
        throw new Error('Answer sheet not found');
      }

      return answerSheet.flags;

    } catch (error: unknown) {
      logger.error(`Error getting flags for answer sheet ${answerSheetId}:`, error);
      throw error;
    }
  }

  /**
   * Get flagged answer sheets for an exam
   */
  static async getFlaggedAnswerSheets(examId: string, filters?: {
    severity?: FlagSeverity;
    type?: FlagType;
    resolved?: boolean;
  }): Promise<any[]> {
    try {
      logger.info(`Getting flagged answer sheets for exam: ${examId}`);

      let query: any = {
        examId,
        flagCount: { $gt: 0 }
      };

      if (filters?.severity) {
        query['flags.severity'] = filters.severity;
      }

      if (filters?.type) {
        query['flags.type'] = filters.type;
      }

      if (filters?.resolved !== undefined) {
        query['flags.resolved'] = filters.resolved;
      }

      const answerSheets = await AnswerSheet.find(query)
        .populate('studentId', 'name rollNumber email')
        .populate('uploadedBy', 'name email')
        .sort({ lastFlaggedAt: -1 });

      return answerSheets;

    } catch (error: unknown) {
      logger.error(`Error getting flagged answer sheets for exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * Get flag statistics for an exam
   */
  static async getFlagStatistics(examId: string): Promise<FlagStatistics> {
    try {
      logger.info(`Getting flag statistics for exam: ${examId}`);

      const answerSheets = await AnswerSheet.find({ examId });
      
      let totalFlags = 0;
      let resolvedFlags = 0;
      let unresolvedFlags = 0;
      let criticalFlags = 0;
      const flagsByType: Record<FlagType, number> = {
        UNMATCHED_ROLL: 0,
        POOR_QUALITY: 0,
        MISSING_PAGES: 0,
        ALIGNMENT_ISSUE: 0,
        DUPLICATE_UPLOAD: 0,
        INVALID_FORMAT: 0,
        SIZE_TOO_LARGE: 0,
        CORRUPTED_FILE: 0,
        MANUAL_REVIEW_REQUIRED: 0
      };
      const flagsBySeverity: Record<FlagSeverity, number> = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0
      };

      let totalResolutionTime = 0;
      let resolvedFlagCount = 0;

      for (const answerSheet of answerSheets) {
        for (const flag of answerSheet.flags) {
          totalFlags++;
          flagsByType[flag.type]++;
          flagsBySeverity[flag.severity]++;

          if (flag.severity === 'CRITICAL') {
            criticalFlags++;
          }

          if (flag.resolved) {
            resolvedFlags++;
            if (flag.resolvedAt) {
              const resolutionTime = flag.resolvedAt.getTime() - flag.detectedAt.getTime();
              totalResolutionTime += resolutionTime;
              resolvedFlagCount++;
            }
          } else {
            unresolvedFlags++;
          }
        }
      }

      const averageResolutionTime = resolvedFlagCount > 0 
        ? totalResolutionTime / resolvedFlagCount / (1000 * 60 * 60) // Convert to hours
        : 0;

      const resolutionRate = totalFlags > 0 ? (resolvedFlags / totalFlags) * 100 : 0;

      return {
        totalFlags,
        resolvedFlags,
        unresolvedFlags,
        criticalFlags,
        flagsByType,
        flagsBySeverity,
        averageResolutionTime,
        resolutionRate
      };

    } catch (error: unknown) {
      logger.error(`Error getting flag statistics for exam ${examId}:`, error);
      throw error;
    }
  }

  /**
   * Auto-detect and add flags based on answer sheet analysis
   */
  static async autoDetectFlags(answerSheetId: string, analysisData: {
    rollNumberDetected?: string;
    rollNumberConfidence?: number;
    scanQuality?: string;
    isAligned?: boolean;
    fileSize?: number;
    fileFormat?: string;
  }): Promise<IAnswerSheetFlag[]> {
    try {
      logger.info(`Auto-detecting flags for answer sheet: ${answerSheetId}`);

      const flags: FlagCreationData[] = [];

      // Check roll number detection
      if (!analysisData.rollNumberDetected || (analysisData.rollNumberConfidence && analysisData.rollNumberConfidence < 70)) {
        flags.push({
          type: 'UNMATCHED_ROLL',
          severity: 'HIGH',
          description: 'Roll number not detected or low confidence',
          autoResolved: false
        });
      }

      // Check scan quality
      if (analysisData.scanQuality === 'POOR' || analysisData.scanQuality === 'UNREADABLE') {
        flags.push({
          type: 'POOR_QUALITY',
          severity: analysisData.scanQuality === 'UNREADABLE' ? 'CRITICAL' : 'HIGH',
          description: `Poor scan quality: ${analysisData.scanQuality}`,
          autoResolved: false
        });
      }

      // Check alignment
      if (analysisData.isAligned === false) {
        flags.push({
          type: 'ALIGNMENT_ISSUE',
          severity: 'MEDIUM',
          description: 'Answer sheet appears to be misaligned',
          autoResolved: false
        });
      }

      // Check file size
      if (analysisData.fileSize && analysisData.fileSize > 10 * 1024 * 1024) { // 10MB
        flags.push({
          type: 'SIZE_TOO_LARGE',
          severity: 'MEDIUM',
          description: 'File size exceeds recommended limit',
          autoResolved: false
        });
      }

      // Check file format
      if (analysisData.fileFormat && !['image/jpeg', 'image/png', 'application/pdf'].includes(analysisData.fileFormat)) {
        flags.push({
          type: 'INVALID_FORMAT',
          severity: 'HIGH',
          description: 'Unsupported file format',
          autoResolved: false
        });
      }

      // Add flags to answer sheet
      const addedFlags: IAnswerSheetFlag[] = [];
      for (const flagData of flags) {
        const flag = await this.addFlag(answerSheetId, flagData);
        addedFlags.push(flag);
      }

      logger.info(`Auto-detected ${addedFlags.length} flags for answer sheet: ${answerSheetId}`);
      return addedFlags;

    } catch (error: unknown) {
      logger.error(`Error auto-detecting flags for answer sheet ${answerSheetId}:`, error);
      throw error;
    }
  }

  /**
   * Bulk resolve flags for multiple answer sheets
   */
  static async bulkResolveFlags(answerSheetIds: string[], resolutionData: FlagResolutionData): Promise<void> {
    try {
      logger.info(`Bulk resolving flags for ${answerSheetIds.length} answer sheets`);

      const answerSheets = await AnswerSheet.find({ _id: { $in: answerSheetIds } });
      
      for (const answerSheet of answerSheets) {
        const unresolvedFlags = answerSheet.flags.filter(flag => !flag.resolved);
        
        for (const flag of unresolvedFlags) {
          flag.resolved = true;
          flag.resolvedBy = resolutionData.resolvedBy as any;
          flag.resolvedAt = new Date();
          if (resolutionData.resolutionNotes !== undefined) {
          flag.resolutionNotes = resolutionData.resolutionNotes;
        }
          flag.autoResolved = resolutionData.autoResolved || false;
        }
      }

      await AnswerSheet.bulkWrite(
        answerSheets.map(answerSheet => ({
          updateOne: {
            filter: { _id: answerSheet._id },
            update: { $set: { flags: answerSheet.flags } }
          }
        }))
      );

      logger.info(`Bulk resolved flags for ${answerSheetIds.length} answer sheets`);

    } catch (error: unknown) {
      logger.error(`Error bulk resolving flags:`, error);
      throw error;
    }
  }
}

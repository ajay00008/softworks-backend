import cron from 'node-cron';
import { CloudStorageService } from './cloudStorage.js';
import { AnswerSheet } from '../models/AnswerSheet.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface CleanupStats {
  filesDeleted: number;
  recordsUpdated: number;
  errors: string[];
  duration: number;
}

export class RetentionService {
  private cloudStorage: CloudStorageService;
  private isRunning: boolean = false;

  constructor() {
    this.cloudStorage = new CloudStorageService();
    this.scheduleCleanup();
  }

  /**
   * Schedule automatic cleanup based on cron expression
   */
  private scheduleCleanup(): void {
    const cronExpression = env.CLEANUP_SCHEDULE || '0 2 * * *'; // Daily at 2 AM
    
    cron.schedule(cronExpression, async () => {
      logger.info('Starting scheduled cleanup job');
      await this.performCleanup();
    });

    logger.info(`Cleanup job scheduled with expression: ${cronExpression}`);
  }

  /**
   * Perform cleanup of expired files and records
   */
  async performCleanup(): Promise<CleanupStats> {
    if (this.isRunning) {
      logger.warn('Cleanup job is already running, skipping');
      return {
        filesDeleted: 0,
        recordsUpdated: 0,
        errors: ['Cleanup job already running'],
        duration: 0
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const stats: CleanupStats = {
      filesDeleted: 0,
      recordsUpdated: 0,
      errors: [],
      duration: 0
    };

    try {
      logger.info('Starting retention policy cleanup');

      // 1. Clean up expired files from cloud storage
      const cloudCleanup = await this.cloudStorage.cleanupExpiredFiles();
      stats.filesDeleted = cloudCleanup.deleted;
      stats.errors.push(...cloudCleanup.errors);

      // 2. Update database records for deleted files
      const dbCleanup = await this.cleanupDatabaseRecords();
      stats.recordsUpdated = dbCleanup;

      // 3. Clean up old logs and temporary files
      await this.cleanupLogs();

      stats.duration = Date.now() - startTime;
      
      logger.info(`Cleanup completed in ${stats.duration}ms: ${stats.filesDeleted} files deleted, ${stats.recordsUpdated} records updated`);
      
      return stats;
    } catch (error) {
      const errorMsg = `Cleanup job failed: ${error.message}`;
      stats.errors.push(errorMsg);
      logger.error(errorMsg);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up database records for files that no longer exist
   */
  private async cleanupDatabaseRecords(): Promise<number> {
    try {
      const retentionDays = parseInt(env.FILE_RETENTION_DAYS || '365');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Find answer sheets that are older than retention period
      const expiredSheets = await AnswerSheet.find({
        uploadedAt: { $lt: cutoffDate },
        isActive: true
      });

      let updatedCount = 0;

      for (const sheet of expiredSheets) {
        try {
          // Mark as archived instead of deleting
          sheet.isActive = false;
          sheet.status = 'ARCHIVED';
          await sheet.save();
          updatedCount++;

          logger.info(`Archived answer sheet: ${sheet._id}`);
        } catch (error) {
          logger.error(`Error archiving answer sheet ${sheet._id}:`, error);
        }
      }

      return updatedCount;
    } catch (error) {
      logger.error('Error cleaning up database records:', error);
      throw error;
    }
  }

  /**
   * Clean up old log files
   */
  private async cleanupLogs(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const logsDir = './logs';
      const retentionDays = 30; // Keep logs for 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      try {
        const files = await fs.readdir(logsDir);
        
        for (const file of files) {
          if (file.endsWith('.log') || file.endsWith('.log.gz')) {
            const filePath = path.join(logsDir, file);
            const stats = await fs.stat(filePath);
            
            if (stats.mtime < cutoffDate) {
              await fs.unlink(filePath);
              logger.info(`Deleted old log file: ${file}`);
            }
          }
        }
      } catch (error) {
        // Logs directory might not exist, which is fine
        logger.debug('Logs directory not found or empty');
      }
    } catch (error) {
      logger.error('Error cleaning up logs:', error);
      // Don't throw error for log cleanup failures
    }
  }

  /**
   * Get retention policy statistics
   */
  async getRetentionStats(): Promise<{
    totalFiles: number;
    filesToDelete: number;
    oldestFile?: Date;
    retentionDays: number;
    nextCleanup?: Date;
  }> {
    try {
      const storageStats = await this.cloudStorage.getStorageStats();
      const filesToDelete = await this.cloudStorage.getFilesForDeletion();
      const retentionDays = parseInt(env.FILE_RETENTION_DAYS || '365');

      // Calculate next cleanup time
      const cronExpression = env.CLEANUP_SCHEDULE || '0 2 * * *';
      const nextCleanup = this.getNextCronTime(cronExpression);

      return {
        totalFiles: storageStats.totalFiles,
        filesToDelete: filesToDelete.length,
        oldestFile: storageStats.oldestFile,
        retentionDays,
        nextCleanup
      };
    } catch (error) {
      logger.error('Error getting retention stats:', error);
      throw new Error(`Failed to get retention stats: ${error.message}`);
    }
  }

  /**
   * Manually trigger cleanup (for testing or emergency cleanup)
   */
  async triggerCleanup(): Promise<CleanupStats> {
    logger.info('Manual cleanup triggered');
    return await this.performCleanup();
  }

  /**
   * Get next cron execution time
   */
  private getNextCronTime(cronExpression: string): Date | undefined {
    try {
      // This is a simplified implementation
      // In production, you might want to use a proper cron parser
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0); // Assuming 2 AM daily
      return tomorrow;
    } catch (error) {
      logger.error('Error calculating next cron time:', error);
      return undefined;
    }
  }

  /**
   * Check if cleanup is currently running
   */
  isCleanupRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get cleanup job status
   */
  getStatus(): {
    isRunning: boolean;
    lastRun?: Date;
    nextRun?: Date;
  } {
    return {
      isRunning: this.isRunning,
      nextRun: this.getNextCronTime(env.CLEANUP_SCHEDULE || '0 2 * * *')
    };
  }
}

export default RetentionService;

export interface CleanupStats {
    filesDeleted: number;
    recordsUpdated: number;
    errors: string[];
    duration: number;
}
export declare class RetentionService {
    private cloudStorage;
    private isRunning;
    constructor();
    /**
     * Schedule automatic cleanup based on cron expression
     */
    private scheduleCleanup;
    /**
     * Perform cleanup of expired files and records
     */
    performCleanup(): Promise<CleanupStats>;
    /**
     * Clean up database records for files that no longer exist
     */
    private cleanupDatabaseRecords;
    /**
     * Clean up old log files
     */
    private cleanupLogs;
    /**
     * Get retention policy statistics
     */
    getRetentionStats(): Promise<{
        totalFiles: number;
        filesToDelete: number;
        oldestFile?: Date;
        retentionDays: number;
        nextCleanup?: Date;
    }>;
    /**
     * Manually trigger cleanup (for testing or emergency cleanup)
     */
    triggerCleanup(): Promise<CleanupStats>;
    /**
     * Get next cron execution time
     */
    private getNextCronTime;
    /**
     * Check if cleanup is currently running
     */
    isCleanupRunning(): boolean;
    /**
     * Get cleanup job status
     */
    getStatus(): {
        isRunning: boolean;
        lastRun?: Date;
        nextRun?: Date;
    };
}
export default RetentionService;
//# sourceMappingURL=retentionService.d.ts.map
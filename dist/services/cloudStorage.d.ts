export interface CloudStorageResult {
    original: {
        url: string;
        key: string;
    };
    processed?: {
        url: string;
        key: string;
    };
    metadata: {
        uploadedAt: Date;
        fileSize: number;
        contentType: string;
        retentionDate: Date;
    };
}
export declare class CloudStorageService {
    private bucketName;
    constructor();
    /**
     * Upload answer sheet to cloud storage
     */
    uploadAnswerSheet(originalBuffer: Buffer, examId: string, studentId: string, originalFileName: string, processedBuffer?: Buffer): Promise<CloudStorageResult>;
    /**
     * Delete file from cloud storage
     */
    deleteFile(key: string): Promise<void>;
    /**
     * Schedule retention deletion job
     */
    scheduleRetentionDeletionJob(): Promise<void>;
}
//# sourceMappingURL=cloudStorage.d.ts.map
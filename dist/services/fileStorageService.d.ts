import multer from 'multer';
export interface FileUploadResult {
    fileName: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    uploadUrl: string;
}
export declare class FileStorageService {
    private static readonly PUBLIC_FOLDER;
    private static readonly BOOKS_FOLDER;
    private static readonly QUESTION_PAPERS_FOLDER;
    private static readonly UPLOADS_FOLDER;
    /**
     * Initialize the service by creating necessary directories
     */
    static initialize(): void;
    /**
     * Get multer configuration for book uploads
     */
    static getBookUploadConfig(): multer.Multer;
    /**
     * Get multer configuration for question paper PDF uploads
     */
    static getQuestionPaperUploadConfig(): multer.Multer;
    /**
     * Get multer configuration for general file uploads
     */
    static getGeneralUploadConfig(): multer.Multer;
    /**
     * Save file and return upload result
     */
    static saveFile(file: Express.Multer.File, folder: 'books' | 'question-papers' | 'uploads'): Promise<FileUploadResult>;
    /**
     * Get file download URL
     */
    static getFileUrl(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): string;
    /**
     * Get file path
     */
    static getFilePath(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): string;
    /**
     * Check if file exists
     */
    static fileExists(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): boolean;
    /**
     * Delete file
     */
    static deleteFile(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): Promise<boolean>;
    /**
     * Get file info
     */
    static getFileInfo(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): {
        fileName: string;
        filePath: string;
        fileSize: number;
        created: Date;
        modified: Date;
        url: string;
    } | null;
    /**
     * List files in a folder
     */
    static listFiles(folder: 'books' | 'question-papers' | 'uploads'): string[];
    /**
     * Get folder size
     */
    static getFolderSize(folder: 'books' | 'question-papers' | 'uploads'): number;
    /**
     * Clean up old files (older than specified days)
     */
    static cleanupOldFiles(folder: 'books' | 'question-papers' | 'uploads', daysOld?: number): Promise<number>;
    /**
     * Get storage statistics
     */
    static getStorageStats(): {
        books: {
            folder: string;
            size: number;
            fileCount: number;
        };
        questionPapers: {
            folder: string;
            size: number;
            fileCount: number;
        };
        uploads: {
            folder: string;
            size: number;
            fileCount: number;
        };
        total: {
            size: number;
            fileCount: number;
        };
    };
}
//# sourceMappingURL=fileStorageService.d.ts.map
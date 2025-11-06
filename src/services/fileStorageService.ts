import fs from 'fs';
import path from 'path';
import multer from 'multer';

export interface FileUploadResult {
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  uploadUrl: string;
}

export class FileStorageService {
  private static readonly PUBLIC_FOLDER = path.join(process.cwd(), 'public');
  private static readonly BOOKS_FOLDER = path.join(this.PUBLIC_FOLDER, 'books');
  private static readonly QUESTION_PAPERS_FOLDER = path.join(this.PUBLIC_FOLDER, 'question-papers');
  private static readonly UPLOADS_FOLDER = path.join(this.PUBLIC_FOLDER, 'uploads');

  /**
   * Initialize the service by creating necessary directories
   */
  static initialize() {
    // Create public folder if it doesn't exist
    if (!fs.existsSync(this.PUBLIC_FOLDER)) {
      fs.mkdirSync(this.PUBLIC_FOLDER, { recursive: true });
    }
    
    // Create books folder if it doesn't exist
    if (!fs.existsSync(this.BOOKS_FOLDER)) {
      fs.mkdirSync(this.BOOKS_FOLDER, { recursive: true });
    }
    
    // Create question-papers folder if it doesn't exist
    if (!fs.existsSync(this.QUESTION_PAPERS_FOLDER)) {
      fs.mkdirSync(this.QUESTION_PAPERS_FOLDER, { recursive: true });
    }
    
    // Create uploads folder if it doesn't exist
    if (!fs.existsSync(this.UPLOADS_FOLDER)) {
      fs.mkdirSync(this.UPLOADS_FOLDER, { recursive: true });
    }
  }

  /**
   * Get multer configuration for book uploads
   */
  static getBookUploadConfig() {
    this.initialize();
    
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.BOOKS_FOLDER);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `book-${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, fileName);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for books
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed for books') as any, false);
        }
      }
    });
  }

  /**
   * Get multer configuration for question paper PDF uploads
   */
  static getQuestionPaperUploadConfig() {
    this.initialize();
    
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.QUESTION_PAPERS_FOLDER);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `question-paper-${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, fileName);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for question papers
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed for question papers') as any, false);
        }
      }
    });
  }

  /**
   * Get multer configuration for general file uploads
   */
  static getGeneralUploadConfig() {
    this.initialize();
    
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.UPLOADS_FOLDER);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileName = `file-${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, fileName);
      }
    });

    return multer({
      storage: storage,
      limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit for general files
      }
    });
  }

  /**
   * Save file and return upload result
   */
  static async saveFile(
    file: Express.Multer.File,
    folder: 'books' | 'question-papers' | 'uploads'
  ): Promise<FileUploadResult> {
    this.initialize();
    
    const folderPath = path.join(this.PUBLIC_FOLDER, folder);
    const fileName = file.filename;
    const filePath = path.join(folderPath, fileName);
    const uploadUrl = `/${folder}/${fileName}`;

    return {
      fileName,
      originalName: file.originalname,
      filePath,
      fileSize: file.size,
      uploadUrl
    };
  }

  /**
   * Get file download URL
   */
  static getFileUrl(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): string {
    return `/${folder}/${fileName}`;
  }

  /**
   * Get file path
   */
  static getFilePath(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): string {
    return path.join(this.PUBLIC_FOLDER, folder, fileName);
  }

  /**
   * Check if file exists
   */
  static fileExists(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): boolean {
    const filePath = this.getFilePath(fileName, folder);
    return fs.existsSync(filePath);
  }

  /**
   * Delete file
   */
  static async deleteFile(fileName: string, folder: 'books' | 'question-papers' | 'uploads'): Promise<boolean> {
    try {
      const filePath = this.getFilePath(fileName, folder);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error: unknown) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Get file info
   */
  static getFileInfo(fileName: string, folder: 'books' | 'question-papers' | 'uploads') {
    try {
      const filePath = this.getFilePath(fileName, folder);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return {
          fileName,
          filePath,
          fileSize: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          url: this.getFileUrl(fileName, folder)
        };
      }
      return null;
    } catch (error: unknown) {
      console.error('Error getting file info:', error);
      return null;
    }
  }

  /**
   * List files in a folder
   */
  static listFiles(folder: 'books' | 'question-papers' | 'uploads'): string[] {
    try {
      const folderPath = path.join(this.PUBLIC_FOLDER, folder);
      if (fs.existsSync(folderPath)) {
        return fs.readdirSync(folderPath);
      }
      return [];
    } catch (error: unknown) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  /**
   * Get folder size
   */
  static getFolderSize(folder: 'books' | 'question-papers' | 'uploads'): number {
    try {
      const folderPath = path.join(this.PUBLIC_FOLDER, folder);
      if (!fs.existsSync(folderPath)) {
        return 0;
      }

      let totalSize = 0;
      const files = fs.readdirSync(folderPath);
      
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }
      
      return totalSize;
    } catch (error: unknown) {
      console.error('Error getting folder size:', error);
      return 0;
    }
  }

  /**
   * Clean up old files (older than specified days)
   */
  static async cleanupOldFiles(folder: 'books' | 'question-papers' | 'uploads', daysOld: number = 30): Promise<number> {
    try {
      const folderPath = path.join(this.PUBLIC_FOLDER, folder);
      if (!fs.existsSync(folderPath)) {
        return 0;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let deletedCount = 0;
      const files = fs.readdirSync(folderPath);
      
      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      return deletedCount;
    } catch (error: unknown) {
      console.error('Error cleaning up old files:', error);
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  static getStorageStats() {
    this.initialize();
    
    return {
      books: {
        folder: this.BOOKS_FOLDER,
        size: this.getFolderSize('books'),
        fileCount: this.listFiles('books').length
      },
      questionPapers: {
        folder: this.QUESTION_PAPERS_FOLDER,
        size: this.getFolderSize('question-papers'),
        fileCount: this.listFiles('question-papers').length
      },
      uploads: {
        folder: this.UPLOADS_FOLDER,
        size: this.getFolderSize('uploads'),
        fileCount: this.listFiles('uploads').length
      },
      total: {
        size: this.getFolderSize('books') + this.getFolderSize('question-papers') + this.getFolderSize('uploads'),
        fileCount: this.listFiles('books').length + this.listFiles('question-papers').length + this.listFiles('uploads').length
      }
    };
  }
}

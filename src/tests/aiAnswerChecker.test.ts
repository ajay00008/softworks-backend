import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AIAnswerCheckerService } from '../services/aiAnswerChecker';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { Question } from '../models/Question';

// Mock the models
jest.mock('../models/AnswerSheet');
jest.mock('../models/Exam');
jest.mock('../models/Question');

describe('AI Answer Checker Service', () => {
  let aiChecker: AIAnswerCheckerService;

  beforeEach(() => {
    aiChecker = AIAnswerCheckerService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('checkAnswerSheet', () => {
    it('should successfully check an answer sheet with AI', async () => {
      const mockAnswerSheet = {
        _id: 'answerSheetId',
        examId: 'examId',
        studentId: 'studentId',
        uploadedBy: 'teacherId',
        status: 'UPLOADED'
      };

      const mockExam = {
        _id: 'examId',
        questions: [
          {
            _id: 'question1',
            question: 'What is 2+2?',
            correctAnswer: '4',
            marks: 2
          },
          {
            _id: 'question2',
            question: 'What is the capital of India?',
            correctAnswer: 'New Delhi',
            marks: 3
          }
        ]
      };

      (AnswerSheet.findById as jest.Mock).mockResolvedValue(mockAnswerSheet);
      (Exam.findById as jest.Mock).mockResolvedValue(mockExam);

      const result = await aiChecker.checkAnswerSheet('answerSheetId');

      expect(result).toBeDefined();
      expect(result.answerSheetId).toBe('answerSheetId');
      expect(result.status).toBeOneOf(['SUCCESS', 'PARTIAL', 'FAILED']);
      expect(result.totalMarks).toBe(5); // 2 + 3
      expect(result.questionWiseResults).toHaveLength(2);
      expect(result.overallFeedback).toBeDefined();
      expect(result.strengths).toBeDefined();
      expect(result.weaknesses).toBeDefined();
      expect(result.suggestions).toBeDefined();
    });

    it('should handle missing answer sheet', async () => {
      (AnswerSheet.findById as jest.Mock).mockResolvedValue(null);

      await expect(aiChecker.checkAnswerSheet('nonexistent')).rejects.toThrow('Answer sheet not found');
    });

    it('should handle missing exam', async () => {
      const mockAnswerSheet = {
        _id: 'answerSheetId',
        examId: 'examId',
        studentId: 'studentId',
        uploadedBy: 'teacherId',
        status: 'UPLOADED'
      };

      (AnswerSheet.findById as jest.Mock).mockResolvedValue(mockAnswerSheet);
      (Exam.findById as jest.Mock).mockResolvedValue(null);

      await expect(aiChecker.checkAnswerSheet('answerSheetId')).rejects.toThrow('Exam or questions not found');
    });
  });

  describe('batchCheckAnswerSheets', () => {
    it('should process multiple answer sheets', async () => {
      const answerSheetIds = ['sheet1', 'sheet2', 'sheet3'];
      
      // Mock successful processing for all sheets
      jest.spyOn(aiChecker, 'checkAnswerSheet').mockResolvedValue({
        answerSheetId: 'sheet1',
        status: 'SUCCESS',
        confidence: 0.9,
        totalMarks: 10,
        obtainedMarks: 8,
        percentage: 80,
        questionWiseResults: [],
        overallFeedback: 'Good performance',
        strengths: ['Good understanding'],
        weaknesses: ['Needs improvement'],
        suggestions: ['Practice more'],
        processingTime: 1000
      });

      const results = await aiChecker.batchCheckAnswerSheets(answerSheetIds);

      expect(results).toHaveLength(3);
      expect(results[0].answerSheetId).toBe('sheet1');
      expect(results[0].status).toBe('SUCCESS');
    });

    it('should handle errors in batch processing', async () => {
      const answerSheetIds = ['sheet1', 'sheet2'];
      
      jest.spyOn(aiChecker, 'checkAnswerSheet')
        .mockResolvedValueOnce({
          answerSheetId: 'sheet1',
          status: 'SUCCESS',
          confidence: 0.9,
          totalMarks: 10,
          obtainedMarks: 8,
          percentage: 80,
          questionWiseResults: [],
          overallFeedback: 'Good',
          strengths: [],
          weaknesses: [],
          suggestions: [],
          processingTime: 1000
        })
        .mockRejectedValueOnce(new Error('Processing failed'));

      const results = await aiChecker.batchCheckAnswerSheets(answerSheetIds);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('SUCCESS');
      expect(results[1].status).toBe('FAILED');
      expect(results[1].errors).toContain('Processing failed');
    });
  });

  describe('getAIStats', () => {
    it('should return AI statistics for an exam', async () => {
      const mockAnswerSheets = [
        {
          aiCorrectionResults: {
            confidence: 0.8,
            percentage: 85,
            processingTime: 2000
          }
        },
        {
          aiCorrectionResults: {
            confidence: 0.9,
            percentage: 90,
            processingTime: 1500
          }
        }
      ];

      (AnswerSheet.find as jest.Mock).mockResolvedValue(mockAnswerSheets);

      const stats = await aiChecker.getAIStats('examId');

      expect(stats.totalProcessed).toBe(2);
      expect(stats.averageConfidence).toBe(0.85);
      expect(stats.averagePercentage).toBe(87.5);
      expect(stats.processingTime.average).toBe(1750);
    });

    it('should handle empty results', async () => {
      (AnswerSheet.find as jest.Mock).mockResolvedValue([]);

      const stats = await aiChecker.getAIStats('examId');

      expect(stats.totalProcessed).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.averagePercentage).toBe(0);
    });
  });
});

describe('Real-world Scenarios', () => {
  let aiChecker: AIAnswerCheckerService;

  beforeEach(() => {
    aiChecker = AIAnswerCheckerService.getInstance();
  });

  describe('Indian School Management Scenarios', () => {
    it('should handle CBSE exam answer sheets', async () => {
      // Simulate CBSE exam with multiple choice and subjective questions
      const mockAnswerSheet = {
        _id: 'cbse_sheet_1',
        examId: 'cbse_exam_1',
        studentId: 'student_123',
        uploadedBy: 'teacher_456',
        status: 'UPLOADED',
        language: 'ENGLISH'
      };

      const mockExam = {
        _id: 'cbse_exam_1',
        questions: [
          {
            _id: 'q1',
            question: 'What is the chemical formula of water?',
            correctAnswer: 'H2O',
            marks: 1,
            type: 'MCQ'
          },
          {
            _id: 'q2',
            question: 'Explain the process of photosynthesis.',
            correctAnswer: 'Photosynthesis is the process by which plants convert light energy into chemical energy...',
            marks: 5,
            type: 'SUBJECTIVE'
          }
        ]
      };

      (AnswerSheet.findById as jest.Mock).mockResolvedValue(mockAnswerSheet);
      (Exam.findById as jest.Mock).mockResolvedValue(mockExam);

      const result = await aiChecker.checkAnswerSheet('cbse_sheet_1');

      expect(result).toBeDefined();
      expect(result.questionWiseResults).toHaveLength(2);
      
      // Check that subjective questions get partial credit
      const subjectiveResult = result.questionWiseResults.find(q => q.maxMarks === 5);
      expect(subjectiveResult).toBeDefined();
      expect(subjectiveResult.partialCredit).toBeDefined();
    });

    it('should handle multilingual answer sheets', async () => {
      const mockAnswerSheet = {
        _id: 'multilingual_sheet_1',
        examId: 'exam_1',
        studentId: 'student_123',
        uploadedBy: 'teacher_456',
        status: 'UPLOADED',
        language: 'TAMIL'
      };

      const mockExam = {
        _id: 'exam_1',
        questions: [
          {
            _id: 'q1',
            question: 'What is 2+2?',
            correctAnswer: '4',
            marks: 2
          }
        ]
      };

      (AnswerSheet.findById as jest.Mock).mockResolvedValue(mockAnswerSheet);
      (Exam.findById as jest.Mock).mockResolvedValue(mockExam);

      const result = await aiChecker.checkAnswerSheet('multilingual_sheet_1');

      expect(result).toBeDefined();
      // Check that language detection is working
      const questionResult = result.questionWiseResults[0];
      expect(questionResult.languageDetected).toBeDefined();
    });

    it('should handle poor handwriting scenarios', async () => {
      const mockAnswerSheet = {
        _id: 'poor_handwriting_sheet',
        examId: 'exam_1',
        studentId: 'student_123',
        uploadedBy: 'teacher_456',
        status: 'UPLOADED'
      };

      const mockExam = {
        _id: 'exam_1',
        questions: [
          {
            _id: 'q1',
            question: 'What is the capital of India?',
            correctAnswer: 'New Delhi',
            marks: 2
          }
        ]
      };

      (AnswerSheet.findById as jest.Mock).mockResolvedValue(mockAnswerSheet);
      (Exam.findById as jest.Mock).mockResolvedValue(mockExam);

      const result = await aiChecker.checkAnswerSheet('poor_handwriting_sheet');

      expect(result).toBeDefined();
      expect(result.handwritingAnalysis).toBeDefined();
      expect(result.handwritingAnalysis.overallQuality).toBeOneOf(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']);
    });

    it('should provide academic insights for student improvement', async () => {
      const mockAnswerSheet = {
        _id: 'insights_sheet',
        examId: 'exam_1',
        studentId: 'student_123',
        uploadedBy: 'teacher_456',
        status: 'UPLOADED'
      };

      const mockExam = {
        _id: 'exam_1',
        questions: [
          {
            _id: 'q1',
            question: 'Solve: 2x + 3 = 7',
            correctAnswer: 'x = 2',
            marks: 3
          },
          {
            _id: 'q2',
            question: 'Explain the concept of algebra',
            correctAnswer: 'Algebra is a branch of mathematics...',
            marks: 5
          }
        ]
      };

      (AnswerSheet.findById as jest.Mock).mockResolvedValue(mockAnswerSheet);
      (Exam.findById as jest.Mock).mockResolvedValue(mockExam);

      const result = await aiChecker.checkAnswerSheet('insights_sheet');

      expect(result).toBeDefined();
      expect(result.academicInsights).toBeDefined();
      expect(result.academicInsights.subjectMastery).toBeOneOf(['EXCELLENT', 'GOOD', 'AVERAGE', 'NEEDS_IMPROVEMENT']);
      expect(result.academicInsights.conceptualUnderstanding).toBeGreaterThanOrEqual(0);
      expect(result.academicInsights.conceptualUnderstanding).toBeLessThanOrEqual(100);
    });

    it('should handle batch processing for large classes', async () => {
      const largeClassSize = 50;
      const answerSheetIds = Array.from({ length: largeClassSize }, (_, i) => `sheet_${i + 1}`);

      // Mock successful processing for all sheets
      jest.spyOn(aiChecker, 'checkAnswerSheet').mockImplementation(async (id) => ({
        answerSheetId: id,
        status: 'SUCCESS',
        confidence: 0.8 + Math.random() * 0.2,
        totalMarks: 100,
        obtainedMarks: 60 + Math.random() * 30,
        percentage: 60 + Math.random() * 30,
        questionWiseResults: [],
        overallFeedback: 'Good performance',
        strengths: ['Good understanding'],
        weaknesses: ['Needs improvement'],
        suggestions: ['Practice more'],
        processingTime: 1000 + Math.random() * 2000
      }));

      const results = await aiChecker.batchCheckAnswerSheets(answerSheetIds);

      expect(results).toHaveLength(largeClassSize);
      expect(results.every(r => r.status === 'SUCCESS')).toBe(true);
    });
  });
});

// Helper function for Jest
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});

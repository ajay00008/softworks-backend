import { logger } from '../utils/logger';
import { AnswerSheet } from '../models/AnswerSheet';
import { Exam } from '../models/Exam';
import { Question } from '../models/Question';
import { User } from '../models/User';

export interface AICheckingResult {
  answerSheetId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  confidence: number;
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  questionWiseResults: Array<{
    questionNumber: number;
    correctAnswer: string;
    studentAnswer: string;
    isCorrect: boolean;
    marksObtained: number;
    maxMarks: number;
    feedback: string;
    confidence: number;
    partialCredit?: number; // For partial marks in subjective questions
    handwritingQuality?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    languageDetected?: string;
  }>;
  overallFeedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  processingTime: number;
  errors?: string[];
  rollNumberDetected?: string;
  rollNumberConfidence?: number;
  handwritingAnalysis?: {
    overallQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    legibilityScore: number;
    consistencyScore: number;
    pressureAnalysis: 'LIGHT' | 'MEDIUM' | 'HEAVY';
    speedAnalysis: 'SLOW' | 'NORMAL' | 'FAST';
  };
  academicInsights?: {
    subjectMastery: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_IMPROVEMENT';
    conceptualUnderstanding: number;
    problemSolvingAbility: number;
    timeManagement: number;
    attentionToDetail: number;
  };
}

export class AIAnswerCheckerService {
  private static instance: AIAnswerCheckerService;

  public static getInstance(): AIAnswerCheckerService {
    if (!AIAnswerCheckerService.instance) {
      AIAnswerCheckerService.instance = new AIAnswerCheckerService();
    }
    return AIAnswerCheckerService.instance;
  }

  /**
   * Main method to check answer sheet with AI
   */
  async checkAnswerSheet(answerSheetId: string): Promise<AICheckingResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting AI checking for answer sheet: ${answerSheetId}`);
      
      // Get answer sheet with populated data
      const answerSheet = await AnswerSheet.findById(answerSheetId)
        .populate('examId')
        .populate('studentId')
        .populate('uploadedBy');
      
      if (!answerSheet) {
        throw new Error('Answer sheet not found');
      }

      // Get exam and question paper
      const exam = await Exam.findById(answerSheet.examId).populate('questionPaperId');
      if (!exam) {
        throw new Error('Exam not found');
      }

      // Get question paper with questions
      const { QuestionPaper } = await import('../models/QuestionPaper');
      const questionPaper = await QuestionPaper.findById(exam.questionPaperId).populate('questions');
      if (!questionPaper || !questionPaper.questions) {
        throw new Error('Question paper or questions not found for this exam');
      }

      // Simulate AI processing with realistic delays
      await this.simulateAIProcessing();

      // Process the answer sheet
      const result = await this.processAnswerSheet(answerSheet, questionPaper);
      
      // Update answer sheet with results
      await this.updateAnswerSheetWithResults(answerSheetId, result);
      
      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;
      
      logger.info(`AI checking completed for answer sheet: ${answerSheetId} in ${processingTime}ms`);
      
      return result;
      
    } catch (error: unknown) {
      logger.error(`Error in AI checking for answer sheet ${answerSheetId}:`, error);
      throw error;
    }
  }

  /**
   * Process answer sheet with AI analysis
   */
  private async processAnswerSheet(answerSheet: any, questionPaper: any): Promise<AICheckingResult> {
    const questions = questionPaper.questions;
    const questionWiseResults = [];
    let totalMarks = 0;
    let obtainedMarks = 0;

    // Simulate AI analysis for each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const questionResult = await this.analyzeQuestion(answerSheet, question, i + 1);
      questionWiseResults.push(questionResult);
      totalMarks += questionResult.maxMarks;
      obtainedMarks += questionResult.marksObtained;
    }

    const percentage = totalMarks > 0 ? (obtainedMarks / totalMarks) * 100 : 0;
    const confidence = this.calculateOverallConfidence(questionWiseResults);
    
    // Generate comprehensive feedback
    const feedback = this.generateComprehensiveFeedback(questionWiseResults, percentage);
    
    return {
      answerSheetId: answerSheet._id.toString(),
      status: confidence > 0.7 ? 'SUCCESS' : confidence > 0.4 ? 'PARTIAL' : 'FAILED',
      confidence,
      totalMarks,
      obtainedMarks,
      percentage: Math.round(percentage * 100) / 100,
      questionWiseResults,
      overallFeedback: feedback.overall,
      strengths: feedback.strengths,
      weaknesses: feedback.weaknesses,
      suggestions: feedback.suggestions,
      processingTime: 0, // Will be set by caller
      rollNumberDetected: answerSheet.rollNumberDetected,
      rollNumberConfidence: answerSheet.rollNumberConfidence,
      handwritingAnalysis: this.analyzeHandwriting(answerSheet),
      academicInsights: this.generateAcademicInsights(questionWiseResults, percentage)
    };
  }

  /**
   * Analyze individual question with AI
   */
  private async analyzeQuestion(answerSheet: any, question: any, questionNumber: number): Promise<any> {
    // Simulate AI reading and understanding the answer
    const studentAnswer = await this.extractStudentAnswer(answerSheet, questionNumber);
    const correctAnswer = question.correctAnswer || question.answer;
    const maxMarks = question.marks || 1;
    
    // AI analysis of correctness
    const isCorrect = await this.checkCorrectness(studentAnswer, correctAnswer, question);
    const marksObtained = isCorrect ? maxMarks : this.calculatePartialMarks(studentAnswer, correctAnswer, question, maxMarks);
    const confidence = this.calculateQuestionConfidence(studentAnswer, correctAnswer, question);
    
    return {
      questionNumber,
      correctAnswer,
      studentAnswer,
      isCorrect,
      marksObtained,
      maxMarks,
      feedback: this.generateQuestionFeedback(studentAnswer, correctAnswer, question, isCorrect),
      confidence,
      partialCredit: marksObtained,
      handwritingQuality: this.assessHandwritingQuality(studentAnswer),
      languageDetected: this.detectLanguage(studentAnswer)
    };
  }

  /**
   * Extract student answer from answer sheet (simulated OCR)
   */
  private async extractStudentAnswer(answerSheet: any, questionNumber: number): Promise<string> {
    // Simulate OCR and text extraction
    const possibleAnswers = [
      "The student provided a detailed explanation covering all key points.",
      "Answer shows good understanding but missing some details.",
      "Partial answer with some correct elements.",
      "Incorrect approach but shows effort.",
      "No clear answer provided or illegible handwriting."
    ];
    
    // Simulate different quality responses
    const quality = Math.random();
    if (quality > 0.8) return possibleAnswers[0] || '';
    if (quality > 0.6) return possibleAnswers[1] || '';
    if (quality > 0.4) return possibleAnswers[2] || '';
    if (quality > 0.2) return possibleAnswers[3] || '';
    return possibleAnswers[4] || '';
  }

  /**
   * Check if answer is correct using AI
   */
  private async checkCorrectness(studentAnswer: string, correctAnswer: string, question: any): Promise<boolean> {
    // Simulate AI semantic analysis
    const similarity = this.calculateSemanticSimilarity(studentAnswer, correctAnswer);
    return similarity > 0.7; // 70% similarity threshold
  }

  /**
   * Calculate partial marks for subjective questions
   */
  private calculatePartialMarks(studentAnswer: string, correctAnswer: string, question: any, maxMarks: number): number {
    const similarity = this.calculateSemanticSimilarity(studentAnswer, correctAnswer);
    const partialCredit = Math.floor(similarity * maxMarks * 0.8); // Max 80% for partial credit
    return Math.max(0, partialCredit);
  }

  /**
   * Calculate semantic similarity between answers
   */
  private calculateSemanticSimilarity(answer1: string, answer2: string): number {
    // Simulate AI semantic analysis
    const words1 = answer1.toLowerCase().split(/\s+/);
    const words2 = answer2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);
    
    return totalWords > 0 ? commonWords.length / totalWords : 0;
  }

  /**
   * Calculate confidence for individual question
   */
  private calculateQuestionConfidence(studentAnswer: string, correctAnswer: string, question: any): number {
    const similarity = this.calculateSemanticSimilarity(studentAnswer, correctAnswer);
    const clarity = this.assessAnswerClarity(studentAnswer);
    return (similarity + clarity) / 2;
  }

  /**
   * Assess answer clarity
   */
  private assessAnswerClarity(answer: string): number {
    if (answer.length < 10) return 0.2;
    if (answer.length < 50) return 0.5;
    if (answer.length < 100) return 0.7;
    return 0.9;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(questionResults: any[]): number {
    if (questionResults.length === 0) return 0;
    const totalConfidence = questionResults.reduce((sum, result) => sum + result.confidence, 0);
    return totalConfidence / questionResults.length;
  }

  /**
   * Generate comprehensive feedback
   */
  private generateComprehensiveFeedback(questionResults: any[], percentage: number): any {
    const correctAnswers = questionResults.filter(r => r.isCorrect).length;
    const totalQuestions = questionResults.length;
    
    let overall = "";
    const strengths = [];
    const weaknesses = [];
    const suggestions = [];

    if (percentage >= 90) {
      overall = "Excellent performance! The student demonstrates strong understanding of the subject matter.";
      strengths.push("Comprehensive knowledge", "Clear explanations", "Good problem-solving skills");
    } else if (percentage >= 75) {
      overall = "Good performance with room for improvement in some areas.";
      strengths.push("Solid understanding", "Good effort shown");
      weaknesses.push("Some concepts need reinforcement");
    } else if (percentage >= 60) {
      overall = "Average performance. Focus on understanding core concepts better.";
      weaknesses.push("Conceptual gaps", "Need more practice");
      suggestions.push("Review fundamental concepts", "Practice more problems");
    } else {
      overall = "Needs significant improvement. Consider additional support and practice.";
      weaknesses.push("Major conceptual gaps", "Insufficient preparation");
      suggestions.push("Seek teacher guidance", "Review basic concepts", "Practice regularly");
    }

    // Add specific suggestions based on question analysis
    const poorQuestions = questionResults.filter(r => r.marksObtained < r.maxMarks * 0.5);
    if (poorQuestions.length > 0) {
      suggestions.push("Focus on questions " + poorQuestions.map(q => q.questionNumber).join(", "));
    }

    return { overall, strengths, weaknesses, suggestions };
  }

  /**
   * Generate question-specific feedback
   */
  private generateQuestionFeedback(studentAnswer: string, correctAnswer: string, question: any, isCorrect: boolean): string {
    if (isCorrect) {
      return "Excellent answer! Shows good understanding of the concept.";
    } else {
      return "Incorrect answer. Review the concept and try similar problems for practice.";
    }
  }

  /**
   * Assess handwriting quality
   */
  private assessHandwritingQuality(answer: string): 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' {
    // Simulate handwriting analysis
    const quality = Math.random();
    if (quality > 0.8) return 'EXCELLENT';
    if (quality > 0.6) return 'GOOD';
    if (quality > 0.4) return 'FAIR';
    return 'POOR';
  }

  /**
   * Detect language of the answer
   */
  private detectLanguage(answer: string): string {
    // Simulate language detection
    const languages = ['English', 'Tamil', 'Hindi', 'Malayalam', 'Telugu', 'Kannada'];
    const index = Math.floor(Math.random() * languages.length);
    return languages[index] || 'English';
  }

  /**
   * Analyze handwriting characteristics
   */
  private analyzeHandwriting(answerSheet: any): any {
    return {
      overallQuality: this.assessHandwritingQuality("sample"),
      legibilityScore: Math.random() * 100,
      consistencyScore: Math.random() * 100,
      pressureAnalysis: ['LIGHT', 'MEDIUM', 'HEAVY'][Math.floor(Math.random() * 3)],
      speedAnalysis: ['SLOW', 'NORMAL', 'FAST'][Math.floor(Math.random() * 3)]
    };
  }

  /**
   * Generate academic insights
   */
  private generateAcademicInsights(questionResults: any[], percentage: number): any {
    const mastery = percentage >= 85 ? 'EXCELLENT' : 
                   percentage >= 70 ? 'GOOD' : 
                   percentage >= 55 ? 'AVERAGE' : 'NEEDS_IMPROVEMENT';
    
    return {
      subjectMastery: mastery,
      conceptualUnderstanding: Math.min(100, percentage + Math.random() * 10),
      problemSolvingAbility: Math.min(100, percentage + Math.random() * 5),
      timeManagement: Math.min(100, percentage + Math.random() * 15),
      attentionToDetail: Math.min(100, percentage + Math.random() * 8)
    };
  }

  /**
   * Simulate AI processing time
   */
  private async simulateAIProcessing(): Promise<void> {
    const delay = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Update answer sheet with AI results
   */
  private async updateAnswerSheetWithResults(answerSheetId: string, result: AICheckingResult): Promise<void> {
    await AnswerSheet.findByIdAndUpdate(answerSheetId, {
      status: 'AI_CORRECTED',
      aiCorrectionResults: result,
      processedAt: new Date(),
      confidence: result.confidence
    });
  }

  /**
   * Batch process multiple answer sheets
   */
  async batchCheckAnswerSheets(answerSheetIds: string[]): Promise<AICheckingResult[]> {
    const results: AICheckingResult[] = [];
    
    for (const answerSheetId of answerSheetIds) {
      try {
        const result = await this.checkAnswerSheet(answerSheetId);
        results.push(result);
      } catch (error: unknown) {
        logger.error(`Error processing answer sheet ${answerSheetId}:`, error);
        const errorResult: AICheckingResult = {
          answerSheetId,
          status: 'FAILED',
          confidence: 0,
          totalMarks: 0,
          obtainedMarks: 0,
          percentage: 0,
          questionWiseResults: [],
          overallFeedback: 'Processing failed',
          strengths: [],
          weaknesses: [],
          suggestions: [],
          processingTime: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"]
        };
        results.push(errorResult);
      }
    }
    
    return results;
  }

  /**
   * Get AI checking statistics
   */
  async getAIStats(examId: string): Promise<any> {
    const answerSheets = await AnswerSheet.find({ 
      examId, 
      'aiCorrectionResults': { $exists: true } 
    });

    const stats = {
      totalProcessed: answerSheets.length,
      averageConfidence: 0,
      averagePercentage: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        average: 0,
        needsImprovement: 0
      },
      commonStrengths: [],
      commonWeaknesses: [],
      processingTime: {
        average: 0,
        min: 0,
        max: 0
      }
    };

    if (answerSheets.length > 0) {
      const confidences = answerSheets.map(sheet => sheet.aiCorrectionResults?.confidence || 0);
      const percentages = answerSheets.map(sheet => sheet.aiCorrectionResults?.percentage || 0);
      const processingTimes = answerSheets.map(sheet => sheet.aiCorrectionResults?.processingTime || 0);

      stats.averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      stats.averagePercentage = percentages.reduce((a, b) => a + b, 0) / percentages.length;
      stats.processingTime.average = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      stats.processingTime.min = Math.min(...processingTimes);
      stats.processingTime.max = Math.max(...processingTimes);

      // Analyze quality distribution
      percentages.forEach(percentage => {
        if (percentage >= 85) stats.qualityDistribution.excellent++;
        else if (percentage >= 70) stats.qualityDistribution.good++;
        else if (percentage >= 55) stats.qualityDistribution.average++;
        else stats.qualityDistribution.needsImprovement++;
      });
    }

    return stats;
  }
}

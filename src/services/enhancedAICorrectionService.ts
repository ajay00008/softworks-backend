import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger';

export interface AICorrectionRequest {
  answerSheetId: string;
  examId: string;
  studentId: string;
  questionPaper: {
    questions: Array<{
      questionNumber: number;
      questionText: string;
      correctAnswer: string;
      maxMarks: number;
      questionType: string;
      subjectType?: 'MATHEMATICS' | 'SCIENCE' | 'LANGUAGE' | 'SOCIAL_STUDIES' | 'OTHER';
      requiresSteps?: boolean;
    }>;
    totalMarks: number;
    subjectName?: string;
    syllabus?: string;
  };
  answerSheetImage: string; // Base64 or URL
  language?: 'ENGLISH' | 'TAMIL' | 'HINDI' | 'MALAYALAM' | 'TELUGU' | 'KANNADA' | 'FRENCH';
  evaluationSettings?: {
    spellingMistakesPenalty: number; // Percentage deduction for spelling mistakes
    stepMistakesPenalty: number; // Percentage deduction for step mistakes
    diagramMistakesPenalty: number; // Percentage deduction for diagram mistakes
    missingKeywordsPenalty: number; // Percentage deduction for missing important words
    handwritingQualityWeight: number; // Weight for handwriting quality
    partialCreditEnabled: boolean;
    alternativeAnswersAccepted: boolean;
  };
}

export interface StepMarks {
  stepNumber: number;
  stepDescription: string;
  marksAwarded: number;
  maxMarks: number;
  feedback: string;
}

export interface AICorrectionResult {
  answerSheetId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
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
    stepMarks?: StepMarks[]; // For step-by-step marking
    deductions: {
      spellingMistakes: number;
      stepMistakes: number;
      diagramMistakes: number;
      missingKeywords: number;
      handwritingQuality: number;
    };
    alternativeAnswers?: string[]; // Accepted alternative answers
    handwritingQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    languageDetected: string;
    spellingErrors: string[];
    grammarErrors: string[];
  }>;
  overallFeedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  performanceAnalysis: {
    subjectMastery: number; // Percentage
    problemSolvingSkills: number;
    conceptualUnderstanding: number;
    applicationSkills: number;
    areasOfExcellence: string[];
    areasNeedingImprovement: string[];
    unansweredQuestions: number[];
    partiallyAnsweredQuestions: number[];
    irrelevantAnswers: number[];
  };
  processingTime: number;
  errors?: string[];
  warnings?: string[];
}

export class EnhancedAICorrectionService {
  private static genAI: GoogleGenerativeAI;
  private static model: any;

  // Language-specific prompts and configurations
  private static languageConfigs = {
    ENGLISH: {
      spellingCheck: true,
      grammarCheck: true,
      alternativePhrases: true
    },
    TAMIL: {
      spellingCheck: true,
      grammarCheck: true,
      alternativePhrases: true,
      scriptType: 'TAMIL'
    },
    HINDI: {
      spellingCheck: true,
      grammarCheck: true,
      alternativePhrases: true,
      scriptType: 'DEVANAGARI'
    },
    MALAYALAM: {
      spellingCheck: true,
      grammarCheck: true,
      alternativePhrases: true,
      scriptType: 'MALAYALAM'
    },
    TELUGU: {
      spellingCheck: true,
      grammarCheck: true,
      alternativePhrases: true,
      scriptType: 'TELUGU'
    },
    KANNADA: {
      spellingCheck: true,
      grammarCheck: true,
      alternativePhrases: true,
      scriptType: 'KANNADA'
    },
    FRENCH: {
      spellingCheck: true,
      grammarCheck: true,
      alternativePhrases: true,
      scriptType: 'LATIN'
    }
  };

  /**
   * Initialize the enhanced AI correction service
   */
  static initialize() {
    try {
      this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '');
      this.model = this.genAI.getGenerativeModel({ 
        model: env.AI_MODEL || 'gemini-2.0-flash-exp' 
      });
      logger.info('Enhanced AI Correction Service initialized with Gemini');
    } catch (error: unknown) {
      logger.error('Failed to initialize Enhanced AI Correction Service:', error);
      throw new Error('Failed to initialize Enhanced AI Correction Service');
    }
  }

  /**
   * Process answer sheet with enhanced AI correction
   */
  static async processAnswerSheet(request: AICorrectionRequest): Promise<AICorrectionResult> {
    try {
      const startTime = Date.now();
      
      // Initialize if not already done
      if (!this.genAI) {
        this.initialize();
      }

      logger.info(`Starting enhanced AI correction for answer sheet: ${request.answerSheetId}`);

      // Create the enhanced correction prompt
      const prompt = this.createEnhancedCorrectionPrompt(request);

      // Generate correction using Gemini
      const result = await this.model.generateContent([
        {
          text: prompt
        },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: request.answerSheetImage.replace(/^data:image\/[a-z]+;base64,/, "")
          }
        }
      ]);

      const response = await result.response;
      const correctionText = response.text();

      // Parse the AI response
      const correctionResult = this.parseEnhancedCorrectionResponse(correctionText, request);
      
      const processingTime = Date.now() - startTime;
      
      logger.info(`Enhanced AI correction completed for answer sheet: ${request.answerSheetId} in ${processingTime}ms`);

      return {
        ...correctionResult,
        processingTime
      };

    } catch (error: unknown) {
      logger.error('Error processing answer sheet with enhanced AI:', error);
      throw new Error(`Enhanced AI correction failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create comprehensive prompt for enhanced answer sheet correction
   */
  private static createEnhancedCorrectionPrompt(request: AICorrectionRequest): string {
    const { questionPaper, language = 'ENGLISH', evaluationSettings } = request;
    const langConfig = this.languageConfigs[language];
    
    return `You are an expert educational AI assistant specialized in correcting answer sheets with human-like sensitivity and understanding. Please analyze the provided answer sheet image and correct it according to the question paper.

QUESTION PAPER DETAILS:
${questionPaper.questions.map(q => `
Question ${q.questionNumber}: ${q.questionText}
Correct Answer: ${q.correctAnswer}
Maximum Marks: ${q.maxMarks}
Type: ${q.questionType}
Subject Type: ${q.subjectType || 'GENERAL'}
Requires Steps: ${q.requiresSteps ? 'YES' : 'NO'}
`).join('\n')}

TOTAL MARKS: ${questionPaper.totalMarks}
SUBJECT: ${questionPaper.subjectName || 'General'}
LANGUAGE: ${language}
SCRIPT TYPE: ${(langConfig as any)?.scriptType || 'LATIN'}

EVALUATION SETTINGS:
- Spelling Mistakes Penalty: ${evaluationSettings?.spellingMistakesPenalty || 5}%
- Step Mistakes Penalty: ${evaluationSettings?.stepMistakesPenalty || 10}%
- Diagram Mistakes Penalty: ${evaluationSettings?.diagramMistakesPenalty || 15}%
- Missing Keywords Penalty: ${evaluationSettings?.missingKeywordsPenalty || 8}%
- Handwriting Quality Weight: ${evaluationSettings?.handwritingQualityWeight || 5}%
- Partial Credit Enabled: ${evaluationSettings?.partialCreditEnabled ? 'YES' : 'NO'}
- Alternative Answers Accepted: ${evaluationSettings?.alternativeAnswersAccepted ? 'YES' : 'NO'}

CORRECTION INSTRUCTIONS:

1. LANGUAGE-SPECIFIC CORRECTION:
   - Detect and preserve the student's native language (${language})
   - DO NOT correct spelling mistakes - preserve student's original spelling
   - Accept alternative phrasings and expressions in ${language}
   - Consider cultural context and local expressions
   - For ${language} answers, focus on meaning rather than exact word matching

2. HUMAN-LIKE SENSITIVITY:
   - Understand that students may express correct answers differently
   - Accept alternative correct answers and phrasings
   - Consider partial understanding and award partial credit
   - Be empathetic to student effort and learning process
   - Focus on conceptual understanding rather than exact wording

3. STEP-BY-STEP MARKING (for Mathematics, Science, etc.):
   - Break down multi-step problems into individual steps
   - Award marks for each correct step
   - Identify where the student went wrong in the process
   - Provide specific feedback for each step
   - Consider alternative solution methods

4. SUBJECT-SPECIFIC EVALUATION:
   - Mathematics: Focus on methodology, steps, and logical reasoning
   - Science: Consider scientific concepts and practical understanding
   - Languages: Focus on comprehension, expression, and communication
   - Social Studies: Consider analytical thinking and factual accuracy

5. HANDWRITING AND PRESENTATION:
   - Assess handwriting quality but don't penalize for poor handwriting
   - Consider neatness and organization
   - Look for diagrams, charts, and visual elements
   - Evaluate overall presentation quality

6. COMPREHENSIVE FEEDBACK:
   - Provide specific feedback for each question
   - Identify student strengths and areas for improvement
   - Suggest specific learning strategies
   - Highlight unanswered or partially answered questions
   - Identify irrelevant or off-topic answers

Please provide your correction in the following JSON format:
{
  "confidence": 0.95,
  "totalMarks": ${questionPaper.totalMarks},
  "obtainedMarks": 0,
  "percentage": 0,
  "questionWiseResults": [
    {
      "questionNumber": 1,
      "correctAnswer": "Correct answer from question paper",
      "studentAnswer": "What student wrote (preserve original spelling)",
      "isCorrect": true,
      "marksObtained": 2,
      "maxMarks": 2,
      "feedback": "Detailed feedback for this question",
      "confidence": 0.9,
      "stepMarks": [
        {
          "stepNumber": 1,
          "stepDescription": "Understanding the problem",
          "marksAwarded": 1,
          "maxMarks": 1,
          "feedback": "Good understanding of the problem"
        }
      ],
      "deductions": {
        "spellingMistakes": 0,
        "stepMistakes": 0,
        "diagramMistakes": 0,
        "missingKeywords": 0,
        "handwritingQuality": 0
      },
      "alternativeAnswers": ["Alternative correct answers"],
      "handwritingQuality": "GOOD",
      "languageDetected": "${language}",
      "spellingErrors": [],
      "grammarErrors": []
    }
  ],
  "overallFeedback": "Overall performance feedback",
  "strengths": ["List of student strengths"],
  "weaknesses": ["List of areas needing improvement"],
  "suggestions": ["Specific suggestions for improvement"],
  "performanceAnalysis": {
    "subjectMastery": 75,
    "problemSolvingSkills": 80,
    "conceptualUnderstanding": 70,
    "applicationSkills": 65,
    "areasOfExcellence": ["Specific areas where student excels"],
    "areasNeedingImprovement": ["Specific areas needing work"],
    "unansweredQuestions": [3, 7],
    "partiallyAnsweredQuestions": [2, 5],
    "irrelevantAnswers": [4]
  }
}

IMPORTANT GUIDELINES:
- Be fair, consistent, and empathetic in marking
- Preserve student's original spelling and language
- Focus on understanding rather than exact word matching
- Provide constructive and encouraging feedback
- Consider the student's learning journey and effort
- Award partial credit generously where appropriate
- Identify both strengths and areas for improvement
- Be culturally sensitive to ${language} expressions and context`;
  }

  /**
   * Parse enhanced AI response into structured correction result
   */
  private static parseEnhancedCorrectionResponse(response: string, request: AICorrectionRequest): Omit<AICorrectionResult, 'processingTime'> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const correctionData = JSON.parse(jsonMatch[0]);
      
      return {
        answerSheetId: request.answerSheetId,
        status: 'COMPLETED',
        confidence: correctionData.confidence || 0.8,
        totalMarks: correctionData.totalMarks || request.questionPaper.totalMarks,
        obtainedMarks: correctionData.obtainedMarks || 0,
        percentage: correctionData.percentage || 0,
        questionWiseResults: correctionData.questionWiseResults || [],
        overallFeedback: correctionData.overallFeedback || 'No feedback provided',
        strengths: correctionData.strengths || [],
        weaknesses: correctionData.weaknesses || [],
        suggestions: correctionData.suggestions || [],
        performanceAnalysis: correctionData.performanceAnalysis || {
          subjectMastery: 0,
          problemSolvingSkills: 0,
          conceptualUnderstanding: 0,
          applicationSkills: 0,
          areasOfExcellence: [],
          areasNeedingImprovement: [],
          unansweredQuestions: [],
          partiallyAnsweredQuestions: [],
          irrelevantAnswers: []
        }
      };

    } catch (error: unknown) {
      logger.error('Error parsing enhanced AI correction response:', error);
      
      // Return fallback result
      return {
        answerSheetId: request.answerSheetId,
        status: 'FAILED',
        confidence: 0.1,
        totalMarks: request.questionPaper.totalMarks,
        obtainedMarks: 0,
        percentage: 0,
        questionWiseResults: [],
        overallFeedback: 'Enhanced AI correction failed. Please review manually.',
        strengths: [],
        weaknesses: ['Unable to process with enhanced AI'],
        suggestions: ['Manual review required'],
        performanceAnalysis: {
          subjectMastery: 0,
          problemSolvingSkills: 0,
          conceptualUnderstanding: 0,
          applicationSkills: 0,
          areasOfExcellence: [],
          areasNeedingImprovement: ['Unable to process with AI'],
          unansweredQuestions: [],
          partiallyAnsweredQuestions: [],
          irrelevantAnswers: []
        },
        errors: [`Failed to parse enhanced AI response: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Learn from manual corrections to improve future AI corrections
   */
  static async learnFromManualCorrection(
    answerSheetId: string,
    manualCorrection: any,
    originalAICorrection: AICorrectionResult
  ): Promise<void> {
    try {
      // This would typically save the manual correction data
      // and use it to improve future AI corrections
      logger.info(`Learning from manual correction for answer sheet: ${answerSheetId}`);
      
      // Store the learning data for future reference
      // This could be implemented with a learning database or ML model
      
    } catch (error: unknown) {
      logger.error('Error learning from manual correction:', error);
    }
  }

  /**
   * Generate enhanced mock correction for testing
   */
  static async generateEnhancedMockCorrection(request: AICorrectionRequest): Promise<AICorrectionResult> {
    const { questionPaper, language = 'ENGLISH' } = request;
    
    // Generate mock results with enhanced features
    const questionWiseResults = questionPaper.questions.map((q, index) => ({
      questionNumber: q.questionNumber,
      correctAnswer: q.correctAnswer,
      studentAnswer: `Mock student answer ${index + 1} in ${language}`,
      isCorrect: Math.random() > 0.3, // 70% correct rate
      marksObtained: Math.random() > 0.3 ? q.maxMarks : Math.floor(q.maxMarks * 0.5),
      maxMarks: q.maxMarks,
      feedback: `Enhanced mock feedback for question ${q.questionNumber}`,
      confidence: 0.8 + Math.random() * 0.2,
      stepMarks: q.requiresSteps ? [
        {
          stepNumber: 1,
          stepDescription: "Understanding the problem",
          marksAwarded: Math.floor(q.maxMarks * 0.3),
          maxMarks: Math.floor(q.maxMarks * 0.3),
          feedback: "Good understanding"
        },
        {
          stepNumber: 2,
          stepDescription: "Applying the method",
          marksAwarded: Math.floor(q.maxMarks * 0.4),
          maxMarks: Math.floor(q.maxMarks * 0.4),
          feedback: "Correct method applied"
        },
        {
          stepNumber: 3,
          stepDescription: "Final answer",
          marksAwarded: Math.floor(q.maxMarks * 0.3),
          maxMarks: Math.floor(q.maxMarks * 0.3),
          feedback: "Correct final answer"
        }
      ] : undefined,
      deductions: {
        spellingMistakes: Math.random() * 2,
        stepMistakes: Math.random() * 3,
        diagramMistakes: Math.random() * 1,
        missingKeywords: Math.random() * 2,
        handwritingQuality: Math.random() * 1
      },
      alternativeAnswers: [`Alternative answer ${index + 1}`],
      handwritingQuality: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'][Math.floor(Math.random() * 4)] as any,
      languageDetected: language,
      spellingErrors: [],
      grammarErrors: []
    }));

    const totalObtained = questionWiseResults.reduce((sum, q) => sum + q.marksObtained, 0);
    const percentage = (totalObtained / questionPaper.totalMarks) * 100;

    return {
      answerSheetId: request.answerSheetId,
      status: 'COMPLETED',
      confidence: 0.85,
      totalMarks: questionPaper.totalMarks,
      obtainedMarks: totalObtained,
      percentage: Math.round(percentage * 100) / 100,
      questionWiseResults: questionWiseResults.map(qwr => ({
        ...qwr,
        stepMarks: qwr.stepMarks || []
      })),
      overallFeedback: `Enhanced mock AI correction completed in ${language}. This is a test result with advanced features.`,
      strengths: ['Good understanding of basic concepts', 'Clear handwriting', 'Good problem-solving approach'],
      weaknesses: ['Needs improvement in complex problems', 'Minor calculation errors', 'Could improve presentation'],
      suggestions: ['Practice more complex problems', 'Double-check calculations', 'Improve handwriting clarity'],
      performanceAnalysis: {
        subjectMastery: 75 + Math.random() * 20,
        problemSolvingSkills: 70 + Math.random() * 25,
        conceptualUnderstanding: 80 + Math.random() * 15,
        applicationSkills: 65 + Math.random() * 30,
        areasOfExcellence: ['Basic concepts', 'Problem identification'],
        areasNeedingImprovement: ['Complex calculations', 'Time management'],
        unansweredQuestions: [3, 7],
        partiallyAnsweredQuestions: [2, 5],
        irrelevantAnswers: [4]
      },
      processingTime: 3000 + Math.random() * 4000 // 3-7 seconds
    };
  }
}

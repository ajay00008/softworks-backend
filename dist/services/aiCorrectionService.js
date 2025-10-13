import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger';
export class AICorrectionService {
    static genAI;
    static model;
    /**
     * Initialize the AI correction service
     */
    static initialize() {
        try {
            this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY || '');
            this.model = this.genAI.getGenerativeModel({
                model: env.AI_MODEL || 'gemini-2.0-flash-exp'
            });
            logger.info('AI Correction Service initialized with Gemini');
        }
        catch (error) {
            logger.error('Failed to initialize AI Correction Service:', error);
            throw new Error('Failed to initialize AI Correction Service');
        }
    }
    /**
     * Process answer sheet with AI correction
     */
    static async processAnswerSheet(request) {
        try {
            const startTime = Date.now();
            // Initialize if not already done
            if (!this.genAI) {
                this.initialize();
            }
            logger.info(`Starting AI correction for answer sheet: ${request.answerSheetId}`);
            // Create the correction prompt
            const prompt = this.createCorrectionPrompt(request);
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
            const correctionResult = this.parseCorrectionResponse(correctionText, request);
            const processingTime = Date.now() - startTime;
            logger.info(`AI correction completed for answer sheet: ${request.answerSheetId} in ${processingTime}ms`);
            return {
                ...correctionResult,
                processingTime
            };
        }
        catch (error) {
            logger.error('Error processing answer sheet with AI:', error);
            throw new Error(`AI correction failed: ${error.message}`);
        }
    }
    /**
     * Create comprehensive prompt for answer sheet correction
     */
    static createCorrectionPrompt(request) {
        const { questionPaper, language = 'ENGLISH' } = request;
        return `You are an expert educational AI assistant specialized in correcting answer sheets. Please analyze the provided answer sheet image and correct it according to the question paper.

QUESTION PAPER DETAILS:
${questionPaper.questions.map(q => `
Question ${q.questionNumber}: ${q.questionText}
Correct Answer: ${q.correctAnswer}
Maximum Marks: ${q.maxMarks}
Type: ${q.questionType}
`).join('\n')}

TOTAL MARKS: ${questionPaper.totalMarks}

CORRECTION INSTRUCTIONS:
1. Carefully examine each answer in the answer sheet
2. Compare student answers with correct answers
3. Award marks based on accuracy and completeness
4. For partial credit, consider:
   - Correct approach but wrong final answer
   - Correct concept but minor errors
   - Partial understanding of the topic
5. Provide constructive feedback for each question
6. Identify student strengths and weaknesses
7. Suggest areas for improvement

LANGUAGE: ${language}

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
      "studentAnswer": "What student wrote",
      "isCorrect": true,
      "marksObtained": 2,
      "maxMarks": 2,
      "feedback": "Detailed feedback for this question",
      "confidence": 0.9
    }
  ],
  "overallFeedback": "Overall performance feedback",
  "strengths": ["List of student strengths"],
  "weaknesses": ["List of areas needing improvement"],
  "suggestions": ["Specific suggestions for improvement"]
}

IMPORTANT:
- Be fair and consistent in marking
- Consider alternative correct answers if applicable
- Provide constructive feedback
- Focus on learning outcomes and improvement`;
    }
    /**
     * Parse AI response into structured correction result
     */
    static parseCorrectionResponse(response, request) {
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
                suggestions: correctionData.suggestions || []
            };
        }
        catch (error) {
            logger.error('Error parsing AI correction response:', error);
            // Return fallback result
            return {
                answerSheetId: request.answerSheetId,
                status: 'FAILED',
                confidence: 0.1,
                totalMarks: request.questionPaper.totalMarks,
                obtainedMarks: 0,
                percentage: 0,
                questionWiseResults: [],
                overallFeedback: 'AI correction failed. Please review manually.',
                strengths: [],
                weaknesses: ['Unable to process with AI'],
                suggestions: ['Manual review required'],
                errors: [`Failed to parse AI response: ${error.message}`]
            };
        }
    }
    /**
     * Generate mock correction for testing
     */
    static async generateMockCorrection(request) {
        const { questionPaper } = request;
        // Generate mock results
        const questionWiseResults = questionPaper.questions.map((q, index) => ({
            questionNumber: q.questionNumber,
            correctAnswer: q.correctAnswer,
            studentAnswer: `Mock student answer ${index + 1}`,
            isCorrect: Math.random() > 0.3, // 70% correct rate
            marksObtained: Math.random() > 0.3 ? q.maxMarks : Math.floor(q.maxMarks * 0.5),
            maxMarks: q.maxMarks,
            feedback: `Mock feedback for question ${q.questionNumber}`,
            confidence: 0.8 + Math.random() * 0.2
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
            questionWiseResults,
            overallFeedback: 'Mock AI correction completed. This is a test result.',
            strengths: ['Good understanding of basic concepts', 'Clear handwriting'],
            weaknesses: ['Needs improvement in problem-solving', 'Calculation errors'],
            suggestions: ['Practice more problems', 'Double-check calculations'],
            processingTime: 2000 + Math.random() * 3000 // 2-5 seconds
        };
    }
}
//# sourceMappingURL=aiCorrectionService.js.map
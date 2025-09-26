import OpenAI from 'openai';
import { env } from '../config/env.js';
// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
});
export class OpenAIService {
    /**
     * Generate questions using OpenAI API
     */
    static async generateQuestions(request) {
        try {
            const { subjectName, className, unit, questionDistribution, totalQuestions, language } = request;
            // Create a comprehensive prompt for question generation
            const prompt = this.createQuestionGenerationPrompt({
                subjectName: subjectName || 'General',
                className: className || 'General',
                unit,
                questionDistribution,
                totalQuestions,
                language
            });
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini", // Using the more cost-effective model
                messages: [
                    {
                        role: "system",
                        content: "You are an expert educational content creator specializing in creating high-quality academic questions based on Bloom's Taxonomy. Generate questions that are pedagogically sound, age-appropriate, and aligned with educational standards."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 4000,
            });
            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response from OpenAI API');
            }
            // Parse the JSON response
            const generatedQuestions = this.parseGeneratedQuestions(response);
            return generatedQuestions;
        }
        catch (error) {
            console.error('Error generating questions with OpenAI:', error);
            console.error('Error details:', {
                message: error.message,
                status: error.status,
                code: error.code,
                type: error.type
            });
            throw new Error(`Failed to generate questions with AI: ${error.message}`);
        }
    }
    /**
     * Create a comprehensive prompt for question generation
     */
    static createQuestionGenerationPrompt({ subjectName, className, unit, questionDistribution, totalQuestions, language }) {
        const languageInstruction = language !== 'ENGLISH' ? `\n\nIMPORTANT: Generate all questions in ${language} language.` : '';
        const distributionText = questionDistribution.map(dist => `- ${dist.bloomsLevel} level: ${dist.percentage}% (${dist.difficulty} difficulty${dist.twistedPercentage ? `, ${dist.twistedPercentage}% twisted` : ''})`).join('\n');
        return `Generate ${totalQuestions} high-quality academic questions for the following specifications:

Subject: ${subjectName}
Class: ${className}
Unit/Topic: ${unit}

Question Distribution:
${distributionText}

Requirements:
1. Each question must be pedagogically sound and age-appropriate for the specified class level
2. Questions should test the specific Bloom's Taxonomy level indicated
3. Difficulty should match the specified level (EASY, MODERATE, TOUGHEST)
4. Include a mix of question types: Multiple Choice, Short Answer, Long Answer, True/False, Fill in the Blanks
5. For multiple choice questions, provide 4 plausible options with only one correct answer
6. Include detailed explanations for each answer
7. Assign appropriate marks based on difficulty (1-3 for easy, 2-5 for moderate, 3-8 for toughest)
8. Include relevant tags for categorization
9. Set appropriate time limits (1-5 minutes per question)${languageInstruction}

Output Format:
Return a JSON array of objects with the following structure:
[
  {
    "questionText": "The actual question text",
    "questionType": "MULTIPLE_CHOICE|SHORT_ANSWER|LONG_ANSWER|TRUE_FALSE|FILL_BLANKS",
    "options": ["Option A", "Option B", "Option C", "Option D"], // Only for MULTIPLE_CHOICE
    "correctAnswer": "The correct answer",
    "explanation": "Detailed explanation of why this is correct",
    "marks": 2,
    "timeLimit": 3,
    "tags": ["tag1", "tag2"]
  }
]

Ensure the JSON is valid and properly formatted.`;
    }
    /**
     * Parse the generated questions from OpenAI response
     */
    static parseGeneratedQuestions(response) {
        try {
            // Extract JSON from the response (in case there's extra text)
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No valid JSON array found in response');
            }
            const questions = JSON.parse(jsonMatch[0]);
            // Validate and clean the questions
            return questions.map((q) => ({
                questionText: q.questionText || '',
                questionType: q.questionType || 'SHORT_ANSWER',
                options: q.options || [],
                correctAnswer: q.correctAnswer || '',
                explanation: q.explanation || '',
                marks: Math.max(1, Math.min(10, q.marks || 2)),
                timeLimit: Math.max(1, Math.min(10, q.timeLimit || 3)),
                tags: q.tags || []
            }));
        }
        catch (error) {
            console.error('Error parsing generated questions:', error);
            throw new Error('Failed to parse AI-generated questions');
        }
    }
    /**
     * Generate a single question for testing
     */
    static async generateSingleQuestion(subject, unit, bloomsLevel, difficulty, language = 'ENGLISH') {
        const questions = await this.generateQuestions({
            subjectId: 'test',
            classId: 'test',
            unit,
            questionDistribution: [{
                    bloomsLevel: bloomsLevel,
                    difficulty: difficulty,
                    percentage: 100
                }],
            totalQuestions: 1,
            language: language,
            subjectName: subject,
            className: 'Test Class'
        });
        return questions[0];
    }
}
export default OpenAIService;
//# sourceMappingURL=openaiService.js.map
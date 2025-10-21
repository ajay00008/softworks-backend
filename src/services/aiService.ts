import { env } from '../config/env.js';

export interface QuestionGenerationRequest {
  subjectId: string;
  classId: string;
  unit: string;
  questionDistribution: Array<{
    bloomsLevel: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
    difficulty: 'EASY' | 'MODERATE' | 'TOUGHEST';
    percentage: number;
    twistedPercentage: number;
  }>;
  totalQuestions: number;
  language: 'ENGLISH' | 'TAMIL' | 'HINDI' | 'MALAYALAM' | 'TELUGU' | 'KANNADA';
  subjectName?: string;
  className?: string;
}

export interface GeneratedQuestion {
  questionText: string;
  questionType: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
  options?: string[];
  correctAnswer: string;
  explanation: string;
  marks: number;
  timeLimit?: number;
  tags?: string[];
  
  // Enhanced fields for new question types
  matchingPairs?: { left: string; right: string }[];
  multipleCorrectAnswers?: string[];
  drawingInstructions?: string;
  markingInstructions?: string;
  visualAids?: string[];
  interactiveElements?: string[];
}

export interface AIConfig {
  provider: 'OPENAI' | 'GEMINI' | 'ANTHROPIC' | 'MOCK';
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIService {
  private static config: AIConfig;

  /**
   * Initialize AI service with configuration
   */
  static initialize(config?: Partial<AIConfig>) {
    this.config = {
      provider: (config?.provider || env.AI_PROVIDER || 'GEMINI') as any,
      apiKey: config?.apiKey || env.AI_API_KEY || env.GEMINI_API_KEY || '',
      model: config?.model || env.AI_MODEL || 'gemini-2.0-flash-exp',
      baseUrl: config?.baseUrl || env.AI_BASE_URL || '',
      temperature: config?.temperature || env.AI_TEMPERATURE || 0.7,
      maxTokens: config?.maxTokens || env.AI_MAX_TOKENS || 4000,
    };
  }

  /**
   * Generate questions using the configured AI provider
   */
  static async generateQuestions(request: QuestionGenerationRequest): Promise<GeneratedQuestion[]> {
    try {
      // Initialize with default config if not already done
      if (!this.config) {
        this.initialize();
      }

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

      let response: string;

      switch (this.config.provider) {
        case 'GEMINI':
          response = await this.generateWithGemini(prompt);
          break;
        case 'OPENAI':
          response = await this.generateWithOpenAI(prompt);
          break;
        case 'ANTHROPIC':
          response = await this.generateWithAnthropic(prompt);
          break;
        case 'MOCK':
          response = await this.generateMockQuestions(request);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${this.config.provider}`);
      }

      // Parse the JSON response
      const generatedQuestions = this.parseGeneratedQuestions(response);
      return generatedQuestions;

    } catch (error) {
      console.error('Error generating questions with AI:', error);
      throw new Error(`Failed to generate questions with AI: ${(error as Error).message}`);
    }
  }

  /**
   * Generate questions using Gemini API
   */
  private static async generateWithGemini(prompt: string): Promise<string> {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxTokens,
            topP: 0.8,
            topK: 10
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  /**
   * Generate questions using OpenAI API
   */
  private static async generateWithOpenAI(prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: "You are an expert educational content creator specializing in creating high-quality academic questions based on Bloom's Taxonomy."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  /**
   * Generate questions using Anthropic API
   */
  private static async generateWithAnthropic(prompt: string): Promise<string> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Anthropic API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  /**
   * Generate mock questions for testing
   */
  private static async generateMockQuestions(request: QuestionGenerationRequest): Promise<string> {
    const mockQuestions = [
      {
        questionText: `What is the main concept of ${request.unit} in ${request.subjectName}?`,
        questionType: "MULTIPLE_CHOICE",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Option A",
        explanation: "This is the correct answer because...",
        marks: 2,
        timeLimit: 3,
        tags: ["concept", "basic"]
      },
      {
        questionText: `Explain the importance of ${request.unit} in ${request.subjectName}.`,
        questionType: "SHORT_ANSWER",
        correctAnswer: "Sample explanation",
        explanation: "This question tests understanding of the topic.",
        marks: 3,
        timeLimit: 5,
        tags: ["explanation", "understanding"]
      }
    ];

    return JSON.stringify(mockQuestions);
  }

  /**
   * Create a comprehensive prompt for question generation
   */
  private static createQuestionGenerationPrompt({
    subjectName,
    className,
    unit,
    questionDistribution,
    totalQuestions,
    language
  }: {
    subjectName: string;
    className: string;
    unit: string;
    questionDistribution: QuestionGenerationRequest['questionDistribution'];
    totalQuestions: number;
    language: string;
  }): string {
    const languageInstruction = language !== 'ENGLISH' ? `\n\nIMPORTANT: Generate all questions in ${language} language.` : '';
    
    const distributionText = questionDistribution.map(dist => 
      `- ${dist.bloomsLevel} level: ${dist.percentage}% (${dist.difficulty} difficulty${dist.twistedPercentage ? `, ${dist.twistedPercentage}% twisted` : ''})`
    ).join('\n');

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
4. Include a comprehensive mix of question types:
   - Multiple Choice (4 options, single correct answer)
   - Fill in the Blanks (with appropriate blanks marked as ___)
   - One Word Answer (brief, precise answers)
   - True/False (binary choice questions)
   - Multiple Answers (choose all correct options)
   - Matching Pairs (match items from two columns)
   - Drawing/Diagram (draw and label diagrams)
   - Marking Parts (mark specific parts on given diagrams)
5. For multiple choice questions, provide 4 plausible options with only one correct answer
6. For multiple answer questions, provide 4-6 options with 2-3 correct answers
7. For matching pairs, provide 3-5 pairs of related items
8. For drawing questions, provide clear drawing instructions
9. For marking questions, provide specific parts to mark
10. Include detailed explanations for each answer
11. Assign appropriate marks based on difficulty (1-3 for easy, 2-5 for moderate, 3-8 for toughest)
12. Include relevant tags for categorization
13. Set appropriate time limits (1-5 minutes per question)${languageInstruction}

Output Format:
Return a JSON array of objects with the following structure:
[
  {
    "questionText": "The actual question text",
    "questionType": "MULTIPLE_CHOICE|FILL_BLANKS|ONE_WORD_ANSWER|TRUE_FALSE|MULTIPLE_ANSWERS|MATCHING_PAIRS|DRAWING_DIAGRAM|MARKING_PARTS|SHORT_ANSWER|LONG_ANSWER",
    "options": ["Option A", "Option B", "Option C", "Option D"], // For MULTIPLE_CHOICE and MULTIPLE_ANSWERS
    "correctAnswer": "The correct answer",
    "explanation": "Detailed explanation of why this is correct",
    "marks": 2,
    "timeLimit": 3,
    "tags": ["tag1", "tag2"],
    "matchingPairs": [{"left": "Item A", "right": "Match A"}], // For MATCHING_PAIRS
    "multipleCorrectAnswers": ["Answer 1", "Answer 2"], // For MULTIPLE_ANSWERS
    "drawingInstructions": "Draw and label the diagram", // For DRAWING_DIAGRAM
    "markingInstructions": "Mark the parts on the diagram", // For MARKING_PARTS
    "visualAids": ["Reference image", "Step guide"], // Optional visual aids
    "interactiveElements": ["Drag and drop", "Timer"] // Optional interactive elements
  }
]

Ensure the JSON is valid and properly formatted.`;
  }

  /**
   * Parse the generated questions from AI response
   */
  private static parseGeneratedQuestions(response: string): GeneratedQuestion[] {
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON array found in response');
      }

      const questions = JSON.parse(jsonMatch[0]);
      
      // Validate and clean the questions
      return questions.map((q: any) => {
        // Handle correctAnswer field - convert array to string if needed
        let correctAnswer = '';
        if (Array.isArray(q.correctAnswer)) {
          correctAnswer = q.correctAnswer.join(', ');
        } else if (typeof q.correctAnswer === 'string') {
          correctAnswer = q.correctAnswer;
        } else if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
          correctAnswer = String(q.correctAnswer);
        }

        // Ensure correctAnswer is not empty
        if (!correctAnswer.trim()) {
          correctAnswer = 'No answer provided';
        }

        return {
          questionText: q.questionText || '',
          questionType: q.questionType || 'SHORT_ANSWER',
          options: q.options || [],
          correctAnswer: correctAnswer,
          explanation: q.explanation || '',
          marks: Math.max(1, Math.min(10, q.marks || 2)),
          timeLimit: Math.max(1, Math.min(10, q.timeLimit || 3)),
          tags: q.tags || []
        };
      });

    } catch (error) {
      console.error('Error parsing generated questions:', error);
      throw new Error('Failed to parse AI-generated questions');
    }
  }

  /**
   * Generate a single question for testing
   */
  static async generateSingleQuestion(
    subject: string,
    unit: string,
    bloomsLevel: string,
    difficulty: string,
    language: string = 'ENGLISH'
  ): Promise<GeneratedQuestion> {
    const questions = await this.generateQuestions({
      subjectId: 'test',
      classId: 'test',
      unit,
      questionDistribution: [{
        bloomsLevel: bloomsLevel as any,
        difficulty: difficulty as any,
        percentage: 100,
        twistedPercentage: 0
      }],
      totalQuestions: 1,
      language: language as any,
      subjectName: subject,
      className: 'Test Class'
    });

    if (!questions || questions.length === 0) {
      throw new Error('No questions generated');
    }
    return questions[0];
  }

  /**
   * Get current AI configuration
   */
  static getConfig(): AIConfig {
    return this.config;
  }

  /**
   * Update AI configuration
   */
  static updateConfig(newConfig: Partial<AIConfig>) {
    this.config = { ...this.config, ...newConfig };
  }
}

export default AIService;

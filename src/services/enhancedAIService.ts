import { env } from '../config/env.js';
import { Subject } from '../models/Subject';

export interface EnhancedQuestionGenerationRequest {
  subjectId: string;
  classId: string;
  subjectName: string;
  className: string;
  examTitle: string;
  markDistribution: {
    oneMark: number;
    twoMark: number;
    threeMark: number;
    fiveMark: number;
    totalQuestions: number;
    totalMarks: number;
  };
  bloomsDistribution: Array<{
    level: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
    percentage: number;
  }>;
  questionTypeDistribution: Array<{
    type: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
    percentage: number;
  }>;
  useSubjectBook: boolean;
  customInstructions?: string;
  difficultyLevel: 'EASY' | 'MODERATE' | 'TOUGHEST';
  twistedQuestionsPercentage: number;
  language: 'ENGLISH' | 'TAMIL' | 'HINDI' | 'MALAYALAM' | 'TELUGU' | 'KANNADA';
  patternFilePath?: string; // Optional pattern file path
}

export interface EnhancedGeneratedQuestion {
  questionText: string;
  questionType: 'CHOOSE_BEST_ANSWER' | 'FILL_BLANKS' | 'ONE_WORD_ANSWER' | 'TRUE_FALSE' | 'CHOOSE_MULTIPLE_ANSWERS' | 'MATCHING_PAIRS' | 'DRAWING_DIAGRAM' | 'MARKING_PARTS' | 'SHORT_ANSWER' | 'LONG_ANSWER';
  marks: number;
  bloomsLevel: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
  difficulty: 'EASY' | 'MODERATE' | 'TOUGHEST';
  isTwisted: boolean;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  matchingPairs?: { left: string; right: string }[];
  multipleCorrectAnswers?: string[];
  drawingInstructions?: string;
  markingInstructions?: string;
  visualAids?: string[];
  tags?: string[];
}

export interface AIConfig {
  provider: 'OPENAI' | 'GEMINI' | 'ANTHROPIC' | 'MOCK';
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export class EnhancedAIService {
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
   * Generate comprehensive question paper using AI
   */
  static async generateQuestionPaper(request: EnhancedQuestionGenerationRequest): Promise<EnhancedGeneratedQuestion[]> {
    try {
      // Initialize with default config if not already done
      if (!this.config) {
        this.initialize();
      }

      // Get subject book information if needed
      let subjectBookInfo = '';
      if (request.useSubjectBook) {
        const subject = await Subject.findById(request.subjectId);
        if (subject?.referenceBook) {
          subjectBookInfo = `\n\nReference Book Information:
- Book Name: ${subject.referenceBook.originalName}
- File Size: ${(subject.referenceBook.fileSize / 1024 / 1024).toFixed(2)} MB
- Uploaded: ${subject.referenceBook.uploadedAt}
- Note: Use this book as the primary source for generating questions.`;
        }
      }

      // Handle pattern file if provided
      let patternInfo = '';
      if (request.patternFilePath) {
        patternInfo = `\n\nPattern File Information:
- Pattern file has been uploaded to guide the question paper format
- Follow the structure and style of the uploaded pattern
- Use the pattern as a reference for formatting and question arrangement
- Maintain consistency with the pattern's layout and presentation style`;
      }

      // Create comprehensive prompt for question paper generation
      const prompt = this.createQuestionPaperPrompt(request, subjectBookInfo + patternInfo);

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
          response = await this.generateMockQuestionPaper(request);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${this.config.provider}`);
      }

      // Parse the JSON response
      const generatedQuestions = this.parseGeneratedQuestions(response);
      return generatedQuestions;

    } catch (error) {
      console.error('Error generating question paper with AI:', error);
      throw new Error(`Failed to generate question paper with AI: ${(error as Error).message}`);
    }
  }

  /**
   * Create comprehensive prompt for question paper generation
   */
  private static createQuestionPaperPrompt(
    request: EnhancedQuestionGenerationRequest,
    subjectBookInfo: string
  ): string {
    const { subjectName, className, examTitle, markDistribution, bloomsDistribution, questionTypeDistribution, customInstructions, difficultyLevel, twistedQuestionsPercentage, language } = request;

    // Build Blooms taxonomy distribution text
    const bloomsText = bloomsDistribution.map(dist => 
      `${dist.level}: ${dist.percentage}%`
    ).join(', ');

    // Build question type distribution text
    const questionTypesText = questionTypeDistribution.map(dist => 
      `${this.getQuestionTypeName(dist.type)}: ${dist.percentage}%`
    ).join(', ');

    // Build mark distribution text
    const markDistributionText = `1-mark questions: ${markDistribution.oneMark}, 2-mark questions: ${markDistribution.twoMark}, 3-mark questions: ${markDistribution.threeMark}, 5-mark questions: ${markDistribution.fiveMark}`;

    return `You are an expert educational content creator specializing in creating comprehensive question papers based on Bloom's Taxonomy. Generate a complete question paper with the following specifications:

**EXAM DETAILS:**
- Subject: ${subjectName}
- Class: ${className}
- Exam Title: ${examTitle}
- Total Questions: ${markDistribution.totalQuestions} (Maximum 100)
- Total Marks: ${markDistribution.totalMarks}
- Language: ${language}

**MARK DISTRIBUTION:**
${markDistributionText}

**BLOOM'S TAXONOMY DISTRIBUTION:**
${bloomsText}

**QUESTION TYPE DISTRIBUTION:**
${questionTypesText}

**DIFFICULTY LEVEL:** ${difficultyLevel}
**TWISTED QUESTIONS:** ${twistedQuestionsPercentage}% of questions should be twisted/challenging

**QUESTION TYPES TO INCLUDE:**
1. CHOOSE_BEST_ANSWER - Multiple choice with one correct answer
2. FILL_BLANKS - Fill in the blanks with appropriate words
3. ONE_WORD_ANSWER - Answer in one word
4. TRUE_FALSE - True or false questions
5. CHOOSE_MULTIPLE_ANSWERS - Multiple choice with multiple correct answers
6. MATCHING_PAIRS - Match items from two columns using arrows
7. DRAWING_DIAGRAM - Draw diagrams, maps, or mark parts
8. MARKING_PARTS - Mark correct objects or parts
9. SHORT_ANSWER - Brief text responses
10. LONG_ANSWER - Detailed text responses

**BLOOM'S TAXONOMY LEVELS:**
- REMEMBER: Recall facts, terms, basic concepts
- UNDERSTAND: Explain ideas or concepts, interpret information
- APPLY: Use information in new situations, solve problems
- ANALYZE: Draw connections among ideas, break down information
- EVALUATE: Justify a stand or decision, critique information
- CREATE: Produce new or original work, design solutions

${subjectBookInfo}

${customInstructions ? `\n**CUSTOM INSTRUCTIONS:**\n${customInstructions}` : ''}

**REQUIREMENTS:**
1. Generate exactly ${markDistribution.totalQuestions} questions
2. Follow the mark distribution precisely
3. Distribute questions according to Bloom's taxonomy percentages
4. Include all specified question types according to their percentages
5. Ensure questions are age-appropriate for ${className}
6. Make questions relevant to ${subjectName}
7. Include ${twistedQuestionsPercentage}% twisted/challenging questions
8. Provide clear, unambiguous questions
9. Include appropriate options for multiple choice questions
10. Provide correct answers and explanations
11. For matching pairs, provide clear left and right items
12. For drawing questions, provide clear instructions
13. For marking questions, specify what to mark

**OUTPUT FORMAT:**
Return a JSON array of questions with the following structure:
[
  {
    "questionText": "The complete question text",
    "questionType": "QUESTION_TYPE",
    "marks": number,
    "bloomsLevel": "BLOOMS_LEVEL",
    "difficulty": "DIFFICULTY_LEVEL",
    "isTwisted": boolean,
    "options": ["option1", "option2", "option3", "option4"],
    "correctAnswer": "correct answer",
    "explanation": "explanation of the answer",
    "matchingPairs": [{"left": "item1", "right": "item2"}],
    "multipleCorrectAnswers": ["answer1", "answer2"],
    "drawingInstructions": "instructions for drawing",
    "markingInstructions": "instructions for marking",
    "tags": ["tag1", "tag2"]
  }
]

Generate the question paper now:`;
  }

  /**
   * Get human-readable question type name
   */
  private static getQuestionTypeName(type: string): string {
    const typeNames: { [key: string]: string } = {
      'CHOOSE_BEST_ANSWER': 'Choose the best answer',
      'FILL_BLANKS': 'Fill in the blanks',
      'ONE_WORD_ANSWER': 'One word answer',
      'TRUE_FALSE': 'True or False',
      'CHOOSE_MULTIPLE_ANSWERS': 'Choose multiple answers',
      'MATCHING_PAIRS': 'Matching pairs',
      'DRAWING_DIAGRAM': 'Drawing/Diagram',
      'MARKING_PARTS': 'Marking parts',
      'SHORT_ANSWER': 'Short answer',
      'LONG_ANSWER': 'Long answer'
    };
    return typeNames[type] || type;
  }

  /**
   * Generate questions using Gemini API
   */
  private static async generateWithGemini(prompt: string): Promise<string> {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.config.apiKey);
      const model = genAI.getGenerativeModel({ model: this.config.model });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error with Gemini API:', error);
      throw new Error(`Gemini API error: ${(error as Error).message}`);
    }
  }

  /**
   * Generate questions using OpenAI API
   */
  private static async generateWithOpenAI(prompt: string): Promise<string> {
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl
      });

      const completion = await openai.chat.completions.create({
        model: this.config.model,
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
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI API');
      }
      return response;
    } catch (error) {
      console.error('Error with OpenAI API:', error);
      throw new Error(`OpenAI API error: ${(error as Error).message}`);
    }
  }

  /**
   * Generate questions using Anthropic API
   */
  private static async generateWithAnthropic(prompt: string): Promise<string> {
    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl
      });

      const message = await anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const response = message.content[0];
      if (response.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic API');
      }
      return response.text;
    } catch (error) {
      console.error('Error with Anthropic API:', error);
      throw new Error(`Anthropic API error: ${(error as Error).message}`);
    }
  }

  /**
   * Generate mock question paper for testing
   */
  private static async generateMockQuestionPaper(request: EnhancedQuestionGenerationRequest): Promise<string> {
    const questions: EnhancedGeneratedQuestion[] = [];
    const { markDistribution, bloomsDistribution, questionTypeDistribution } = request;

    // Generate questions based on mark distribution
    let questionCount = 0;
    
    // Generate 1-mark questions
    for (let i = 0; i < markDistribution.oneMark; i++) {
      questions.push(this.createMockQuestion(1, 'CHOOSE_BEST_ANSWER', 'REMEMBER', request));
      questionCount++;
    }

    // Generate 2-mark questions
    for (let i = 0; i < markDistribution.twoMark; i++) {
      questions.push(this.createMockQuestion(2, 'FILL_BLANKS', 'UNDERSTAND', request));
      questionCount++;
    }

    // Generate 3-mark questions
    for (let i = 0; i < markDistribution.threeMark; i++) {
      questions.push(this.createMockQuestion(3, 'SHORT_ANSWER', 'APPLY', request));
      questionCount++;
    }

    // Generate 5-mark questions
    for (let i = 0; i < markDistribution.fiveMark; i++) {
      questions.push(this.createMockQuestion(5, 'LONG_ANSWER', 'ANALYZE', request));
      questionCount++;
    }

    return JSON.stringify(questions);
  }

  /**
   * Create a mock question for testing
   */
  private static createMockQuestion(
    marks: number,
    questionType: string,
    bloomsLevel: string,
    request: EnhancedQuestionGenerationRequest
  ): EnhancedGeneratedQuestion {
    const questionTexts = {
      'CHOOSE_BEST_ANSWER': `What is the primary function of mitochondria in a cell?`,
      'FILL_BLANKS': `The process of photosynthesis occurs in the _____ of plant cells.`,
      'SHORT_ANSWER': `Explain the difference between mitosis and meiosis.`,
      'LONG_ANSWER': `Analyze the impact of climate change on biodiversity and suggest three mitigation strategies.`
    };

    return {
      questionText: questionTexts[questionType as keyof typeof questionTexts] || 'Sample question text',
      questionType: questionType as any,
      marks,
      bloomsLevel: bloomsLevel as any,
      difficulty: request.difficultyLevel,
      isTwisted: Math.random() < (request.twistedQuestionsPercentage / 100),
      options: questionType === 'CHOOSE_BEST_ANSWER' ? 
        ['Energy production', 'Protein synthesis', 'DNA replication', 'Waste removal'] : undefined,
      correctAnswer: questionType === 'CHOOSE_BEST_ANSWER' ? 'Energy production' : 'Sample correct answer',
      explanation: 'This is a sample explanation for the answer.',
      tags: ['sample', 'test']
    };
  }

  /**
   * Parse generated questions from AI response
   */
  private static parseGeneratedQuestions(response: string): EnhancedGeneratedQuestion[] {
    try {
      // Clean the response to extract JSON
      const cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const questions = JSON.parse(cleanedResponse);
      
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array of questions');
      }

      return questions.map((q: any) => ({
        questionText: q.questionText || '',
        questionType: q.questionType || 'SHORT_ANSWER',
        marks: q.marks || 1,
        bloomsLevel: q.bloomsLevel || 'REMEMBER',
        difficulty: q.difficulty || 'MODERATE',
        isTwisted: q.isTwisted || false,
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || '',
        matchingPairs: q.matchingPairs || [],
        multipleCorrectAnswers: q.multipleCorrectAnswers || [],
        drawingInstructions: q.drawingInstructions || '',
        markingInstructions: q.markingInstructions || '',
        tags: q.tags || []
      }));
    } catch (error) {
      console.error('Error parsing AI response:', error);
      throw new Error(`Failed to parse AI response: ${(error as Error).message}`);
    }
  }
}

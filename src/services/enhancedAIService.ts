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
    marks: number; // Add marks to preserve context
  }>;
  useSubjectBook: boolean;
  customInstructions?: string;
  difficultyLevel: 'EASY' | 'MODERATE' | 'TOUGHEST';
  twistedQuestionsPercentage: number;
  patternFilePath?: string; // Optional pattern file path
  patternDiagramInfo?: string; // Diagram information extracted from pattern file
  referenceBookContent?: string; // Reference book content for AI generation
  samplePapers?: Array<{
    _id: string;
    title: string;
    description?: string;
    sampleFile: {
      fileName: string;
      filePath: string;
      fileSize: number;
    };
    analysis: {
      totalQuestions: number;
      questionTypes: string[];
      markDistribution: {
        oneMark: number;
        twoMark: number;
        threeMark: number;
        fiveMark: number;
        totalMarks: number;
      };
      difficultyLevels: string[];
      sections: Array<{
        name: string;
        questions: number;
        marks: number;
      }>;
      designPattern: {
        layout: string;
        formatting: string;
        questionNumbering: string;
        sectionHeaders: string[];
      };
    };
    templateSettings: {
      useAsTemplate: boolean;
      followDesign: boolean;
      maintainStructure: boolean;
      customInstructions?: string;
    };
    version: string;
  }>; // Available sample papers for design guidance
  templates?: Array<{
    _id: string;
    title: string;
    description?: string;
    templateFile: {
      fileName: string;
      filePath: string;
      fileSize: number;
    };
    analysis?: {
      totalQuestions: number;
      questionTypes: string[];
      markDistribution: {
        oneMark: number;
        twoMark: number;
        threeMark: number;
        fiveMark: number;
        totalMarks: number;
      };
      difficultyLevels: string[];
      sections: Array<{
        name: string;
        questions: number;
        marks: number;
      }>;
      designPattern: {
        layout: string;
        formatting: string;
        questionNumbering: string;
        sectionHeaders: string[];
      };
    };
    templateSettings?: {
      useAsTemplate: boolean;
      followDesign: boolean;
      maintainStructure: boolean;
      customInstructions?: string;
    };
    version: string;
  }>; // Available templates for design guidance
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
  diagram?: {
    description: string; // Description of what should be drawn
    type: 'graph' | 'geometry' | 'circuit' | 'chart' | 'diagram' | 'figure' | 'other';
    status: 'pending' | 'ready'; // pending = needs generation, ready = already generated
    altText?: string; // Accessible description
    url?: string; // URL to generated diagram (after backend processing)
    imagePath?: string; // Local path to diagram image (after backend processing)
    imageBuffer?: Buffer; // Diagram image buffer (after backend processing)
  };
  // Legacy fields for backwards compatibility (will be removed)
  diagramImagePath?: string;
  diagramImageBuffer?: Buffer;
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

      // Use provided reference book content if available
      if (request.referenceBookContent) {
        subjectBookInfo += `\n\nReference Book Content Available: ${request.referenceBookContent}`;
      }

      // Handle pattern file if provided
      let patternInfo = '';
      let hasPatternDiagrams = false;
      if (request.patternFilePath) {
        patternInfo = `\n\nPattern File Information:
- Pattern file has been uploaded to guide the question paper format
- Follow the structure and style of the uploaded pattern
- Use the pattern as a reference for formatting and question arrangement
- Maintain consistency with the pattern's layout and presentation style`;
        
        // Add diagram information if available
        if (request.patternDiagramInfo) {
          hasPatternDiagrams = true;
          patternInfo += request.patternDiagramInfo;
          // Add strong instructions to include diagram questions
          patternInfo += `\n\n**CRITICAL: YOU MUST INCLUDE DIAGRAM QUESTIONS IN YOUR GENERATED QUESTION PAPER**
- Since the pattern contains diagrams, you MUST generate questions that require diagrams
- Include at least 2-3 questions of type DRAWING_DIAGRAM or MARKING_PARTS
- These questions should match the style and complexity of diagrams found in the pattern
- For each diagram question, provide detailed drawingInstructions and visualAids descriptions
- Ensure the diagram questions are distributed across different mark categories (1, 2, 3, or 5 marks)
- The diagrams in your questions should be similar in type and complexity to those in the pattern`;
        }
      }

      // Create comprehensive prompt for question paper generation
      const prompt = this.createQuestionPaperPrompt(request, subjectBookInfo + patternInfo, hasPatternDiagrams);
      
      // Log prompt section related to diagrams for debugging
      console.log('\n' + '='.repeat(80));
      console.log('📝 CHECKING PROMPT FOR DIAGRAM INSTRUCTIONS:');
      console.log('='.repeat(80));
      if (request.patternDiagramInfo) {
        console.log('✅ Pattern diagram info is included in prompt');
        console.log('Pattern diagram info snippet:', request.patternDiagramInfo.substring(0, 500));
      } else {
        console.log('❌ NO pattern diagram info in request');
      }
      if (hasPatternDiagrams) {
        console.log('✅ hasPatternDiagrams flag is TRUE');
      } else {
        console.log('❌ hasPatternDiagrams flag is FALSE');
      }
      console.log('Prompt snippet (checking for DIAGRAM keywords):');
      const diagramKeywords = prompt.match(/DIAGRAM|visualAids|drawingInstructions|drawing|diagram/gi);
      if (diagramKeywords) {
        console.log('✅ Found diagram keywords in prompt:', diagramKeywords.slice(0, 10));
      } else {
        console.log('❌ NO diagram keywords found in prompt');
      }
      console.log('='.repeat(80) + '\n');

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

      // Log the raw AI response for debugging (to verify diagram instructions)
      console.log('\n' + '='.repeat(80));
      console.log('🔍 FULL RAW AI RESPONSE (to check for diagram instructions):');
      console.log('='.repeat(80));
      console.log(response);
      console.log('='.repeat(80) + '\n');
      
      // Parse the JSON response
      const generatedQuestions = this.parseGeneratedQuestions(response);
      
      // Log parsed questions to check for diagram objects
      console.log('\n' + '='.repeat(80));
      console.log('📊 PARSED QUESTIONS (checking for diagram objects):');
      console.log('='.repeat(80));
      generatedQuestions.forEach((q, idx) => {
        const hasDiagram = q.diagram && q.diagram.status === 'pending';
        const isDiagramQuestion = q.questionType === 'DRAWING_DIAGRAM' || q.questionType === 'MARKING_PARTS';
        
        if (hasDiagram || isDiagramQuestion) {
          console.log(`Question ${idx + 1}:`);
          console.log(`  Type: ${q.questionType}`);
          console.log(`  HasDiagram: ${hasDiagram ? 'YES ✅' : 'NO ❌'}`);
          if (hasDiagram && q.diagram) {
            console.log(`  Diagram Type: ${q.diagram.type}`);
            console.log(`  Diagram Description: ${q.diagram.description.substring(0, 100)}${q.diagram.description.length > 100 ? '...' : ''}`);
            console.log(`  Diagram Status: ${q.diagram.status}`);
          }
          console.log('');
        }
      });
      console.log('='.repeat(80) + '\n');
      
      // Post-process to enforce mark-based question types and distribution
      const processedQuestions = this.enforceMarkBasedQuestionTypes(generatedQuestions);
      
      // Apply mark-based distribution to ensure correct question types
      const distributedQuestions = this.applyMarkBasedDistribution(processedQuestions, request);
      
      // Ensure we only return the exact number of questions requested
      const finalQuestions = distributedQuestions.slice(0, request.markDistribution.totalQuestions);
      
      console.log(`Generated ${generatedQuestions.length} questions, processed to ${distributedQuestions.length}, returning ${finalQuestions.length} questions`);
      return finalQuestions;

    } catch (error: unknown) {
      console.error('Error generating question paper with AI:', error);
      throw new Error(`Failed to generate question paper with AI: ${(error as Error).message}`);
    }
  }

  /**
   * Create comprehensive prompt for question paper generation
   */
  private static createQuestionPaperPrompt(
    request: EnhancedQuestionGenerationRequest,
    subjectBookInfo: string,
    hasPatternDiagrams: boolean = false
  ): string {
    const { subjectName, className, examTitle, markDistribution, bloomsDistribution, questionTypeDistribution, customInstructions, difficultyLevel, twistedQuestionsPercentage, referenceBookContent, templates, samplePapers } = request;
    
    // Set default language since it's not in the interface but used in the prompt
    const language = 'ENGLISH';

    // Build Blooms taxonomy distribution text
    const bloomsText = bloomsDistribution.map(dist => 
      `${dist.level}: ${dist.percentage}%`
    ).join(', ');

    // Build question type distribution text with marks context
    const questionTypesText = questionTypeDistribution.map(dist => 
      `${this.getQuestionTypeName(dist.type)} (${dist.marks}-mark): ${dist.percentage}%`
    ).join(', ');

    // Build mark distribution text
    const markDistributionText = `1-mark questions: ${markDistribution.oneMark} (brief, simple answers), 2-mark questions: ${markDistribution.twoMark} (short explanations), 3-mark questions: ${markDistribution.threeMark} (moderate detail), 5-mark questions: ${markDistribution.fiveMark} (comprehensive, detailed answers)`;

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
1. CHOOSE_BEST_ANSWER - Multiple choice with one correct answer (provide 4 options)
2. FILL_BLANKS - Fill in the blanks with appropriate words (use ___ for blanks)
3. ONE_WORD_ANSWER - Answer in one word (brief, precise answers)
4. TRUE_FALSE - True or false questions (binary choice)
5. CHOOSE_MULTIPLE_ANSWERS - Multiple choice with multiple correct answers (provide 4-6 options, 2-3 correct)
6. MATCHING_PAIRS - Match items from two columns using arrows (provide 3-5 pairs)
7. DRAWING_DIAGRAM - Draw diagrams, maps, or mark parts (provide clear drawing instructions). **IMPORTANT: For DRAWING_DIAGRAM questions that require a visual diagram, include a "diagram" object with description, type, and status. DO NOT include base64 data.**
8. MARKING_PARTS - Mark correct objects or parts (specify what to mark, include diagram references if needed). **IMPORTANT: For MARKING_PARTS questions that require a visual diagram, include a "diagram" object with description, type, and status. DO NOT include base64 data.**
9. SHORT_ANSWER - Brief text responses (2-3 sentences)
10. LONG_ANSWER - Detailed text responses (paragraph length)

**SPECIFIC INSTRUCTIONS FOR EACH TYPE:**

**TRUE_FALSE Questions:**
- Format: "Statement that can be definitively true or false"
- Example: "The capital of France is Paris. (True/False)"
- Correct Answer: "True" or "False"
- NO options array needed

**FILL_BLANKS Questions:**
- Format: "Complete the sentence: The process of photosynthesis occurs in the _____ of plant cells."
- Use ___ to indicate blanks
- Correct Answer: "chloroplasts" (single word/phrase)
- NO options array needed

**CHOOSE_BEST_ANSWER Questions:**
- Format: "What is the primary function of mitochondria?"
- Provide exactly 4 options: ["Energy production", "Protein synthesis", "DNA replication", "Waste removal"]
- Correct Answer: "Energy production" (single option)
- Include options array

**CHOOSE_MULTIPLE_ANSWERS Questions:**
- Format: "Which of the following are renewable energy sources?"
- Provide 4-6 options: ["Solar", "Coal", "Wind", "Natural Gas", "Hydroelectric", "Nuclear"]
- Correct Answer: "Solar, Wind, Hydroelectric" (multiple options)
- Include options array AND multipleCorrectAnswers array
- **CRITICAL: ALWAYS include the 'options' array with 4-6 options**
- **CRITICAL: ALWAYS include the 'multipleCorrectAnswers' array with 2-3 correct options**

**ONE_WORD_ANSWER Questions:**
- Format: "What is the chemical symbol for gold?"
- Correct Answer: "Au" (single word)
- NO options array needed

**SHORT_ANSWER Questions:**
- Format: "Explain the difference between mitosis and meiosis."
- Correct Answer: Brief 2-3 sentence explanation
- NO options array needed

**LONG_ANSWER Questions:**
- Format: "Analyze the impact of climate change on biodiversity and suggest mitigation strategies."
- Correct Answer: Detailed paragraph response
- NO options array needed

**BLOOM'S TAXONOMY LEVELS:**
- REMEMBER: Recall facts, terms, basic concepts
- UNDERSTAND: Explain ideas or concepts, interpret information
- APPLY: Use information in new situations, solve problems
- ANALYZE: Draw connections among ideas, break down information
- EVALUATE: Justify a stand or decision, critique information
- CREATE: Produce new or original work, design solutions

${subjectBookInfo}

${referenceBookContent ? `\n**REFERENCE BOOK CONTENT:**\n${referenceBookContent}\n\n**IMPORTANT:** Use the reference book content as the primary source for generating questions. Ensure all questions are based on the content from this reference material.` : ''}

${samplePapers && samplePapers.length > 0 ? `\n**AVAILABLE SAMPLE PAPERS FOR DESIGN GUIDANCE:**\n${samplePapers.map(sample => `
- Sample Paper: ${sample.title}
- Description: ${sample.description || 'No description'}
- Version: ${sample.version}
- Analysis: ${sample.analysis.totalQuestions} questions, ${sample.analysis.markDistribution.totalMarks} total marks
- Question Types: ${sample.analysis.questionTypes.join(', ')}
- Sections: ${sample.analysis.sections.map(s => `${s.name} (${s.questions} questions, ${s.marks} marks)`).join(', ')}
- Design Pattern: ${sample.analysis.designPattern.layout} layout, ${sample.analysis.designPattern.formatting} formatting
- Section Headers: ${sample.analysis.designPattern.sectionHeaders.join(', ')}
- Template Settings: Use as template: ${sample.templateSettings.useAsTemplate}, Follow design: ${sample.templateSettings.followDesign}, Maintain structure: ${sample.templateSettings.maintainStructure}
${sample.templateSettings.customInstructions ? `- Custom Instructions: ${sample.templateSettings.customInstructions}` : ''}
`).join('\n')}\n\n**DESIGN GUIDANCE:** Use the sample paper analysis to guide the question paper structure, layout, and formatting. Follow the design patterns and maintain consistency with the proven sample structure.` : ''}

${templates && templates.length > 0 ? `\n**AVAILABLE TEMPLATES FOR DESIGN GUIDANCE:**\n${templates.map(template => `
- Template: ${template.title}
- Description: ${template.description || 'No description'}
- Version: ${template.version}
- File: ${template.templateFile.fileName}
- Analysis: ${template.analysis ? `${template.analysis.totalQuestions} questions, ${template.analysis.markDistribution.totalMarks} total marks` : 'Analysis pending'}
- Question Types: ${template.analysis?.questionTypes?.join(', ') || 'Not analyzed'}
- Sections: ${template.analysis?.sections?.map(s => `${s.name} (${s.questions} questions, ${s.marks} marks)`).join(', ') || 'Not analyzed'}
- Design Pattern: ${template.analysis?.designPattern?.layout || 'Standard'} layout, ${template.analysis?.designPattern?.formatting || 'Standard'} formatting
- Section Headers: ${template.analysis?.designPattern?.sectionHeaders?.join(', ') || 'Standard headers'}
- Template Settings: Use as template: ${template.templateSettings?.useAsTemplate || true}, Follow design: ${template.templateSettings?.followDesign || true}, Maintain structure: ${template.templateSettings?.maintainStructure || true}
${template.templateSettings?.customInstructions ? `- Custom Instructions: ${template.templateSettings.customInstructions}` : ''}
`).join('\n')}\n\n**TEMPLATE GUIDANCE:** Use the uploaded template files to guide the question paper structure, layout, and formatting. Follow the design patterns from the templates and maintain consistency with the proven template structure.` : ''}

${customInstructions ? `\n**CUSTOM INSTRUCTIONS:**\n${customInstructions}` : ''}

**REQUIREMENTS:**
1. **CRITICAL: Generate EXACTLY ${markDistribution.totalQuestions} questions - NO MORE, NO LESS**
2. Follow the mark distribution precisely
3. Distribute questions according to Bloom's taxonomy percentages
4. **DO NOT generate extra questions beyond the specified count**
5. **CRITICAL: Generate question types based on the specific distribution provided**
6. **For 1-mark questions: Generate ${questionTypeDistribution.filter(qt => qt.marks === 1).map(qt => `${qt.type} (${qt.percentage}%)`).join(', ') || 'SHORT_ANSWER or ONE_WORD_ANSWER based on content complexity'} questions**
7. **For 2-mark questions: Generate ${questionTypeDistribution.filter(qt => qt.marks === 2).map(qt => `${qt.type} (${qt.percentage}%)`).join(', ') || 'SHORT_ANSWER or CHOOSE_BEST_ANSWER based on content complexity'} questions**
8. **For 3-mark questions: Generate ${questionTypeDistribution.filter(qt => qt.marks === 3).map(qt => `${qt.type} (${qt.percentage}%)`).join(', ') || 'SHORT_ANSWER only (no multiple choice for 3+ marks)'} questions**
9. **For 5-mark questions: Generate ${questionTypeDistribution.filter(qt => qt.marks === 5).map(qt => `${qt.type} (${qt.percentage}%)`).join(', ') || 'LONG_ANSWER or detailed SHORT_ANSWER based on content complexity'} questions**
10. Ensure questions are age-appropriate for ${className}
11. Make questions relevant to ${subjectName}
12. Include ${twistedQuestionsPercentage}% twisted/challenging questions
13. Provide clear, unambiguous questions
14. Include appropriate options for multiple choice questions
15. Provide correct answers and explanations
16. For matching pairs, provide clear left and right items
17. For drawing questions, provide clear instructions
18. For marking questions, specify what to mark

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
    "visualAids": ["diagram description", "figure reference"],
    "diagram": {
      "description": "Brief text describing what should be drawn (e.g., 'Graph of y = sin⁻¹(x/2) showing domain and range')",
      "type": "graph | geometry | circuit | chart | diagram | figure | other",
      "status": "pending",
      "altText": "Accessible description of the diagram (e.g., 'A smooth curve passing through the origin, symmetric about y=x')"
    },
    "tags": ["tag1", "tag2"]
  }
]

**FINAL CRITICAL INSTRUCTIONS:**
${hasPatternDiagrams ? `0. **HIGHEST PRIORITY: The pattern file contains diagrams/graphs. You MUST include diagram-based questions (DRAWING_DIAGRAM or MARKING_PARTS) in your generated question paper. This is MANDATORY, not optional. Replace 2-3 regular questions with diagram questions while maintaining the total question count and mark distribution.**` : ''}
1. **MUST follow the exact question type distribution specified above**
2. **QUESTION TYPE DISTRIBUTION RULES (CRITICAL):**
   - **Follow the exact question type distribution specified above**
   ${hasPatternDiagrams ? `   - **MANDATORY: Include at least 2-3 DRAWING_DIAGRAM or MARKING_PARTS questions to match the pattern's diagram style**` : ''}
   - **If CHOOSE_MULTIPLE_ANSWERS is specified for any mark category, generate it with proper options**
   - **If CHOOSE_BEST_ANSWER is specified for any mark category, generate it with proper options**
   - **For questions without specified types, use mark-appropriate defaults**
3. **DEFAULT RULES (only when no specific question type is specified):**
   - **1-mark questions**: Default to ONE_WORD_ANSWER, TRUE_FALSE, or simple SHORT_ANSWER
   - **2-mark questions**: Default to SHORT_ANSWER or CHOOSE_BEST_ANSWER
   - **3-mark questions**: Default to SHORT_ANSWER (no multiple choice for 3+ marks)
   - **5-mark questions**: Default to LONG_ANSWER or detailed SHORT_ANSWER
4. **ABSOLUTELY FORBIDDEN for 5-mark questions (only when no specific type is specified):**
   - NO CHOOSE_BEST_ANSWER
   - NO CHOOSE_MULTIPLE_ANSWERS
   - NO FILL_BLANKS
   - NO ONE_WORD_ANSWER
   - NO TRUE_FALSE
   - NO MATCHING_PAIRS
   - NO DRAWING_DIAGRAM
   - NO MARKING_PARTS
4. **5-mark questions MUST be comprehensive, analytical, and require detailed written responses**
5. **For CHOOSE_MULTIPLE_ANSWERS: Include both 'options' array AND 'multipleCorrectAnswers' array**
6. **For TRUE_FALSE: Do NOT include options array, just set correctAnswer to "True" or "False"**
7. **For FILL_BLANKS: Use ___ in question text, do NOT include options array**
8. **For CHOOSE_BEST_ANSWER: Include options array with exactly 4 options**
9. **Each question MUST match the specified questionType exactly**
10. **Do NOT mix question types - follow the distribution precisely**
11. **For 5-mark questions: Ensure they are comprehensive and detailed, requiring substantial answers**
12. **REMEMBER: Question type should match the marks - higher marks = more detailed answer types**
13. **CRITICAL FOR CHOOSE_MULTIPLE_ANSWERS: You MUST include both 'options' array (4-6 options) AND 'multipleCorrectAnswers' array (2-3 correct answers)**
14. **If you generate CHOOSE_MULTIPLE_ANSWERS without options, the question will be unusable**
15. **PRIORITY: Always follow the specific question type distribution over default rules**
16. **If CHOOSE_MULTIPLE_ANSWERS is specified, ignore any conflicting mark-based restrictions**

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
      const responseText = response.text();
      
      // Log raw Gemini response for debugging diagram instructions
      console.log('📥 GEMINI RAW RESPONSE (check for diagram instructions):');
      console.log(responseText.substring(0, 2000)); // First 2000 chars to see if diagrams are mentioned
      
      return responseText;
    } catch (error: any) {
      console.error('Error with Gemini API:', error);
      
      // Handle quota exceeded (429) errors
      if (error.status === 429 || error instanceof Error ? error.message : "Unknown error"?.includes('429') || error instanceof Error ? error.message : "Unknown error"?.includes('quota')) {
        const errorDetails = error.errorDetails || [];
        const retryInfo = errorDetails.find((detail: any) => detail['@type']?.includes('RetryInfo'));
        const quotaInfo = errorDetails.find((detail: any) => detail['@type']?.includes('QuotaFailure'));
        
        let retryDelay = 'unknown';
        let quotaMessage = 'Your daily quota has been exceeded.';
        
        if (retryInfo?.retryDelay) {
          const delaySeconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
          const delayMinutes = Math.ceil(delaySeconds / 60);
          retryDelay = `${delayMinutes} minute${delayMinutes > 1 ? 's' : ''}`;
        }
        
        if (quotaInfo?.violations) {
          const violation = quotaInfo.violations[0];
          if (violation?.quotaValue) {
            quotaMessage = `You have exceeded your free tier limit of ${violation.quotaValue} requests per day.`;
          }
        }
        
        const quotaError = new Error(
          `Gemini API quota exceeded: ${quotaMessage} Please try again in ${retryDelay}, or upgrade your Google AI plan for higher limits.`
        );
        (quotaError as any).status = 429;
        (quotaError as any).retryAfter = retryDelay;
        throw quotaError;
      }
      
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    }
  }

  /**
   * Generate questions using OpenAI API
   */
  private static async generateWithOpenAI(prompt: string): Promise<string> {
    try {
      const { OpenAI } = await import('openai');
      const openaiConfig: {
        apiKey: string;
        baseURL?: string;
      } = {
        apiKey: this.config.apiKey,
      };
      if (this.config.baseUrl) {
        openaiConfig.baseURL = this.config.baseUrl;
      }
      const openai = new OpenAI(openaiConfig);

      const openaiParams: any = {
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
      };
      if (this.config.temperature !== undefined) {
        openaiParams.temperature = this.config.temperature;
      }
      if (this.config.maxTokens !== undefined) {
        openaiParams.max_tokens = this.config.maxTokens;
      }
      const completion = await openai.chat.completions.create(openaiParams);

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI API');
      }
      
      // Log raw OpenAI response for debugging diagram instructions
      console.log('📥 OPENAI RAW RESPONSE (check for diagram instructions):');
      console.log(response.substring(0, 2000)); // First 2000 chars to see if diagrams are mentioned
      
      return response;
    } catch (error: unknown) {
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
      const anthropicConfig: {
        apiKey: string;
        baseURL?: string;
      } = {
        apiKey: this.config.apiKey,
      };
      if (this.config.baseUrl) {
        anthropicConfig.baseURL = this.config.baseUrl;
      }
      const anthropic = new Anthropic(anthropicConfig);

      if (this.config.maxTokens === undefined) {
        throw new Error('maxTokens is required for Anthropic API');
      }
      const message = await anthropic.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature || 0.7,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const response = message.content[0];
      if (!response || response.type !== 'text') {
        throw new Error('Unexpected response type from Anthropic API');
      }
      if ('text' in response && typeof response.text === 'string') {
        return response.text;
      }
      throw new Error('Invalid response format from Anthropic API');
    } catch (error: unknown) {
      console.error('Error with Anthropic API:', error);
      throw new Error(`Anthropic API error: ${(error as Error).message}`);
    }
  }

  /**
   * Generate mock question paper for testing
   */
  private static async generateMockQuestionPaper(request: EnhancedQuestionGenerationRequest): Promise<string> {
    const questions: EnhancedGeneratedQuestion[] = [];
    const { markDistribution, questionTypeDistribution } = request;

    // Generate questions based on mark distribution and question type distribution
    let questionCount = 0;
    
    // Generate 1-mark questions
    if (markDistribution.oneMark > 0) {
      const oneMarkTypes = questionTypeDistribution.filter(qt => 
        qt.type === 'TRUE_FALSE' || qt.type === 'ONE_WORD_ANSWER' || qt.type === 'SHORT_ANSWER'
      );
      
      for (let i = 0; i < markDistribution.oneMark; i++) {
        const firstType = oneMarkTypes.length > 0 ? oneMarkTypes[0] : undefined;
        const questionType = firstType?.type || 'TRUE_FALSE';
        questions.push(this.createMockQuestion(1, questionType, 'REMEMBER', request));
        questionCount++;
      }
    }

    // Generate 2-mark questions
    if (markDistribution.twoMark > 0) {
      const twoMarkTypes = questionTypeDistribution.filter(qt => 
        qt.type === 'SHORT_ANSWER' || qt.type === 'CHOOSE_BEST_ANSWER'
      );
      
      for (let i = 0; i < markDistribution.twoMark; i++) {
        const firstType = twoMarkTypes.length > 0 ? twoMarkTypes[0] : undefined;
        const questionType = firstType?.type || 'SHORT_ANSWER';
        questions.push(this.createMockQuestion(2, questionType, 'UNDERSTAND', request));
        questionCount++;
      }
    }

    // Generate 3-mark questions
    if (markDistribution.threeMark > 0) {
      for (let i = 0; i < markDistribution.threeMark; i++) {
        questions.push(this.createMockQuestion(3, 'SHORT_ANSWER', 'APPLY', request));
        questionCount++;
      }
    }

    // Generate 5-mark questions
    if (markDistribution.fiveMark > 0) {
      for (let i = 0; i < markDistribution.fiveMark; i++) {
        questions.push(this.createMockQuestion(5, 'LONG_ANSWER', 'ANALYZE', request));
        questionCount++;
      }
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
      'LONG_ANSWER': `Analyze the impact of climate change on biodiversity and suggest three mitigation strategies.`,
      'TRUE_FALSE': `The capital of France is Paris.`,
      'ONE_WORD_ANSWER': `What is the chemical symbol for gold?`
    };

    const correctAnswers = {
      'CHOOSE_BEST_ANSWER': 'Energy production',
      'FILL_BLANKS': 'chloroplasts',
      'SHORT_ANSWER': 'Mitosis produces identical cells while meiosis produces genetically diverse cells.',
      'LONG_ANSWER': 'Climate change significantly impacts biodiversity through habitat loss, temperature changes, and ecosystem disruption. Mitigation strategies include reducing greenhouse gas emissions, protecting natural habitats, and implementing sustainable practices.',
      'TRUE_FALSE': 'True',
      'ONE_WORD_ANSWER': 'Au'
    };

    const options = {
      'CHOOSE_BEST_ANSWER': ['Energy production', 'Protein synthesis', 'DNA replication', 'Waste removal'],
      'FILL_BLANKS': undefined,
      'SHORT_ANSWER': undefined,
      'LONG_ANSWER': undefined,
      'TRUE_FALSE': undefined,
      'ONE_WORD_ANSWER': undefined
    };

    const questionOptions = options[questionType as keyof typeof options];
    const result: {
      questionText: string;
      questionType: any;
      marks: number;
      bloomsLevel: any;
      difficulty: 'EASY' | 'MODERATE' | 'TOUGHEST';
      isTwisted: boolean;
      options?: string[];
      correctAnswer: string;
      explanation: string;
      tags: string[];
    } = {
      questionText: questionTexts[questionType as keyof typeof questionTexts] || 'Sample question text',
      questionType: questionType as any,
      marks,
      bloomsLevel: bloomsLevel as any,
      difficulty: request.difficultyLevel,
      isTwisted: Math.random() < (request.twistedQuestionsPercentage / 100),
      correctAnswer: correctAnswers[questionType as keyof typeof correctAnswers] || 'Sample correct answer',
      explanation: 'This is a sample explanation for the answer.',
      tags: ['sample', 'test']
    };
    if (questionOptions) {
      result.options = questionOptions;
    }
    return result;
  }

  /**
   * Enforce mark-based question types after AI generation
   * NOTE: This function now respects specific question type distributions
   */
  private static enforceMarkBasedQuestionTypes(questions: EnhancedGeneratedQuestion[]): EnhancedGeneratedQuestion[] {
    return questions.map(question => {
      const marks = question.marks;
      let correctedQuestionType = question.questionType;
      
      // Only apply mark-based restrictions for 5-mark questions (which should never be multiple choice)
      if (marks === 5) {
        // 5-mark questions: ONLY long answers or detailed short answers
        if (!['LONG_ANSWER', 'SHORT_ANSWER'].includes(question.questionType)) {
          correctedQuestionType = 'LONG_ANSWER';
        }
        
        // For 5-mark questions, ensure they are comprehensive
        if (question.questionType === 'SHORT_ANSWER' && marks === 5) {
          // Convert to LONG_ANSWER for 5-mark questions to ensure they are comprehensive
          correctedQuestionType = 'LONG_ANSWER';
        }
        
        // Remove options for 5-mark questions (they should be long answers)
        if (correctedQuestionType !== 'CHOOSE_BEST_ANSWER' && correctedQuestionType !== 'CHOOSE_MULTIPLE_ANSWERS') {
          delete question.options;
        }
      }
      
      // For all other marks (1, 2, 3), preserve the original question type and options
      // The AI prompt now handles the correct question type generation
      
      return {
        ...question,
        questionType: correctedQuestionType
      };
    });
  }

  /**
   * Apply mark-based distribution to ensure correct question types
   */
  private static applyMarkBasedDistribution(questions: EnhancedGeneratedQuestion[], request: EnhancedQuestionGenerationRequest): EnhancedGeneratedQuestion[] {
    const { markDistribution, questionTypeDistribution } = request;
    const distributedQuestions: EnhancedGeneratedQuestion[] = [];
    
    // Process each mark category using the marks context from questionTypeDistribution
    const markCategories = [
      { mark: 1, count: markDistribution.oneMark, distributions: questionTypeDistribution.filter(qt => qt.marks === 1) },
      { mark: 2, count: markDistribution.twoMark, distributions: questionTypeDistribution.filter(qt => qt.marks === 2) },
      { mark: 3, count: markDistribution.threeMark, distributions: questionTypeDistribution.filter(qt => qt.marks === 3) },
      { mark: 5, count: markDistribution.fiveMark, distributions: questionTypeDistribution.filter(qt => qt.marks === 5) }
    ];
    
    for (const category of markCategories) {
      if (category.count > 0) {
        // Get questions of this mark value
        let questionsForThisMark = questions.filter(q => q.marks === category.mark);
        
        console.log(`Mark ${category.mark}: Need ${category.count} questions, have ${questionsForThisMark.length} from AI`);
        
        // If we don't have enough questions for this mark, try to use questions from other marks
        // This can happen if AI mis-assigned marks
        if (questionsForThisMark.length < category.count) {
          const shortfall = category.count - questionsForThisMark.length;
          const questionsWithWrongMarks = questions.filter(q => q.marks !== category.mark && !distributedQuestions.some(dq => dq.questionText === q.questionText && dq.marks === q.marks));
          
          // Try to find questions that can be repurposed (only for simple reassignments)
          for (let i = 0; i < Math.min(shortfall, questionsWithWrongMarks.length); i++) {
            const q = questionsWithWrongMarks[i];
            if (!q || !q.questionText) continue;
            questionsForThisMark.push({
              ...q,
              questionText: q.questionText,
              marks: category.mark
            });
          }
          
          console.log(`Mark ${category.mark}: After supplementing, have ${questionsForThisMark.length} questions`);
        }
        
        // If we have specific question type distributions for this mark, apply them
        if (category.distributions.length > 0) {
          // Calculate how many questions of each type we need
          const typeCounts: { [key: string]: number } = {};
          let remainingQuestions = category.count;
          
          for (let i = 0; i < category.distributions.length - 1; i++) {
            const dist = category.distributions[i];
            if (!dist) continue;
            const count = Math.floor((dist.percentage / 100) * category.count);
            typeCounts[dist.type] = count;
            remainingQuestions -= count;
          }
          
          // Assign remaining questions to the last type
          if (category.distributions.length > 0) {
            const lastDist = category.distributions[category.distributions.length - 1];
            if (lastDist) {
              typeCounts[lastDist.type] = remainingQuestions;
            }
          }
          
          // Distribute questions based on type counts
          let questionIndex = 0;
          for (const [type, count] of Object.entries(typeCounts)) {
            let addedCount = 0;
            for (let i = 0; i < count && questionIndex < questionsForThisMark.length; i++) {
              const question = questionsForThisMark[questionIndex];
              if (!question || !question.questionText) {
                questionIndex++;
                continue;
              }
              distributedQuestions.push({
                ...question,
                questionText: question.questionText,
                questionType: type as any,
                marks: category.mark
              });
              questionIndex++;
              addedCount++;
            }
            
            // If we didn't get enough questions of this type, create placeholders or reuse questions
            if (addedCount < count && questionIndex >= questionsForThisMark.length) {
              // Reuse the last question of this mark type, or create a modified version
              const lastQuestion = questionsForThisMark[questionsForThisMark.length - 1] || questionsForThisMark[0];
              if (lastQuestion) {
                for (let j = addedCount; j < count; j++) {
                  distributedQuestions.push({
                    ...lastQuestion,
                    questionText: `${lastQuestion.questionText} (Variation ${j + 1})`,
                    questionType: type as any,
                    marks: category.mark,
                    bloomsLevel: lastQuestion.bloomsLevel || 'UNDERSTAND',
                    difficulty: lastQuestion.difficulty || 'MODERATE',
                    correctAnswer: lastQuestion.correctAnswer || '',
                    explanation: lastQuestion.explanation || ''
                  });
                }
                console.log(`Mark ${category.mark}, Type ${type}: Created ${count - addedCount} additional questions to meet count requirement`);
              }
            }
          }
        } else {
          // No specific distribution, just add questions as-is (up to the count needed)
          const questionsToAdd = Math.min(questionsForThisMark.length, category.count);
          distributedQuestions.push(...questionsForThisMark.slice(0, questionsToAdd));
          
          // If we need more questions than we have, duplicate the last one
          if (questionsToAdd < category.count && questionsForThisMark.length > 0) {
            const lastQuestion = questionsForThisMark[questionsForThisMark.length - 1] || questionsForThisMark[0];
            if (lastQuestion) {
              for (let i = questionsToAdd; i < category.count; i++) {
                distributedQuestions.push({
                  ...lastQuestion,
                  questionText: `${lastQuestion.questionText} (Variation ${i - questionsToAdd + 1})`,
                  marks: category.mark,
                  questionType: lastQuestion.questionType,
                  bloomsLevel: lastQuestion.bloomsLevel || 'UNDERSTAND',
                  difficulty: lastQuestion.difficulty || 'MODERATE',
                  correctAnswer: lastQuestion.correctAnswer || '',
                  explanation: lastQuestion.explanation || ''
                });
              }
              console.log(`Mark ${category.mark}: Created ${category.count - questionsToAdd} additional questions to meet count requirement`);
            }
          }
        }
        
        console.log(`Mark ${category.mark}: Added ${distributedQuestions.filter(q => q.marks === category.mark && distributedQuestions.indexOf(q) >= distributedQuestions.length - category.count).length} questions`);
      }
    }
    
    console.log(`Distribution complete: ${distributedQuestions.length} questions distributed (target: ${request.markDistribution.totalQuestions})`);
    return distributedQuestions;
  }

  /**
   * Parse generated questions from AI response
   */
  private static parseGeneratedQuestions(response: string): EnhancedGeneratedQuestion[] {
    try {
      // Clean the response to extract JSON
      let cleanedResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON array from the response if it's wrapped in text
      const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }
      
      // No base64 handling needed - we use diagram objects instead
      console.log(`🔍 Parsing JSON response (length: ${cleanedResponse.length})...`);
      
      // Fix common JSON issues: trailing commas, trailing commas before closing brackets
      // CRITICAL: Remove trailing commas before ] or } - these break JSON parsing
      // Use more aggressive patterns to catch all cases
      cleanedResponse = cleanedResponse
        // Remove trailing commas before closing brackets (with various whitespace patterns)
        .replace(/,\s*]/g, ']')  // Array: ["a", "b", ] -> ["a", "b"]
        .replace(/,\s*}/g, '}')  // Object: {"a": 1, } -> {"a": 1}
        // Remove multiple consecutive commas
        .replace(/,\s*,\s*/g, ',')  // Fix: ,, -> ,
        // More aggressive: remove comma before closing if preceded by quote or value
        .replace(/"\s*,\s*]/g, '"]')  // ["a",] -> ["a"]
        .replace(/"\s*,\s*}/g, '"}')  // {"a": "b",} -> {"a": "b"}
        // Remove trailing commas in arrays (more patterns)
        .replace(/(\w+|"|'|\d+)\s*,\s*]/g, '$1]')  // any value, ] -> value]
        // Remove trailing commas in objects  
        .replace(/(\w+|"|'|\d+)\s*,\s*}/g, '$1}')  // any value, } -> value}
        // Final cleanup: any remaining trailing commas before ] or }
        .replace(/,\s*([\]}])/g, '$1');
      
      // Additional fix: Look for specific patterns like array items with trailing commas
      // This handles cases like: ["item1", "item2",] or ["item1", "item2", ]
      // We need to be careful not to break valid JSON inside strings
      // Use a more sophisticated approach: find arrays and fix them
      let fixedResponse = '';
      let inString = false;
      let stringEscape = false;
      let depth = 0;
      let inArray = false;
      
      for (let i = 0; i < cleanedResponse.length; i++) {
        const char = cleanedResponse[i];
        const nextChar = i + 1 < cleanedResponse.length ? cleanedResponse[i + 1] : '';
        const nextFew = cleanedResponse.substring(i + 1, i + 5).trim();
        
        // Track string state
        if (char === '\\' && inString) {
          stringEscape = !stringEscape;
          fixedResponse += char;
          continue;
        }
        
        if (char === '"' && !stringEscape) {
          inString = !inString;
          fixedResponse += char;
          continue;
        }
        
        stringEscape = false;
        
        // Track array/object depth
        if (!inString) {
          if (char === '[') {
            inArray = true;
            depth++;
          } else if (char === ']') {
            inArray = false;
            depth--;
          } else if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
          }
          
          // If we see a comma followed by closing bracket/brace, skip the comma
          if (char === ',' && (nextFew.startsWith(']') || nextFew.startsWith('}'))) {
            // Skip this comma - it's a trailing comma
            continue;
          }
        }
        
        fixedResponse += char;
      }
      
      cleanedResponse = fixedResponse;
      
      // Final cleanup pass
      cleanedResponse = cleanedResponse
        .replace(/,\s*]/g, ']')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*,\s*/g, ',');
      
      // CRITICAL: Check if JSON is properly closed (truncated response detection)
      // Count opening and closing brackets/braces to see if response is incomplete
      const openBraces = (cleanedResponse.match(/{/g) || []).length;
      const closeBraces = (cleanedResponse.match(/}/g) || []).length;
      const openBrackets = (cleanedResponse.match(/\[/g) || []).length;
      const closeBrackets = (cleanedResponse.match(/\]/g) || []).length;
      
      const missingBraces = openBraces - closeBraces;
      const missingBrackets = openBrackets - closeBrackets;
      
      // Check if response ends mid-string, mid-array, or mid-object
      let checkInString = false;
      let checkStringEscape = false;
      let checkDepth = 0;
      let checkInArray = false;
      let lastCompleteObjectEnd = -1;
      let lastCompleteArrayEnd = -1;
      
      for (let i = 0; i < cleanedResponse.length; i++) {
        const char = cleanedResponse[i];
        
        // Track string state
        if (char === '\\' && checkInString) {
          checkStringEscape = !checkStringEscape;
          continue;
        }
        
        if (char === '"' && !checkStringEscape) {
          checkInString = !checkInString;
          continue;
        }
        
        checkStringEscape = false;
        
        // Track depth when not in string
        if (!checkInString) {
          if (char === '[') {
            checkInArray = true;
            checkDepth++;
          } else if (char === ']') {
            checkDepth--;
            if (checkDepth === 0 || (checkDepth === 1 && !checkInArray)) {
              lastCompleteArrayEnd = i;
            }
          } else if (char === '{') {
            checkDepth++;
          } else if (char === '}') {
            checkDepth--;
            // If we've closed a question object (depth goes from 2 to 1, meaning we're back in the array)
            if (checkDepth === 1 && checkInArray) {
              lastCompleteObjectEnd = i;
            }
          }
        }
      }
      
      // If response ends in a string or we're still inside structures, it's truncated
      const endsInString = checkInString;
      const stillInStructure = checkDepth > 0 || checkInArray;
      
      if (endsInString || stillInStructure || missingBraces > 0 || missingBrackets > 0) {
        console.log(`⚠️ Detected incomplete/truncated JSON response`);
        console.log(`   Ends in string: ${endsInString}, Still in structure: ${stillInStructure}`);
        console.log(`   Missing braces: ${missingBraces}, Missing brackets: ${missingBrackets}`);
        console.log(`   Last complete object ends at: ${lastCompleteObjectEnd}, Last complete array ends at: ${lastCompleteArrayEnd}`);
        
        // Find the best truncation point - prefer last complete question object
        let truncatePos = cleanedResponse.length - 1;
        if (lastCompleteObjectEnd > 0) {
          // Use the position right after the last complete question object
          truncatePos = lastCompleteObjectEnd + 1;
        } else if (lastCompleteArrayEnd > 0) {
          truncatePos = lastCompleteArrayEnd + 1;
        } else {
          // Fallback: find the last complete closing brace or bracket
          const lastBrace = cleanedResponse.lastIndexOf('}');
          const lastBracket = cleanedResponse.lastIndexOf(']');
          if (lastBrace > lastBracket && lastBrace > 0) {
            truncatePos = lastBrace + 1;
          } else if (lastBracket > 0) {
            truncatePos = lastBracket + 1;
          }
        }
        
        // Truncate to the last complete structure
        let fixedResponse = cleanedResponse.substring(0, truncatePos).trim();
        
        // Remove any trailing comma
        if (fixedResponse.endsWith(',')) {
          fixedResponse = fixedResponse.slice(0, -1).trim();
        }
        
        // Close any open strings (shouldn't happen but just in case)
        if (endsInString) {
          fixedResponse += '"';
        }
        
        // Close any open objects first (innermost to outermost)
        for (let i = 0; i < missingBraces; i++) {
          fixedResponse += '}';
        }
        
        // Close any open arrays
        for (let i = 0; i < missingBrackets; i++) {
          fixedResponse += ']';
        }
        
        // Double-check and close any remaining structures
        const finalOpenBraces = (fixedResponse.match(/{/g) || []).length;
        const finalCloseBraces = (fixedResponse.match(/}/g) || []).length;
        const finalOpenBrackets = (fixedResponse.match(/\[/g) || []).length;
        const finalCloseBrackets = (fixedResponse.match(/\]/g) || []).length;
        
        const stillOpenBraces = finalOpenBraces - finalCloseBraces;
        const stillOpenBrackets = finalOpenBrackets - finalCloseBrackets;
        
        // Close objects first, then arrays
        for (let i = 0; i < stillOpenBraces; i++) {
          fixedResponse += '}';
        }
        for (let i = 0; i < stillOpenBrackets; i++) {
          fixedResponse += ']';
        }
        
        cleanedResponse = fixedResponse;
        console.log(`✅ Fixed truncated JSON - closed ${stillOpenBraces} brace(s) and ${stillOpenBrackets} bracket(s)`);
        console.log(`   Fixed response ends with: ${cleanedResponse.slice(-80)}`);
      }
      
      // Try parsing with error handling
      let questions;
      try {
        questions = JSON.parse(cleanedResponse);
      } catch (parseError) {
        // If still fails, try to fix more aggressively
        console.warn('First JSON parse attempt failed, trying aggressive cleanup:', parseError);
        
        // More aggressive fixes (but preserve placeholders)
        cleanedResponse = cleanedResponse
          // Fix unquoted keys (common AI mistake)
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, (match, prefix) => {
            const keyPart = match.split(':')[0];
            if (!keyPart) return match;
            return `${prefix}"${keyPart.trim().replace(/[{,]\s*/, '')}":`;
          })
          // Fix single quotes to double quotes (but not in placeholders)
          .replace(/'/g, '"')
          // Remove trailing commas more aggressively
          .replace(/,\s*([}\]])/g, '$1')
          // Fix common issues with array values
          .replace(/\[([^\]]*),\]/g, '[$1]');
        
        try {
          questions = JSON.parse(cleanedResponse);
        } catch (secondError) {
          // Log the problematic response for debugging (truncate base64 if present)
          const debugResponse = cleanedResponse.substring(0, 5000); // Show more context
          console.error('Failed to parse JSON after cleanup. Response snippet (first 5000 chars):', debugResponse);
          console.error('Parse error:', secondError);
          throw new Error(`Failed to parse AI response as JSON. The response may be malformed. Original error: ${(parseError as Error).message}`);
        }
      }
      
      // No base64 restoration needed - diagram objects are already in the parsed JSON
      
      if (!Array.isArray(questions)) {
        throw new Error('Response is not an array of questions');
      }

      // Map questions and restore base64 strings if needed
      return questions.map((q: any) => {
        // Debug logging for CHOOSE_MULTIPLE_ANSWERS questions
        if (q.questionType === 'CHOOSE_MULTIPLE_ANSWERS') {
          console.log('DEBUG - CHOOSE_MULTIPLE_ANSWERS question:', {
            questionText: q.questionText,
            options: q.options,
            multipleCorrectAnswers: q.multipleCorrectAnswers,
            correctAnswer: q.correctAnswer
          });
        }

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

        // Handle questionType validation - fix common AI mistakes
        let questionType = q.questionType || 'SHORT_ANSWER';
        const validQuestionTypes = [
          'CHOOSE_BEST_ANSWER', 'FILL_BLANKS', 'ONE_WORD_ANSWER', 'TRUE_FALSE', 
          'CHOOSE_MULTIPLE_ANSWERS', 'MATCHING_PAIRS', 'DRAWING_DIAGRAM', 
          'MARKING_PARTS', 'SHORT_ANSWER', 'LONG_ANSWER'
        ];
        
        // If questionType is a Blooms level, map it to a mark-appropriate question type
        const bloomsLevels = ['REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE'];
        if (bloomsLevels.includes(questionType)) {
          // Map Blooms levels to mark-appropriate question types based on marks
          const marks = q.marks || 1;
          let bloomsToQuestionType: { [key: string]: string };
          
          if (marks === 1) {
            bloomsToQuestionType = {
              'REMEMBER': 'ONE_WORD_ANSWER',
              'UNDERSTAND': 'TRUE_FALSE',
              'APPLY': 'SHORT_ANSWER',
              'ANALYZE': 'SHORT_ANSWER',
              'EVALUATE': 'SHORT_ANSWER',
              'CREATE': 'SHORT_ANSWER'
            };
          } else if (marks === 2) {
            bloomsToQuestionType = {
              'REMEMBER': 'SHORT_ANSWER',
              'UNDERSTAND': 'CHOOSE_BEST_ANSWER',
              'APPLY': 'SHORT_ANSWER',
              'ANALYZE': 'SHORT_ANSWER',
              'EVALUATE': 'SHORT_ANSWER',
              'CREATE': 'SHORT_ANSWER'
            };
          } else if (marks === 3) {
            bloomsToQuestionType = {
              'REMEMBER': 'SHORT_ANSWER',
              'UNDERSTAND': 'SHORT_ANSWER',
              'APPLY': 'SHORT_ANSWER',
              'ANALYZE': 'SHORT_ANSWER',
              'EVALUATE': 'SHORT_ANSWER',
              'CREATE': 'SHORT_ANSWER'
            };
          } else if (marks === 5) {
            bloomsToQuestionType = {
              'REMEMBER': 'LONG_ANSWER',
              'UNDERSTAND': 'LONG_ANSWER',
              'APPLY': 'LONG_ANSWER',
              'ANALYZE': 'LONG_ANSWER',
              'EVALUATE': 'LONG_ANSWER',
              'CREATE': 'LONG_ANSWER'
            };
          } else {
            bloomsToQuestionType = {
              'REMEMBER': 'SHORT_ANSWER',
              'UNDERSTAND': 'SHORT_ANSWER',
              'APPLY': 'SHORT_ANSWER',
              'ANALYZE': 'SHORT_ANSWER',
              'EVALUATE': 'LONG_ANSWER',
              'CREATE': 'LONG_ANSWER'
            };
          }
          
          questionType = bloomsToQuestionType[questionType] || 'SHORT_ANSWER';
        } else if (!validQuestionTypes.includes(questionType)) {
          questionType = 'SHORT_ANSWER';
        }

        return {
          questionText: q.questionText || '',
          questionType: questionType,
          marks: q.marks || 1,
          bloomsLevel: q.bloomsLevel || 'REMEMBER',
          difficulty: q.difficulty || 'MODERATE',
          isTwisted: q.isTwisted || false,
          options: q.options || [],
          correctAnswer: correctAnswer,
          explanation: q.explanation || '',
          matchingPairs: q.matchingPairs || [],
          multipleCorrectAnswers: q.multipleCorrectAnswers || [],
          drawingInstructions: q.drawingInstructions || '',
          markingInstructions: q.markingInstructions || '',
          visualAids: q.visualAids || [],
          tags: q.tags || [],
          diagramDescription: q.diagramDescription || q.visualAids?.[0] || undefined,
          // Parse diagram object from AI response
          ...(q.diagram ? {
            diagram: {
              description: q.diagram.description || q.diagramDescription || '',
              type: (q.diagram.type || 'diagram') as 'graph' | 'geometry' | 'circuit' | 'chart' | 'diagram' | 'figure' | 'other',
              status: ((q.diagram.status as 'pending' | 'ready') || 'pending') as 'pending' | 'ready',
              ...(q.diagram.altText || q.diagram.description ? { altText: q.diagram.altText || q.diagram.description } : {})
            }
          } : {})
        };
      });
    } catch (error: unknown) {
      console.error('Error parsing AI response:', error);
      throw new Error(`Failed to parse AI response: ${(error as Error).message}`);
    }
  }
}

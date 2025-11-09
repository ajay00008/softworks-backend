import { PDFGenerationService } from './pdfGenerationService';
import { Subject } from '../models/Subject';
import { Class } from '../models/Class';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import logger from '../utils/logger';

export interface TemplateValidationResult {
  isValid: boolean;
  confidence: number;
  detectedSubject?: string;
  detectedClass?: string;
  detectedExamType?: string;
  validationErrors: string[];
  suggestions: string[];
  extractedPattern?: {
    totalQuestions: number;
    markDistribution: {
      oneMark: number;
      twoMark: number;
      threeMark: number;
      fiveMark: number;
      totalMarks: number;
    };
    questionTypes: string[];
    difficultyLevels: string[];
    bloomsDistribution: {
      remember: number;
      understand: number;
      apply: number;
      analyze: number;
      evaluate: number;
      create: number;
    };
    sections?: Array<{
      name: string;
      questions: number;
      marks: number;
    }>;
  };
}

export class TemplateValidationService {
  private static genAI: GoogleGenerativeAI | null = null;
  private static model: any = null;

  constructor() {
    // PDFGenerationService methods are static, no need to instantiate
    this.initializeGemini();
  }

  /**
   * Initialize Gemini AI for template analysis
   */
  private initializeGemini(): void {
    try {
      if (!env.GEMINI_API_KEY && !env.AI_API_KEY) {
        logger.warn('Gemini API key not found. Template analysis will use pattern matching only.');
        return;
      }

      const apiKey = env.GEMINI_API_KEY || env.AI_API_KEY || '';
      if (!apiKey) {
        logger.warn('Gemini API key is empty. Template analysis will use pattern matching only.');
        return;
      }

      TemplateValidationService.genAI = new GoogleGenerativeAI(apiKey);
      TemplateValidationService.model = TemplateValidationService.genAI.getGenerativeModel({ 
        model: env.AI_MODEL || 'gemini-2.0-flash-exp' 
      });
      
      logger.info('TemplateValidationService initialized with Gemini AI');
    } catch (error: unknown) {
      logger.error('Failed to initialize Gemini for template validation:', error);
    }
  }

  /**
   * Validates an uploaded template PDF against the specified subject and exam type
   */
  async validateTemplate(
    filePath: string,
    expectedSubjectId: string,
    expectedExamType: string
  ): Promise<TemplateValidationResult> {
    try {
      // Extract text content from PDF
      const pdfText = await PDFGenerationService.extractTextFromPDF(filePath);
      
      // Get subject information for context
      const subject = await Subject.findById(expectedSubjectId);
      
      if (!subject) {
        return {
          isValid: false,
          confidence: 0,
          validationErrors: ['Subject not found'],
          suggestions: ['Please verify the subject selection']
        };
      }

      // Analyze the PDF content using AI
      const analysisResult = await this.analyzeTemplateContent(
        pdfText,
        subject,
        expectedExamType
      );

      // Validate against expected parameters
      const validationResult = this.validateAgainstExpected(
        analysisResult,
        subject,
        expectedExamType
      );

      return validationResult;
    } catch (error: unknown) {
      console.error('Template validation error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        filePath,
        expectedSubjectId,
        expectedExamType
      });
      return {
        isValid: false,
        confidence: 0,
        validationErrors: [`Failed to process template file: ${error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'}`],
        suggestions: ['Please ensure the PDF is readable and try again']
      };
    }
  }

  /**
   * Analyzes the PDF content to extract pattern information using AI
   */
  private async analyzeTemplateContent(
    pdfText: string,
    subject: any,
    examType: string
  ): Promise<any> {
    // Try to use AI first, fallback to pattern matching if AI is not available
    if (TemplateValidationService.model) {
      try {
        return await this.analyzeWithAI(pdfText, subject, examType);
      } catch (error: unknown) {
        logger.warn('AI analysis failed, falling back to pattern matching:', error);
        // Fall through to pattern matching
      }
    }
    
    // Fallback to pattern-based analysis
    return this.analyzeWithPatternMatching(pdfText, subject, examType);
  }

  /**
   * Analyzes template using Gemini AI
   */
  private async analyzeWithAI(
    pdfText: string,
    subject: any,
    examType: string
  ): Promise<any> {
    if (!TemplateValidationService.model) {
      throw new Error('Gemini model not initialized');
    }

    const prompt = `Analyze this question paper template and extract the following information in JSON format:

Expected Subject: ${subject.name} (Code: ${subject.code})
Expected Exam Type: ${examType}

Please extract and return a JSON object with the following structure:
{
  "detectedSubject": "subject name detected from the paper",
  "detectedExamType": "exam type detected (UNIT_TEST, MID_TERM, FINAL, etc.)",
  "totalQuestions": number,
  "markDistribution": {
    "oneMark": number of 1-mark questions,
    "twoMark": number of 2-mark questions,
    "threeMark": number of 3-mark questions,
    "fiveMark": number of 5-mark questions,
    "totalMarks": total marks for the entire paper
  },
  "questionTypes": ["CHOOSE_BEST_ANSWER", "SHORT_ANSWER", etc.],
  "difficultyLevels": ["EASY", "MODERATE", "TOUGHEST"],
  "sections": [
    {
      "name": "Section A",
      "questions": number of questions,
      "marks": total marks for this section
    }
  ]
}

Important:
- Extract the EXACT total marks from the paper (look for "Total Marks: X" or similar)
- Count questions by their mark values (1 mark, 2 marks, 3 marks, 5 marks)
- Include all sections with their question counts and marks
- Return ONLY valid JSON, no additional text

Template Content:
${pdfText.substring(0, 30000)}`; // Limit text to avoid token limits

    try {
      const result = await TemplateValidationService.model.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text().trim();
      
      // Try to extract JSON from the response
      let aiAnalysis;
      try {
        // Remove markdown code blocks if present
        const jsonMatch = aiText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || aiText.match(/(\{[\s\S]*\})/);
        const jsonText = jsonMatch ? jsonMatch[1] : aiText;
        aiAnalysis = JSON.parse(jsonText);
      } catch (parseError) {
        logger.warn('Failed to parse AI response as JSON, using pattern matching fallback');
        throw new Error('Invalid JSON response from AI');
      }

      // Merge AI results with pattern matching for validation
      const patternAnalysis = this.extractPatternFromText(pdfText);
      
      // Use AI results, but validate with pattern matching
      const extractedPattern = {
        totalQuestions: aiAnalysis.totalQuestions || patternAnalysis.totalQuestions,
        markDistribution: {
          oneMark: aiAnalysis.markDistribution?.oneMark || patternAnalysis.markDistribution.oneMark,
          twoMark: aiAnalysis.markDistribution?.twoMark || patternAnalysis.markDistribution.twoMark,
          threeMark: aiAnalysis.markDistribution?.threeMark || patternAnalysis.markDistribution.threeMark,
          fiveMark: aiAnalysis.markDistribution?.fiveMark || patternAnalysis.markDistribution.fiveMark,
          totalMarks: aiAnalysis.markDistribution?.totalMarks || patternAnalysis.markDistribution.totalMarks
        },
        questionTypes: aiAnalysis.questionTypes || patternAnalysis.questionTypes,
        difficultyLevels: aiAnalysis.difficultyLevels || patternAnalysis.difficultyLevels,
        bloomsDistribution: patternAnalysis.bloomsDistribution,
        sections: aiAnalysis.sections || patternAnalysis.sections
      };

      // Normalize detected exam type - map descriptive text to enum values
      const detectedExamTypeRaw = aiAnalysis.detectedExamType || this.detectExamTypeFromText(pdfText, examType);
      const normalizedExamType = this.normalizeExamType(detectedExamTypeRaw, examType);

      const analysis = {
        detectedSubject: aiAnalysis.detectedSubject || this.detectSubjectFromText(pdfText, subject),
        detectedExamType: normalizedExamType,
        extractedPattern,
        confidence: 0
      };

      // Calculate confidence
      let confidence = 0;
      if (analysis.detectedSubject === subject.name) confidence += 30;
      if (analysis.detectedExamType === examType) confidence += 30;
      if (extractedPattern.totalQuestions > 0) confidence += 20;
      if (extractedPattern.markDistribution.totalMarks > 0) confidence += 20;

      analysis.confidence = confidence;
      logger.info('AI analysis completed successfully', { confidence, totalMarks: extractedPattern.markDistribution.totalMarks });
      return analysis;
    } catch (error: unknown) {
      logger.error('Error in AI analysis:', error);
      throw error;
    }
  }

  /**
   * Fallback pattern-based analysis
   */
  private analyzeWithPatternMatching(
    pdfText: string,
    subject: any,
    examType: string
  ): any {
    const extractedPattern = this.extractPatternFromText(pdfText);
    
    const analysis = {
      detectedSubject: this.detectSubjectFromText(pdfText, subject),
      detectedExamType: this.detectExamTypeFromText(pdfText, examType),
      extractedPattern,
      confidence: 0
    };

    // Calculate confidence based on matches and pattern extraction
    let confidence = 0;
    if (analysis.detectedSubject === subject.name) confidence += 30;
    if (analysis.detectedExamType === examType) confidence += 30;
    
    // Add confidence if pattern was successfully extracted
    if (extractedPattern && extractedPattern.totalQuestions > 0) {
      confidence += 20;
    }
    if (extractedPattern && extractedPattern.markDistribution && 
        (extractedPattern.markDistribution.oneMark > 0 || 
         extractedPattern.markDistribution.twoMark > 0 ||
         extractedPattern.markDistribution.threeMark > 0 ||
         extractedPattern.markDistribution.fiveMark > 0)) {
      confidence += 20;
    }

    analysis.confidence = confidence;
    return analysis;
  }

  /**
   * Detects subject from PDF text
   */
  private detectSubjectFromText(text: string, subject: any): string {
    const textLower = text.toLowerCase();
    const subjectLower = subject.name.toLowerCase();
    const subjectCodeLower = subject.code.toLowerCase();
    
    if (textLower.includes(subjectLower) || textLower.includes(subjectCodeLower)) {
      return subject.name;
    }
    
    // Try to detect from common subject keywords
    const subjectKeywords = {
      'Mathematics': ['math', 'mathematics', 'algebra', 'geometry', 'calculus'],
      'Physics': ['physics', 'mechanics', 'thermodynamics', 'optics'],
      'Chemistry': ['chemistry', 'organic', 'inorganic', 'physical chemistry'],
      'Biology': ['biology', 'botany', 'zoology', 'anatomy'],
      'English': ['english', 'literature', 'grammar', 'composition']
    };

    for (const [subjectName, keywords] of Object.entries(subjectKeywords)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        return subjectName;
      }
    }

    return subject.name; // Default to expected subject
  }

  /**
   * Detects exam type from PDF text
   */
  private detectExamTypeFromText(text: string, examType: string): string {
    const textLower = text.toLowerCase();
    
    const examTypeKeywords = {
      'UNIT_TEST': ['unit test', 'unit exam', 'unit'],
      'MID_TERM': ['mid term', 'midterm', 'mid term exam'],
      'FINAL': ['final exam', 'final test', 'annual exam'],
      'QUIZ': ['quiz', 'quick test'],
      'ASSIGNMENT': ['assignment', 'homework'],
      'PRACTICAL': ['practical', 'lab exam', 'practical exam'],
      'TERM_TEST': ['term test', 'term exam'],
      'ANNUAL_EXAM': ['annual exam', 'yearly exam', 'final exam'],
      'CUSTOM_EXAM': ['custom', 'special', 'additional']
    };

    for (const [type, keywords] of Object.entries(examTypeKeywords)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        return type;
      }
    }

    return examType; // Default to expected exam type
  }

  /**
   * Normalizes detected exam type from AI response to match enum values
   * Maps descriptive text like "SAMPLE QUESTION PAPER" to proper enum values
   */
  private normalizeExamType(detectedType: string, expectedType: string): string {
    if (!detectedType) {
      return expectedType;
    }

    const detectedLower = detectedType.toLowerCase().trim();
    
    // If it's already a valid enum value, return it
    const validExamTypes = [
      'UNIT_TEST', 'MID_TERM', 'FINAL', 'QUIZ', 'ASSIGNMENT', 
      'PRACTICAL', 'TERM_TEST', 'ANNUAL_EXAM', 'CUSTOM_EXAM'
    ];
    
    if (validExamTypes.includes(detectedType.toUpperCase())) {
      return detectedType.toUpperCase();
    }

    // Map descriptive text to enum values
    const examTypeMappings: Record<string, string> = {
      'sample question paper': 'UNIT_TEST',
      'sample paper': 'UNIT_TEST',
      'question paper': 'UNIT_TEST',
      'test paper': 'UNIT_TEST',
      'exam paper': 'UNIT_TEST',
      'unit test': 'UNIT_TEST',
      'unit exam': 'UNIT_TEST',
      'mid term': 'MID_TERM',
      'midterm': 'MID_TERM',
      'mid term exam': 'MID_TERM',
      'final exam': 'FINAL',
      'final test': 'FINAL',
      'annual exam': 'ANNUAL_EXAM',
      'quiz': 'QUIZ',
      'assignment': 'ASSIGNMENT',
      'practical': 'PRACTICAL',
      'practical exam': 'PRACTICAL',
      'lab exam': 'PRACTICAL',
      'term test': 'TERM_TEST',
      'term exam': 'TERM_TEST'
    };

    // Check for exact matches first
    if (examTypeMappings[detectedLower]) {
      return examTypeMappings[detectedLower];
    }

    // Check for partial matches
    for (const [key, value] of Object.entries(examTypeMappings)) {
      if (detectedLower.includes(key) || key.includes(detectedLower)) {
        return value;
      }
    }

    // If no match found, return expected type (be more lenient)
    return expectedType;
  }

  /**
   * Extracts pattern information from PDF text
   */
  private extractPatternFromText(text: string): any {
    // Extract mark distribution
    const markDistribution = this.extractMarkDistribution(text);
    
    // Extract question count
    const totalQuestions = this.extractQuestionCount(text);
    
    // Extract question types
    const questionTypes = this.extractQuestionTypes(text);
    
    // Extract difficulty levels
    const difficultyLevels = this.extractDifficultyLevels(text);
    
    // Extract Blooms taxonomy distribution
    const bloomsDistribution = this.extractBloomsDistribution(text);
    
    // Extract sections
    const sections = this.extractSections(text);
    
    // If total marks wasn't extracted directly, try calculating from sections
    if (markDistribution.totalMarks === 0 && sections.length > 0) {
      const totalFromSections = sections.reduce((sum, section) => sum + section.marks, 0);
      if (totalFromSections > 0) {
        markDistribution.totalMarks = totalFromSections;
      }
    }
    
    // If totalQuestions is 0 but we have mark distribution, calculate from marks
    let calculatedTotalQuestions = totalQuestions;
    if (calculatedTotalQuestions === 0 && markDistribution) {
      calculatedTotalQuestions = 
        markDistribution.oneMark +
        markDistribution.twoMark +
        markDistribution.threeMark +
        markDistribution.fiveMark;
    }
    
    // If we still don't have total, try summing sections
    if (calculatedTotalQuestions === 0 && sections.length > 0) {
      calculatedTotalQuestions = sections.reduce((sum, section) => sum + section.questions, 0);
    }
    
    // If we still don't have total, try to extract from text patterns
    if (calculatedTotalQuestions === 0) {
      const totalPatterns = [
        /total\s*questions?\s*:?\s*(\d+)/i,
        /total\s*:?\s*(\d+)\s*questions?/i,
        /(\d+)\s*questions?\s*total/i
      ];
      
      for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const count = parseInt(match[1], 10);
          if (!isNaN(count) && count > 0) {
            calculatedTotalQuestions = count;
            break;
          }
        }
      }
    }

    return {
      totalQuestions: calculatedTotalQuestions,
      markDistribution,
      questionTypes,
      difficultyLevels,
      bloomsDistribution,
      sections
    };
  }

  /**
   * Extracts mark distribution from text
   */
  private extractMarkDistribution(text: string): any {
    const distribution = {
      oneMark: 0,
      twoMark: 0,
      threeMark: 0,
      fiveMark: 0,
      totalMarks: 0
    };

    // First, try to extract total marks directly from text (e.g., "Total Marks: 80", "Total: 80 marks")
    const totalMarksPatterns = [
      /total\s*marks?\s*:?\s*(\d+)/i,
      /total\s*:?\s*(\d+)\s*marks?/i,
      /marks?\s*total\s*:?\s*(\d+)/i,
      /(\d+)\s*marks?\s*total/i
    ];

    let extractedTotalMarks = 0;
    for (const pattern of totalMarksPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const total = parseInt(match[1], 10);
        if (!isNaN(total) && total > 0) {
          extractedTotalMarks = total;
          break;
        }
      }
    }

    // Look for mark patterns with more variations
    const markPatterns = [
      // Patterns like "10 × 1 mark" or "10x1 mark" or "10 X 1 mark"
      { pattern: /(\d+)\s*[×xX]\s*1\s*mark/gi, type: 'oneMark' },
      { pattern: /(\d+)\s*[×xX]\s*2\s*mark/gi, type: 'twoMark' },
      { pattern: /(\d+)\s*[×xX]\s*3\s*mark/gi, type: 'threeMark' },
      { pattern: /(\d+)\s*[×xX]\s*5\s*mark/gi, type: 'fiveMark' },
      // Patterns like "1 mark × 10" or "1 mark x 10"
      { pattern: /1\s*mark\s*[×xX]\s*(\d+)/gi, type: 'oneMark' },
      { pattern: /2\s*mark\s*[×xX]\s*(\d+)/gi, type: 'twoMark' },
      { pattern: /3\s*mark\s*[×xX]\s*(\d+)/gi, type: 'threeMark' },
      { pattern: /5\s*mark\s*[×xX]\s*(\d+)/gi, type: 'fiveMark' },
      // Patterns like "10 questions of 1 mark"
      { pattern: /(\d+)\s*(?:questions?|q|Q)\s*(?:of|for|-)\s*1\s*mark/gi, type: 'oneMark' },
      { pattern: /(\d+)\s*(?:questions?|q|Q)\s*(?:of|for|-)\s*2\s*mark/gi, type: 'twoMark' },
      { pattern: /(\d+)\s*(?:questions?|q|Q)\s*(?:of|for|-)\s*3\s*mark/gi, type: 'threeMark' },
      { pattern: /(\d+)\s*(?:questions?|q|Q)\s*(?:of|for|-)\s*5\s*mark/gi, type: 'fiveMark' },
      // Patterns like "1 mark: 10 questions"
      { pattern: /1\s*mark\s*[:=-]\s*(\d+)\s*(?:questions?|q|Q)/gi, type: 'oneMark' },
      { pattern: /2\s*mark\s*[:=-]\s*(\d+)\s*(?:questions?|q|Q)/gi, type: 'twoMark' },
      { pattern: /3\s*mark\s*[:=-]\s*(\d+)\s*(?:questions?|q|Q)/gi, type: 'threeMark' },
      { pattern: /5\s*mark\s*[:=-]\s*(\d+)\s*(?:questions?|q|Q)/gi, type: 'fiveMark' }
    ];

    for (const { pattern, type } of markPatterns) {
      // Reset regex lastIndex to ensure we check from the beginning
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          const count = parseInt(match[1], 10);
          if (!isNaN(count)) {
            distribution[type as keyof typeof distribution] += count;
          }
        }
      }
    }

    // Calculate total marks from standard mark distribution
    const calculatedTotalMarks = 
      distribution.oneMark * 1 +
      distribution.twoMark * 2 +
      distribution.threeMark * 3 +
      distribution.fiveMark * 5;

    // Use extracted total marks if found, otherwise use calculated total
    // If extracted total is significantly different from calculated, prefer extracted (it's more accurate)
    if (extractedTotalMarks > 0) {
      distribution.totalMarks = extractedTotalMarks;
    } else {
      distribution.totalMarks = calculatedTotalMarks;
    }

    return distribution;
  }

  /**
   * Extracts total question count from text
   */
  private extractQuestionCount(text: string): number {
    const patterns = [
      /total\s*questions?\s*:?\s*(\d+)/i,
      /total\s*q\s*:?\s*(\d+)/i,
      /(\d+)\s*questions?\s*total/i,
      /total\s*:?\s*(\d+)\s*questions?/i
    ];

    // First try explicit total questions patterns
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > 0) {
          return count;
        }
      }
    }

    // If no explicit total found, return 0 (will be calculated from mark distribution later)
    return 0;
  }

  /**
   * Extracts question types from text
   */
  private extractQuestionTypes(text: string): string[] {
    const types: string[] = [];
    const textLower = text.toLowerCase();

    const typeKeywords = {
      'CHOOSE_BEST_ANSWER': ['multiple choice', 'mcq', 'choose best', 'select'],
      'FILL_BLANKS': ['fill in the blanks', 'fill blanks', 'complete'],
      'ONE_WORD_ANSWER': ['one word', 'short answer', 'brief answer'],
      'TRUE_FALSE': ['true false', 't/f', 'correct incorrect'],
      'CHOOSE_MULTIPLE_ANSWERS': ['multiple answers', 'select all'],
      'MATCHING_PAIRS': ['matching', 'match the following'],
      'DRAWING_DIAGRAM': ['draw', 'diagram', 'sketch'],
      'SHORT_ANSWER': ['short answer', 'brief explanation'],
      'LONG_ANSWER': ['long answer', 'detailed explanation', 'essay']
    };

    for (const [type, keywords] of Object.entries(typeKeywords)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        types.push(type);
      }
    }

    return types.length > 0 ? types : ['CHOOSE_BEST_ANSWER']; // Default
  }

  /**
   * Extracts difficulty levels from text
   */
  private extractDifficultyLevels(text: string): string[] {
    const levels: string[] = [];
    const textLower = text.toLowerCase();

    const difficultyKeywords = {
      'EASY': ['easy', 'simple', 'basic'],
      'MODERATE': ['moderate', 'medium', 'average'],
      'TOUGHEST': ['difficult', 'hard', 'challenging', 'tough']
    };

    for (const [level, keywords] of Object.entries(difficultyKeywords)) {
      if (keywords.some(keyword => textLower.includes(keyword))) {
        levels.push(level);
      }
    }

    return levels.length > 0 ? levels : ['MODERATE']; // Default
  }

  /**
   * Extracts Blooms taxonomy distribution from text
   */
  private extractBloomsDistribution(text: string): any {
    const distribution = {
      remember: 0,
      understand: 0,
      apply: 0,
      analyze: 0,
      evaluate: 0,
      create: 0
    };

    const textLower = text.toLowerCase();

    const bloomsKeywords = {
      remember: ['remember', 'recall', 'identify', 'list', 'define'],
      understand: ['understand', 'explain', 'describe', 'summarize'],
      apply: ['apply', 'use', 'demonstrate', 'solve'],
      analyze: ['analyze', 'compare', 'contrast', 'examine'],
      evaluate: ['evaluate', 'judge', 'critique', 'assess'],
      create: ['create', 'design', 'construct', 'develop']
    };

    for (const [level, keywords] of Object.entries(bloomsKeywords)) {
      const count = keywords.reduce((acc, keyword) => {
        const matches = textLower.match(new RegExp(keyword, 'g'));
        return acc + (matches ? matches.length : 0);
      }, 0);
      distribution[level as keyof typeof distribution] = count;
    }

    return distribution;
  }

  /**
   * Extracts sections from PDF text
   */
  private extractSections(text: string): Array<{name: string, questions: number, marks: number}> {
    const sections: Array<{name: string, questions: number, marks: number}> = [];
    const textLines = text.split('\n');
    
    // Look for section patterns like "Section A", "Part 1", etc.
    const sectionPattern = /(?:section|part|group)\s*([a-z0-9]+)/gi;
    const markPattern = /(\d+)\s*mark/gi;
    const questionPattern = /(\d+)\s*(?:questions?|q|Q)/gi;
    
    // Also look for patterns like "Section A (1 mark each) - 10 questions"
    const sectionWithDetailsPattern = /(?:section|part|group)\s*([a-z0-9]+)\s*\((\d+)\s*mark\s*(?:each|per)?\)[^]*?(\d+)\s*(?:questions?|q|Q)/gi;
    
    let currentSection: {name: string, questions: number, marks: number} | null = null;
    
    // First, try to extract sections with complete details in one pattern
    let sectionMatch;
    while ((sectionMatch = sectionWithDetailsPattern.exec(text)) !== null) {
      const sectionName = sectionMatch[1];
      if (!sectionMatch[2] || !sectionMatch[3]) continue;
      const markValue = parseInt(sectionMatch[2], 10);
      const questionCount = parseInt(sectionMatch[3], 10);
      
      if (!isNaN(markValue) && !isNaN(questionCount)) {
        sections.push({
          name: `Section ${sectionName}`,
          questions: questionCount,
          marks: markValue * questionCount
        });
      }
    }
    
    // If no sections found with the detailed pattern, try line-by-line extraction
    if (sections.length === 0) {
      for (const line of textLines) {
        const sectionMatch = line.match(sectionPattern);
        if (sectionMatch) {
          // Save previous section if exists
          if (currentSection && currentSection.questions > 0) {
            sections.push(currentSection);
          }
          
          // Start new section
          currentSection = {
            name: sectionMatch[0] || 'Unknown Section',
            questions: 0,
            marks: 0
          };
        }
        
        if (currentSection) {
          // Look for question count in this line
          const questionMatch = line.match(questionPattern);
          if (questionMatch && questionMatch[1]) {
            const count = parseInt(questionMatch[1], 10);
            if (!isNaN(count)) {
              currentSection.questions = count;
            }
          }
          
          // Look for marks in this line - try to find both mark value and question count
          const marksMatch = line.match(markPattern);
          if (marksMatch && marksMatch[1]) {
            const mark = parseInt(marksMatch[1], 10);
            if (!isNaN(mark)) {
              // If we haven't set questions yet, try to extract from the same line
              if (currentSection.questions === 0) {
                const questionCountMatch = line.match(/(\d+)\s*(?:questions?|q|Q)/i);
                if (questionCountMatch && questionCountMatch[1]) {
                  currentSection.questions = parseInt(questionCountMatch[1], 10);
                }
              }
              currentSection.marks = mark * currentSection.questions;
            }
          }
        }
      }
    }
    
    // Add last section if exists
    if (currentSection && currentSection.questions > 0) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Validates the analysis result against expected parameters
   */
  private validateAgainstExpected(
    analysis: any,
    subject: any,
    examType: string
  ): TemplateValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Validate subject match (case-insensitive comparison)
    const detectedSubjectLower = analysis.detectedSubject?.toLowerCase().trim();
    const expectedSubjectLower = subject.name.toLowerCase().trim();
    if (detectedSubjectLower !== expectedSubjectLower && 
        !detectedSubjectLower?.includes(expectedSubjectLower) && 
        !expectedSubjectLower.includes(detectedSubjectLower || '')) {
      errors.push(`Subject mismatch: Expected ${subject.name}, detected ${analysis.detectedSubject}`);
      suggestions.push('Please verify the template is for the correct subject');
    }

    // Validate exam type match (more lenient - allow normalized matches)
    // If normalized exam type matches expected, don't add error
    if (analysis.detectedExamType !== examType) {
      // Check if it's a close match (e.g., both are UNIT_TEST variants)
      const normalizedDetected = this.normalizeExamType(analysis.detectedExamType, examType);
      if (normalizedDetected !== examType) {
        // Only add error if it's significantly different
        errors.push(`Exam type mismatch: Expected ${examType}, detected ${analysis.detectedExamType}`);
        suggestions.push('Please verify the template matches the selected exam type');
      }
    }

    // Validate pattern completeness
    if (!analysis.extractedPattern || analysis.extractedPattern.totalQuestions === 0) {
      errors.push('Could not extract question pattern from template');
      suggestions.push('Please ensure the template has clear question structure');
    }

    const isValid = errors.length === 0 && analysis.confidence >= 70;

    return {
      isValid,
      confidence: analysis.confidence,
      detectedSubject: analysis.detectedSubject,
      detectedExamType: analysis.detectedExamType,
      validationErrors: errors,
      suggestions,
      extractedPattern: analysis.extractedPattern
    };
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

export interface DiagramDescription {
  description: string;
  type: 'graph' | 'chart' | 'diagram' | 'figure' | 'illustration';
  context?: string;
  relatedContent?: string;
}

export interface GeneratedDiagram {
  imagePath: string;
  imageBuffer: Buffer;
  status: 'ready';
  source: string;
  altText: string;
}

export class DiagramGenerationService {
  private static genAI: GoogleGenerativeAI | null = null;
  private static model: any = null;

  /**
   * Initialize Gemini AI for diagram generation
   */
  static initialize() {
    try {
      const apiKey = env.GEMINI_API_KEY || env.AI_API_KEY;
      if (!apiKey) {
        logger.warn('Gemini API key not found. Diagram generation will use fallback methods.');
        return;
      }

      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: env.AI_MODEL || 'gemini-2.0-flash-exp' 
      });
      
      logger.info('DiagramGenerationService initialized successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize DiagramGenerationService:', error);
    }
  }

  /**
   * Generate diagram image from description
   */
  static async generateDiagram(
    description: DiagramDescription,
    questionText?: string
  ): Promise<GeneratedDiagram | null> {
    try {
      // Create directory for generated diagrams
      const diagramsDir = path.join(process.cwd(), 'public', 'generated-diagrams');
      if (!fs.existsSync(diagramsDir)) {
        fs.mkdirSync(diagramsDir, { recursive: true });
      }

      // Determine diagram generation strategy based on type
      let diagramBuffer: Buffer | null = null;
      let altText = description.description || 'Diagram';

      switch (description.type) {
        case 'graph':
          // Generate mathematical/scientific graphs
          diagramBuffer = await this.generateGraph(description, questionText);
          break;
        
        case 'chart':
          // Generate charts (bar, pie, line, etc.)
          diagramBuffer = await this.generateChart(description, questionText);
          break;
        
        case 'diagram':
        case 'figure':
        case 'illustration':
          // Generate diagrams using AI (DALL·E or Gemini)
          diagramBuffer = await this.generateAIDiagram(description, questionText);
          break;
        
        default:
          // Fallback: generate using AI
          diagramBuffer = await this.generateAIDiagram(description, questionText);
      }

      if (!diagramBuffer) {
        logger.warn('Failed to generate diagram, creating placeholder');
        diagramBuffer = await this.generatePlaceholder(description);
      }

      // Save diagram to file
      const timestamp = Date.now();
      const fileName = `diagram-${timestamp}-${Math.random().toString(36).substring(7)}.png`;
      const filePath = path.join(diagramsDir, fileName);
      
      fs.writeFileSync(filePath, diagramBuffer);

      logger.info(`Generated diagram saved to: ${filePath}`);

      return {
        imagePath: filePath,
        imageBuffer: diagramBuffer,
        status: 'ready',
        source: `/public/generated-diagrams/${fileName}`,
        altText: altText
      };

    } catch (error: unknown) {
      logger.error('Error generating diagram:', error);
      return null;
    }
  }

  /**
   * Generate mathematical/scientific graphs using canvas
   */
  private static async generateGraph(
    description: DiagramDescription,
    questionText?: string
  ): Promise<Buffer | null> {
    try {
      // Parse description to extract graph type and parameters
      const desc = description.description.toLowerCase();
      
      // Create canvas
      const width = 600;
      const height = 400;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Draw axes
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      
      // X-axis
      ctx.beginPath();
      ctx.moveTo(50, height - 50);
      ctx.lineTo(width - 50, height - 50);
      ctx.stroke();

      // Y-axis
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.lineTo(50, height - 50);
      ctx.stroke();

      // Draw labels
      ctx.fillStyle = '#000000';
      ctx.font = '14px Arial';
      ctx.fillText('X', width - 40, height - 40);
      ctx.fillText('Y', 30, 40);

      // Try to detect graph type from description
      if (desc.includes('sin') || desc.includes('sine') || desc.includes('trigonometric')) {
        // Draw sine wave
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const amplitude = 100;
        const frequency = 0.02;
        const xOffset = 50;
        const yOffset = height / 2;
        
        for (let x = 0; x < width - 100; x++) {
          const y = Math.sin((x * frequency)) * amplitude;
          if (x === 0) {
            ctx.moveTo(x + xOffset, yOffset - y);
          } else {
            ctx.lineTo(x + xOffset, yOffset - y);
          }
        }
        ctx.stroke();

        // Label the function if inverse sine
        if (desc.includes('inverse') || desc.includes('arcsin') || desc.includes('sin⁻¹')) {
          ctx.fillStyle = '#0066cc';
          ctx.font = '16px Arial';
          ctx.fillText('y = sin⁻¹(x)', 100, 80);
        } else {
          ctx.fillStyle = '#0066cc';
          ctx.font = '16px Arial';
          ctx.fillText('y = sin(x)', 100, 80);
        }
      } else if (desc.includes('cos') || desc.includes('cosine')) {
        // Draw cosine wave
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const amplitude = 100;
        const frequency = 0.02;
        const xOffset = 50;
        const yOffset = height / 2;
        
        for (let x = 0; x < width - 100; x++) {
          const y = Math.cos((x * frequency)) * amplitude;
          if (x === 0) {
            ctx.moveTo(x + xOffset, yOffset - y);
          } else {
            ctx.lineTo(x + xOffset, yOffset - y);
          }
        }
        ctx.stroke();

        if (desc.includes('inverse') || desc.includes('arccos') || desc.includes('cos⁻¹')) {
          ctx.fillStyle = '#0066cc';
          ctx.font = '16px Arial';
          ctx.fillText('y = cos⁻¹(x)', 100, 80);
        } else {
          ctx.fillStyle = '#0066cc';
          ctx.font = '16px Arial';
          ctx.fillText('y = cos(x)', 100, 80);
        }
      } else if (desc.includes('linear') || desc.includes('line')) {
        // Draw linear function
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, height - 50);
        ctx.lineTo(width - 50, 50);
        ctx.stroke();

        ctx.fillStyle = '#0066cc';
        ctx.font = '16px Arial';
        ctx.fillText('y = mx + c', 100, 80);
      } else {
        // Generic curve (parabola)
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const xOffset = 50;
        const yOffset = height - 50;
        
        for (let x = 0; x < width - 100; x++) {
          const normalizedX = (x - (width - 100) / 2) / 100;
          const y = normalizedX * normalizedX * 80;
          if (x === 0) {
            ctx.moveTo(x + xOffset, yOffset - y);
          } else {
            ctx.lineTo(x + xOffset, yOffset - y);
          }
        }
        ctx.stroke();

        ctx.fillStyle = '#0066cc';
        ctx.font = '16px Arial';
        ctx.fillText('y = f(x)', 100, 80);
      }

      return canvas.toBuffer('image/png');
    } catch (error: unknown) {
      logger.error('Error generating graph:', error);
      return null;
    }
  }

  /**
   * Generate charts (bar, pie, line charts)
   */
  private static async generateChart(
    description: DiagramDescription,
    questionText?: string
  ): Promise<Buffer | null> {
    try {
      const width = 600;
      const height = 400;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Draw a simple bar chart as default
      const desc = description.description.toLowerCase();
      
      if (desc.includes('bar')) {
        // Bar chart
        const bars = 5;
        const barWidth = 80;
        const maxHeight = 250;
        const startX = 100;
        const startY = height - 100;

        ctx.fillStyle = '#0066cc';
        for (let i = 0; i < bars; i++) {
          const barHeight = Math.random() * maxHeight;
          ctx.fillRect(
            startX + i * (barWidth + 20),
            startY - barHeight,
            barWidth,
            barHeight
          );
        }
      } else if (desc.includes('pie')) {
        // Simple pie chart representation
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 120;

        const slices = 4;
        const sliceAngle = (Math.PI * 2) / slices;
        const colors = ['#0066cc', '#00cc66', '#cc6600', '#cc0066'];

        for (let i = 0; i < slices; i++) {
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.arc(
            centerX,
            centerY,
            radius,
            i * sliceAngle,
            (i + 1) * sliceAngle
          );
          ctx.closePath();
          ctx.fillStyle = colors[i] || '#0066cc';
          ctx.fill();
        }
      } else {
        // Default: line chart
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const points = 10;
        const stepX = (width - 200) / points;
        const startX = 100;
        const startY = height - 100;

        for (let i = 0; i <= points; i++) {
          const x = startX + i * stepX;
          const y = startY - (Math.random() * 200);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      return canvas.toBuffer('image/png');
    } catch (error: unknown) {
      logger.error('Error generating chart:', error);
      return null;
    }
  }

  /**
   * Generate diagram using AI (removed - now using base64 from AI response directly)
   * Falls back to placeholder if no base64 image is available
   */
  private static async generateAIDiagram(
    description: DiagramDescription,
    questionText?: string
  ): Promise<Buffer | null> {
    // Note: AI image generation is now handled directly in the AI response
    // This method is kept for compatibility but will always fall back to placeholder
    // The actual base64 images from AI will be processed in the controller
    logger.debug('AI diagram generation requested - using placeholder (base64 images should come from AI response)');
    return await this.generatePlaceholder(description);
  }

  /**
   * Create a detailed prompt for diagram generation
   */
  private static createDiagramPrompt(
    description: DiagramDescription,
    questionText?: string
  ): string {
    let prompt = `Create an educational diagram for a question paper.\n\n`;
    prompt += `Diagram Description: ${description.description}\n`;
    
    if (description.context) {
      prompt += `Context: ${description.context}\n`;
    }
    
    if (questionText) {
      prompt += `Question Text: ${questionText.substring(0, 200)}\n`;
    }
    
    prompt += `\nRequirements:\n`;
    prompt += `- Clean, professional, and educational\n`;
    prompt += `- Mathematically/scientifically accurate\n`;
    prompt += `- Suitable for printing in black and white\n`;
    prompt += `- Clear labels and annotations\n`;
    prompt += `- Appropriate for student understanding\n`;

    // Add type-specific instructions
    if (description.type === 'graph') {
      prompt += `- Include proper axes labels (X, Y)\n`;
      prompt += `- Show grid lines if helpful\n`;
      prompt += `- Label key points/curves\n`;
    } else if (description.type === 'chart') {
      prompt += `- Include proper labels and legends\n`;
      prompt += `- Use clear, distinct colors/patterns\n`;
    } else {
      prompt += `- Use clear lines and shapes\n`;
      prompt += `- Include necessary labels\n`;
    }

    return prompt;
  }

  /**
   * Generate placeholder diagram when actual generation fails
   */
  private static async generatePlaceholder(
    description: DiagramDescription
  ): Promise<Buffer> {
    const width = 600;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    // Dashed border inner
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#dddddd';
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.setLineDash([]);

    // Text
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Diagram', width / 2, height / 2 - 20);

    ctx.font = '14px Arial';
    const lines = this.wrapText(ctx, description.description || 'Diagram', width - 100);
    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, height / 2 + (index * 20) + 10);
    });

    return canvas.toBuffer('image/png');
  }

  /**
   * Helper to wrap text
   */
  private static wrapText(ctx: any, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (!word) continue;
      const currentLineSafe = currentLine || '';
      const width = ctx.measureText(currentLineSafe + ' ' + word).width;
      if (width < maxWidth) {
        currentLine = currentLineSafe + ' ' + word;
      } else {
        if (currentLineSafe) {
          lines.push(currentLineSafe);
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  /**
   * Batch generate diagrams for multiple questions
   */
  static async generateDiagramsForQuestions(
    questions: Array<{ diagramDescription?: string; visualAids?: string[]; questionText?: string; questionType?: string }>
  ): Promise<Map<number, GeneratedDiagram>> {
    const generatedDiagrams = new Map<number, GeneratedDiagram>();

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      if (!question) continue;
      
      // Check if question needs a diagram
      const needsDiagram = 
        question.questionType === 'DRAWING_DIAGRAM' || 
        question.questionType === 'MARKING_PARTS' ||
        (question.visualAids && question.visualAids.length > 0) ||
        question.diagramDescription;

      if (needsDiagram) {
        // Extract diagram description
        let description = question.diagramDescription || '';
        if (!description && question.visualAids && question.visualAids.length > 0) {
          const firstAid = question.visualAids[0];
          if (firstAid) {
            description = firstAid; // Use first visual aid as description
          }
        }
        if (!description) {
          const questionText = question.questionText || 'Question';
          description = `Diagram for question: ${questionText.substring(0, 50)}...`;
        }

        // Determine diagram type
        let diagramType: 'graph' | 'chart' | 'diagram' | 'figure' | 'illustration' = 'diagram';
        const desc = description.toLowerCase();
        if (desc.includes('graph')) diagramType = 'graph';
        else if (desc.includes('chart')) diagramType = 'chart';
        else if (desc.includes('figure')) diagramType = 'figure';

        // Generate diagram
        const questionText = question.questionText || '';
        const diagramDesc: {
          description: string;
          type: 'graph' | 'chart' | 'diagram' | 'figure' | 'illustration';
          context?: string;
        } = {
          description: description,
          type: diagramType,
        };
        if (questionText) {
          diagramDesc.context = questionText;
        }
        const diagram = await this.generateDiagram(diagramDesc, questionText);

        if (diagram) {
          generatedDiagrams.set(i, diagram);
          logger.info(`Generated diagram for question ${i + 1}`);
        }
      }
    }

    return generatedDiagrams;
  }
}


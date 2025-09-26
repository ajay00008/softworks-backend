import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import AIService from "../services/aiService";

const UpdateAIConfigSchema = z.object({
  provider: z.enum(["OPENAI", "GEMINI", "ANTHROPIC", "MOCK"]).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().optional(),
});

const TestAIConfigSchema = z.object({
  provider: z.enum(["OPENAI", "GEMINI", "ANTHROPIC", "MOCK"]),
  apiKey: z.string(),
  model: z.string(),
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(4000),
});

// Get current AI configuration
export async function getAIConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const config = AIService.getConfig();
    
    res.json({
      success: true,
      data: {
        ...config,
        apiKey: config.apiKey ? `${config.apiKey.substring(0, 8)}...` : undefined // Mask API key
      }
    });
  } catch (error) {
    next(error);
  }
}

// Update AI configuration
export async function updateAIConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const updateData = UpdateAIConfigSchema.parse(req.body);
    
    AIService.updateConfig(updateData);
    
    res.json({
      success: true,
      message: "AI configuration updated successfully",
      data: {
        ...AIService.getConfig(),
        apiKey: AIService.getConfig().apiKey ? `${AIService.getConfig().apiKey.substring(0, 8)}...` : undefined
      }
    });
  } catch (error) {
    next(error);
  }
}

// Test AI configuration
export async function testAIConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const testConfig = TestAIConfigSchema.parse(req.body);
    
    // Temporarily update the AI service configuration
    const originalConfig = AIService.getConfig();
    AIService.updateConfig(testConfig);
    
    try {
      // Test with a simple question generation
      const testQuestion = await AIService.generateSingleQuestion(
        "Mathematics",
        "Algebra",
        "UNDERSTAND",
        "MODERATE",
        "ENGLISH"
      );
      
      // Restore original configuration
      AIService.updateConfig(originalConfig);
      
      res.json({
        success: true,
        message: "AI configuration test successful",
        data: {
          testQuestion,
          config: {
            ...testConfig,
            apiKey: `${testConfig.apiKey.substring(0, 8)}...`
          }
        }
      });
    } catch (testError) {
      // Restore original configuration
      AIService.updateConfig(originalConfig);
      
      throw new createHttpError.BadRequest(`AI configuration test failed: ${testError.message}`);
    }
  } catch (error) {
    next(error);
  }
}

// Get available AI providers and models
export async function getAIProviders(req: Request, res: Response, next: NextFunction) {
  try {
    const providers = {
      GEMINI: {
        name: "Google Gemini",
        models: [
          "gemini-2.0-flash-exp",
          "gemini-1.5-pro",
          "gemini-1.5-flash",
          "gemini-1.0-pro"
        ],
        baseUrl: "https://generativelanguage.googleapis.com",
        description: "Google's advanced AI model with excellent reasoning capabilities"
      },
      OPENAI: {
        name: "OpenAI",
        models: [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4-turbo",
          "gpt-3.5-turbo"
        ],
        baseUrl: "https://api.openai.com",
        description: "OpenAI's powerful language models"
      },
      ANTHROPIC: {
        name: "Anthropic Claude",
        models: [
          "claude-3-5-sonnet-20241022",
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-haiku-20240307"
        ],
        baseUrl: "https://api.anthropic.com",
        description: "Anthropic's Claude models with strong reasoning abilities"
      },
      MOCK: {
        name: "Mock AI (Testing)",
        models: ["mock-model"],
        baseUrl: "http://localhost",
        description: "Mock AI service for testing and development"
      }
    };
    
    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    next(error);
  }
}

// Generate questions with specific AI configuration
export async function generateQuestionsWithConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const { aiConfig, questionRequest } = req.body;
    
    // Validate AI configuration
    const validatedConfig = TestAIConfigSchema.parse(aiConfig);
    
    // Update AI service with the provided configuration
    const originalConfig = AIService.getConfig();
    AIService.updateConfig(validatedConfig);
    
    try {
      // Generate questions with the specified configuration
      const questions = await AIService.generateQuestions(questionRequest);
      
      // Restore original configuration
      AIService.updateConfig(originalConfig);
      
      res.json({
        success: true,
        data: {
          questions,
          config: {
            ...validatedConfig,
            apiKey: `${validatedConfig.apiKey.substring(0, 8)}...`
          }
        }
      });
    } catch (generateError) {
      // Restore original configuration
      AIService.updateConfig(originalConfig);
      throw generateError;
    }
  } catch (error) {
    next(error);
  }
}

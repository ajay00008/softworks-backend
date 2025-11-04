import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().url().or(z.string().startsWith("mongodb")),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 chars"),
  JWT_EXPIRES_IN: z.string().default("24h"),
  
  // AI Configuration
  AI_PROVIDER: z.enum(["OPENAI", "GEMINI", "ANTHROPIC", "MOCK"]).default("GEMINI"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("gemini-2.0-flash-exp"),
  AI_BASE_URL: z.string().optional(),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  AI_MAX_TOKENS: z.coerce.number().default(4000),
  
  // OpenAI Configuration (legacy)
  OPENAI_API_KEY: z.string().optional(),
  
  // Gemini Configuration
  GEMINI_API_KEY: z.string().optional(),
  
  // AWS S3 Configuration
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  
  // Google Cloud Storage Configuration
  GOOGLE_CLOUD_PROJECT_ID: z.string().optional(),
  GOOGLE_CLOUD_KEY_FILE: z.string().optional(),
  GOOGLE_CLOUD_BUCKET: z.string().optional(),
  
  // WhatsApp API Configuration
  WHATSAPP_API_KEY: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  
  // Email SMTP Configuration
  EMAIL_SMTP_HOST: z.string().optional(),
  EMAIL_SMTP_PORT: z.coerce.number().optional(),
  EMAIL_SMTP_USER: z.string().optional(),
  EMAIL_SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  
  // File Upload Configuration
  MAX_FILE_SIZE: z.coerce.number().optional(),
  ALLOWED_FILE_TYPES: z.string().optional(),
  
  // AI Processing Configuration
  AI_CONFIDENCE_THRESHOLD: z.coerce.number().optional(),
  AI_PROCESSING_TIMEOUT: z.coerce.number().optional(),
  
  // Notification Configuration
  NOTIFICATION_RETRY_ATTEMPTS: z.coerce.number().optional(),
  NOTIFICATION_RETRY_DELAY: z.coerce.number().optional(),
  
  // Logging Configuration
  LOG_LEVEL: z.string().optional(),
  LOG_FILE_PATH: z.string().optional(),
  ERROR_LOG_FILE_PATH: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().optional(),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().optional(),
  
  // CORS Configuration
  CORS_ORIGIN: z.string().optional(),
  CORS_CREDENTIALS: z.coerce.boolean().optional(),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;



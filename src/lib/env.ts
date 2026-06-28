import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().default("dev-access-secret-not-for-production"),
  JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-not-for-production"),

  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3000/api/auth/google/callback"),

  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default("noreply@localhost"),

  CRON_SECRET: z.string().default("dev-cron-secret"),

  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
  GOOGLE_SAFE_BROWSING_KEY: z.string().default(""),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.warn("⚠️ Invalid or missing env vars:", parsed.error.flatten().fieldErrors);
}

// Always use parsed.data — it includes zod defaults even when env vars are missing.
// Never fall back to raw process.env which has no defaults and causes undefined errors.
export const env = parsed.success
  ? parsed.data
  : envSchema.parse({}); // force defaults if safeParse failed
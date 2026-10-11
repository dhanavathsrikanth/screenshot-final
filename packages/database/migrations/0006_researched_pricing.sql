ALTER TYPE "public"."snapforge_plan" ADD VALUE 'starter';--> statement-breakpoint
ALTER TYPE "public"."snapforge_plan" ADD VALUE 'growth';--> statement-breakpoint
ALTER TABLE "capture_reservations" ADD COLUMN "credits" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "capture_reservations" ADD COLUMN "monthly_credits" integer;
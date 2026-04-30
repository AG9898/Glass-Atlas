ALTER TABLE "glass_atlas"."notes" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "glass_atlas"."notes" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "glass_atlas"."notes" ADD COLUMN "series" text;
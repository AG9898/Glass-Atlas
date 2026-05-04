ALTER TABLE "glass_atlas"."notes" ADD COLUMN "semantic_index_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "glass_atlas"."notes" ADD COLUMN "semantic_index_error" text;--> statement-breakpoint
ALTER TABLE "glass_atlas"."notes" ADD COLUMN "semantic_indexed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "glass_atlas"."notes" ADD COLUMN "semantic_index_source_updated_at" timestamp with time zone;
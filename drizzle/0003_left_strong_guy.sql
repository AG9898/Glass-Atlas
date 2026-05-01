CREATE TABLE "glass_atlas"."note_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_slug" text NOT NULL,
	"section_heading" text,
	"section_index" integer DEFAULT 0 NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_chunks_note_slug_chunk_index_unique" UNIQUE("note_slug","chunk_index")
);
--> statement-breakpoint
ALTER TABLE "glass_atlas"."note_chunks" ADD CONSTRAINT "note_chunks_note_slug_notes_slug_fk" FOREIGN KEY ("note_slug") REFERENCES "glass_atlas"."notes"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_chunks_note_slug_idx" ON "glass_atlas"."note_chunks" USING btree ("note_slug");--> statement-breakpoint
CREATE INDEX "note_chunks_embedding_cosine_idx" ON "glass_atlas"."note_chunks" USING hnsw ("embedding" vector_cosine_ops);
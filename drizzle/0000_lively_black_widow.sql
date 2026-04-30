CREATE TABLE "glass_atlas"."account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "glass_atlas"."chat_rate_limits" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_rate_limits_ip_hash_unique" UNIQUE("ip_hash")
);
--> statement-breakpoint
CREATE TABLE "glass_atlas"."citation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_slug" text NOT NULL,
	"cited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "glass_atlas"."note_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_slug" text NOT NULL,
	"target_slug" text NOT NULL,
	"link_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_links_source_target_unique" UNIQUE("source_slug","target_slug")
);
--> statement-breakpoint
CREATE TABLE "glass_atlas"."notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"takeaway" text,
	"category" text,
	"tags" text[],
	"status" text DEFAULT 'draft' NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "glass_atlas"."session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "glass_atlas"."user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "glass_atlas"."verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "glass_atlas"."account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "glass_atlas"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glass_atlas"."note_links" ADD CONSTRAINT "note_links_source_slug_notes_slug_fk" FOREIGN KEY ("source_slug") REFERENCES "glass_atlas"."notes"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glass_atlas"."session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "glass_atlas"."user"("id") ON DELETE cascade ON UPDATE no action;
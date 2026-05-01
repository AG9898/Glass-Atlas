ALTER TABLE "glass_atlas"."chat_rate_limits" RENAME COLUMN "ip_hash" TO "session_hash";--> statement-breakpoint
ALTER TABLE "glass_atlas"."chat_rate_limits" DROP CONSTRAINT "chat_rate_limits_ip_hash_unique";--> statement-breakpoint
ALTER TABLE "glass_atlas"."chat_rate_limits" ADD CONSTRAINT "chat_rate_limits_session_hash_unique" UNIQUE("session_hash");
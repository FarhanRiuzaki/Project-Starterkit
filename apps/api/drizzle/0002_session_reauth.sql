ALTER TABLE "sessions" ADD COLUMN "reauth_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Sessions signed in before this migration proved the user when they began, not now.
UPDATE "sessions" SET "reauth_at" = "created_at";

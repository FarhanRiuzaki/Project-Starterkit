CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_status_check" CHECK ("projects"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_key" ON "projects" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "projects_created_at" ON "projects" USING btree ("created_at","id");
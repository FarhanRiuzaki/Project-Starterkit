CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"target_label" text NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "auth_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"event" text NOT NULL,
	"login" text NOT NULL,
	"user_id" uuid,
	"method" text NOT NULL,
	"ip" text NOT NULL,
	"device" text NOT NULL,
	"location" text,
	CONSTRAINT "auth_log_event_check" CHECK (event in ('login_success', 'password_ok', 'login_failed', 'logout', '2fa_success', '2fa_failed', 'password_reset')),
	CONSTRAINT "auth_log_method_check" CHECK (method in ('password', 'ldap', 'google', 'apple'))
);
--> statement-breakpoint
CREATE TABLE "auth_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"next" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_challenges_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "auth_challenges_method_check" CHECK (method in ('password', 'ldap', 'google', 'apple'))
);
--> statement-breakpoint
CREATE TABLE "login_backoff" (
	"key" text PRIMARY KEY NOT NULL,
	"failures" integer NOT NULL,
	"blocked_until" timestamp with time zone,
	"last_failure_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"device" text NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "sessions_method_check" CHECK (method in ('password', 'ldap', 'google', 'apple'))
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"token_hash" "bytea" PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_tokens_user_id_key" UNIQUE("user_id"),
	CONSTRAINT "user_tokens_kind_check" CHECK (kind in ('reset', 'invite'))
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"state_hash" "bytea" PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"mode" text NOT NULL,
	"user_id" uuid,
	"binding_hash" "bytea" NOT NULL,
	"code_verifier" text NOT NULL,
	"nonce" text NOT NULL,
	"next" text,
	"expires_at" timestamp with time zone NOT NULL,
	"session_id" uuid,
	CONSTRAINT "oauth_states_provider_check" CHECK (provider in ('google', 'apple')),
	CONSTRAINT "oauth_states_mode_check" CHECK (mode in ('login', 'link'))
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_identities_pkey" PRIMARY KEY("provider","subject"),
	CONSTRAINT "user_identities_user_id_provider_key" UNIQUE("user_id","provider"),
	CONSTRAINT "user_identities_provider_check" CHECK (provider in ('google', 'apple'))
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"name" text PRIMARY KEY NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_ldap" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"totp_secret" text,
	"pending_totp_secret" text,
	"totp_last_step" bigint,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_fkey" FOREIGN KEY ("permission") REFERENCES "permissions"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_at" ON "activity" USING btree ("at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "activity_target" ON "activity" USING btree ("target_id","at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "activity_action" ON "activity" USING btree ("action","at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "activity_actor_at" ON "activity" USING btree ("actor_id","at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "auth_log_at" ON "auth_log" USING btree ("at" DESC NULLS FIRST,"id" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "auth_log_user" ON "auth_log" USING btree ("user_id","at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "auth_log_event" ON "auth_log" USING btree ("event","at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "auth_challenges_user_id" ON "auth_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "oauth_states_user_id" ON "oauth_states" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_key" ON "roles" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "user_roles_role_id" ON "user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "recovery_codes_user_id" ON "recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_key" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_created_at" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_name_lower" ON "users" USING btree (lower("name"),"id");--> statement-breakpoint
CREATE INDEX "users_last_login_asc" ON "users" USING btree (("last_login_at" is null),"last_login_at","id");--> statement-breakpoint
CREATE INDEX "users_last_login_desc" ON "users" USING btree (("last_login_at" is null),"last_login_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);
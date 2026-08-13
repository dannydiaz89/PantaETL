CREATE TABLE "connection_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"binding" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"encryption_nonce" text NOT NULL,
	"encryption_key_reference" text NOT NULL,
	"encryption_algorithm" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connection_secrets_owner_user_id_binding_unique" UNIQUE("owner_user_id","binding")
);
--> statement-breakpoint
ALTER TABLE "connection_secrets" ADD CONSTRAINT "connection_secrets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connection_secrets_owner_user_id_index" ON "connection_secrets" USING btree ("owner_user_id");
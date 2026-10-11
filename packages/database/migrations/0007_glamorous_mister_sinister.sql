CREATE TABLE "dodo_credit_payments" (
	"payment_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credits" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dodo_credit_payments" ADD CONSTRAINT "dodo_credit_payments_user_id_accounts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("user_id") ON DELETE cascade ON UPDATE no action;
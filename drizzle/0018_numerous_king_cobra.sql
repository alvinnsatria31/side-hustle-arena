CREATE SCHEMA "store";
--> statement-breakpoint
CREATE TYPE "store"."store_delivery_kind" AS ENUM('LINK', 'FILE');--> statement-breakpoint
CREATE TYPE "store"."store_order_status" AS ENUM('PENDING', 'PAID', 'FULFILLED', 'FAILED', 'EXPIRED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "store"."store_payment_method" AS ENUM('IDR', 'POINTS');--> statement-breakpoint
CREATE TYPE "store"."store_product_kind" AS ENUM('DOWNLOAD', 'ACCESS');--> statement-breakpoint
CREATE TYPE "store"."store_product_status" AS ENUM('DRAFT', 'COMING_SOON', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
ALTER TYPE "rewards"."point_ledger_entry_type" ADD VALUE 'STORE_PURCHASE';--> statement-breakpoint
ALTER TYPE "rewards"."point_ledger_entry_type" ADD VALUE 'STORE_REFUND';--> statement-breakpoint
CREATE TABLE "store"."entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"feature_key" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"payment_method" "store"."store_payment_method" NOT NULL,
	"status" "store"."store_order_status" DEFAULT 'PENDING' NOT NULL,
	"product_title" text NOT NULL,
	"amount_idr_minor" integer,
	"points_spent" integer,
	"idempotency_key" text NOT NULL,
	"provider_order_id" text,
	"provider_token" text,
	"provider_redirect_url" text,
	"provider_status" text,
	"failure_reason" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_orders_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "store_orders_provider_order_id_unique" UNIQUE("provider_order_id"),
	CONSTRAINT "store_orders_payment_check" CHECK (("store"."orders"."payment_method" = 'IDR' AND "store"."orders"."amount_idr_minor" > 0 AND "store"."orders"."points_spent" IS NULL AND "store"."orders"."provider_order_id" IS NOT NULL)
    OR ("store"."orders"."payment_method" = 'POINTS' AND "store"."orders"."points_spent" > 0 AND "store"."orders"."amount_idr_minor" IS NULL AND "store"."orders"."provider_order_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "store"."payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"provider" text DEFAULT 'midtrans' NOT NULL,
	"event_key" text NOT NULL,
	"provider_order_id" text,
	"transaction_status" text,
	"fraud_status" text,
	"gross_amount_minor" integer,
	"payload" jsonb,
	"applied_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_payment_events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "store"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"description" text,
	"product_kind" "store"."store_product_kind" NOT NULL,
	"status" "store"."store_product_status" DEFAULT 'DRAFT' NOT NULL,
	"price_idr_minor" integer,
	"points_cost" integer,
	"cover_url" text,
	"delivery_kind" "store"."store_delivery_kind",
	"delivery_url" text,
	"delivery_object_key" text,
	"delivery_filename" text,
	"feature_key" text,
	"access_duration_days" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "store_products_amounts_check" CHECK (("store"."products"."price_idr_minor" IS NULL OR ("store"."products"."price_idr_minor" > 0 AND "store"."products"."price_idr_minor" % 100 = 0)) AND ("store"."products"."points_cost" IS NULL OR "store"."products"."points_cost" > 0) AND ("store"."products"."access_duration_days" IS NULL OR "store"."products"."access_duration_days" > 0)),
	CONSTRAINT "store_products_sellable_check" CHECK ("store"."products"."status" <> 'ACTIVE' OR "store"."products"."price_idr_minor" IS NOT NULL OR "store"."products"."points_cost" IS NOT NULL),
	CONSTRAINT "store_products_kind_check" CHECK (CASE "store"."products"."product_kind"
    WHEN 'ACCESS' THEN "store"."products"."delivery_kind" IS NULL AND "store"."products"."delivery_url" IS NULL AND "store"."products"."delivery_object_key" IS NULL AND ("store"."products"."status" <> 'ACTIVE' OR "store"."products"."feature_key" IS NOT NULL)
    ELSE "store"."products"."feature_key" IS NULL AND "store"."products"."access_duration_days" IS NULL AND ("store"."products"."status" <> 'ACTIVE' OR "store"."products"."delivery_kind" IS NOT NULL)
  END),
	CONSTRAINT "store_products_delivery_target_check" CHECK (("store"."products"."delivery_kind" IS NULL AND "store"."products"."delivery_url" IS NULL AND "store"."products"."delivery_object_key" IS NULL)
    OR ("store"."products"."delivery_kind" = 'LINK' AND "store"."products"."delivery_url" IS NOT NULL AND "store"."products"."delivery_object_key" IS NULL)
    OR ("store"."products"."delivery_kind" = 'FILE' AND "store"."products"."delivery_object_key" IS NOT NULL AND "store"."products"."delivery_url" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "store"."entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."entitlements" ADD CONSTRAINT "entitlements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "store"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."entitlements" ADD CONSTRAINT "entitlements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "store"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "store"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store"."payment_events" ADD CONSTRAINT "payment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "store"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "store_entitlements_live_unique" ON "store"."entitlements" USING btree ("user_id","product_id") WHERE "store"."entitlements"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "store_entitlements_user_idx" ON "store"."entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "store_entitlements_feature_idx" ON "store"."entitlements" USING btree ("feature_key");--> statement-breakpoint
CREATE UNIQUE INDEX "store_orders_pending_unique" ON "store"."orders" USING btree ("user_id","product_id") WHERE "store"."orders"."status" = 'PENDING';--> statement-breakpoint
CREATE INDEX "store_orders_user_created_idx" ON "store"."orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "store_orders_status_created_idx" ON "store"."orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "store_payment_events_order_idx" ON "store"."payment_events" USING btree ("order_id","received_at");--> statement-breakpoint
CREATE INDEX "store_products_status_sort_idx" ON "store"."products" USING btree ("status","sort_order");
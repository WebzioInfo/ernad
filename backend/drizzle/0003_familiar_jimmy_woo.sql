CREATE TABLE "user_lines" (
	"user_id" uuid NOT NULL,
	"line_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "factory_id" uuid;--> statement-breakpoint
ALTER TABLE "user_lines" ADD CONSTRAINT "user_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_lines" ADD CONSTRAINT "user_lines_line_id_production_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."production_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_lines" ON "user_lines" USING btree ("user_id","line_id");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_factory_id_factories_id_fk" FOREIGN KEY ("factory_id") REFERENCES "public"."factories"("id") ON DELETE cascade ON UPDATE no action;
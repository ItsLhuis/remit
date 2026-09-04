ALTER TABLE "invoices" ALTER COLUMN "public_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ALTER COLUMN "public_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contracts" ALTER COLUMN "public_token" DROP NOT NULL;
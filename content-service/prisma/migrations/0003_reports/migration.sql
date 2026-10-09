CREATE TYPE "report_status" AS ENUM ('open','resolved','dismissed');
CREATE TABLE "reports" ("id" UUID NOT NULL DEFAULT uuid_generate_v4(), "reporter_id" UUID NOT NULL, "target_type" "reaction_target" NOT NULL, "target_id" UUID NOT NULL,
  "reason" VARCHAR(40) NOT NULL, "details" TEXT, "status" "report_status" NOT NULL DEFAULT 'open', "resolved_by" UUID, "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT "reports_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "reports_reporter_id_target_type_target_id_key" ON "reports"("reporter_id","target_type","target_id");
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status","created_at");

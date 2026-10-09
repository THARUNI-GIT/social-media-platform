CREATE TABLE "blocks" (
  "blocker_id" UUID NOT NULL,
  "blocked_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id"),
  CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

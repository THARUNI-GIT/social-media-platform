CREATE TABLE "follows" ("follower_id" UUID NOT NULL, "following_id" UUID NOT NULL, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "follows_pkey" PRIMARY KEY ("follower_id","following_id"));
CREATE INDEX "follows_follower_id_idx" ON "follows"("follower_id");

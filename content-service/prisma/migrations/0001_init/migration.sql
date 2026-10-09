CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "post_visibility" AS ENUM ('public', 'followers', 'private');
CREATE TYPE "reaction_target" AS ENUM ('post', 'comment');

CREATE TABLE "posts" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "author_id" UUID NOT NULL,
  "caption" TEXT,
  "media_urls" JSONB NOT NULL DEFAULT '[]',
  "visibility" "post_visibility" NOT NULL DEFAULT 'public',
  "likes_count" INTEGER NOT NULL DEFAULT 0,
  "comments_count" INTEGER NOT NULL DEFAULT 0,
  "shares_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "post_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "parent_comment_id" UUID,
  "content" TEXT NOT NULL,
  "likes_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "reactions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL,
  "target_type" "reaction_target" NOT NULL,
  "target_id" UUID NOT NULL,
  "reaction_type" VARCHAR(20) NOT NULL DEFAULT 'like',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reactions_user_id_target_type_target_id_key" ON "reactions"("user_id", "target_type", "target_id");

CREATE TABLE "shares" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "post_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shares_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shares_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "bookmarks" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL,
  "post_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bookmarks_user_id_post_id_key" ON "bookmarks"("user_id", "post_id");

CREATE TABLE "hashtags" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tag" VARCHAR(100) NOT NULL,
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "hashtags_tag_key" ON "hashtags"("tag");

CREATE TABLE "post_hashtags" (
  "post_id" UUID NOT NULL,
  "hashtag_id" UUID NOT NULL,
  CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id", "hashtag_id"),
  CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "post_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

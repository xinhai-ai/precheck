CREATE TYPE "PreApplicationAdminNoteAction" AS ENUM ('CREATED', 'UPDATED', 'DELETED');

CREATE TABLE "PreApplicationAdminNote" (
  "id" TEXT NOT NULL,
  "preApplicationId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PreApplicationAdminNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PreApplicationAdminNoteRevision" (
  "id" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "action" "PreApplicationAdminNoteAction" NOT NULL,
  "content" TEXT NOT NULL,
  "editedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PreApplicationAdminNoteRevision_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PreApplicationAdminNote"
  ADD CONSTRAINT "PreApplicationAdminNote_preApplicationId_fkey"
  FOREIGN KEY ("preApplicationId") REFERENCES "PreApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreApplicationAdminNote"
  ADD CONSTRAINT "PreApplicationAdminNote_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreApplicationAdminNote"
  ADD CONSTRAINT "PreApplicationAdminNote_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreApplicationAdminNoteRevision"
  ADD CONSTRAINT "PreApplicationAdminNoteRevision_noteId_fkey"
  FOREIGN KEY ("noteId") REFERENCES "PreApplicationAdminNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PreApplicationAdminNoteRevision"
  ADD CONSTRAINT "PreApplicationAdminNoteRevision_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PreApplicationAdminNote_preApplicationId_createdAt_idx"
  ON "PreApplicationAdminNote"("preApplicationId", "createdAt");

CREATE INDEX "PreApplicationAdminNote_createdById_createdAt_idx"
  ON "PreApplicationAdminNote"("createdById", "createdAt");

CREATE INDEX "PreApplicationAdminNote_deletedAt_idx"
  ON "PreApplicationAdminNote"("deletedAt");

CREATE INDEX "PreApplicationAdminNoteRevision_noteId_createdAt_idx"
  ON "PreApplicationAdminNoteRevision"("noteId", "createdAt");

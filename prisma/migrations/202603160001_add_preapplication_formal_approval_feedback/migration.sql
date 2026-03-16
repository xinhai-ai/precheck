ALTER TABLE "PreApplication"
ADD COLUMN "formalApplicationApprovedFeedbackAt" TIMESTAMP(3);

CREATE INDEX "PreApplication_status_formalApplicationApprovedFeedbackAt_idx"
ON "PreApplication"("status", "formalApplicationApprovedFeedbackAt");

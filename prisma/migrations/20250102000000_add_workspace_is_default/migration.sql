-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Workspace_userId_isDefault_idx" ON "Workspace"("userId", "isDefault");


-- AlterTable: Make userId nullable for default templates
ALTER TABLE "Template" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable: Add isDefault field
ALTER TABLE "Template" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: Add index on isDefault for efficient queries
CREATE INDEX "Template_isDefault_idx" ON "Template"("isDefault");

-- AlterTable: Update foreign key constraint to allow nulls
-- First, drop the existing foreign key constraint
ALTER TABLE "Template" DROP CONSTRAINT "Template_userId_fkey";

-- Then, add it back with the same behavior (CASCADE on delete)
ALTER TABLE "Template" ADD CONSTRAINT "Template_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Add category default label template support
ALTER TABLE "Category" ADD COLUMN "defaultLabelTemplateId" TEXT;

CREATE INDEX "Category_defaultLabelTemplateId_idx" ON "Category"("defaultLabelTemplateId");

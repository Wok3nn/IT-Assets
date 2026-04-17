ALTER TABLE "LabelTemplate" ADD COLUMN "description" TEXT;
ALTER TABLE "LabelTemplate" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'millimeters';
ALTER TABLE "LabelTemplate" ADD COLUMN "orientation" TEXT NOT NULL DEFAULT 'portrait';
ALTER TABLE "LabelTemplate" ADD COLUMN "isEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "LabelTemplateField" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "LabelTemplateField" ADD COLUMN "isVisible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LabelTemplateField" ADD COLUMN "fontWeight" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "LabelTemplateField" ADD COLUMN "italic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LabelTemplateField" ADD COLUMN "rotation" REAL NOT NULL DEFAULT 0;
ALTER TABLE "LabelTemplateField" ADD COLUMN "zIndex" INTEGER NOT NULL DEFAULT 0;

UPDATE "LabelTemplateField"
SET
  "isVisible" = CASE WHEN "isHidden" = true THEN false ELSE true END,
  "fontWeight" = CASE WHEN "isBold" = true THEN 'bold' ELSE 'normal' END,
  "type" = 'text',
  "rotation" = 0,
  "zIndex" = 0;

CREATE INDEX "LabelTemplateField_templateId_zIndex_idx" ON "LabelTemplateField"("templateId", "zIndex");

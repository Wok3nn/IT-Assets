-- CreateTable
CREATE TABLE [dbo].[SetupState] (
    [id] NVARCHAR(191) NOT NULL,
    [isCompleted] BIT NOT NULL CONSTRAINT [SetupState_isCompleted_df] DEFAULT 0,
    [siteName] NVARCHAR(191),
    [initializedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SetupState_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [SetupState_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [email] NVARCHAR(191) NOT NULL,
    [passwordHash] NVARCHAR(255) NOT NULL,
    [canLogin] BIT NOT NULL CONSTRAINT [User_canLogin_df] DEFAULT 1,
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Session] (
    [id] NVARCHAR(191) NOT NULL,
    [token] NVARCHAR(191) NOT NULL,
    [userId] NVARCHAR(191) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [ipAddress] NVARCHAR(191),
    [userAgent] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Session_createdAt_df] DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT [Session_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] NVARCHAR(191) NOT NULL,
    [key] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Scope] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [slug] NVARCHAR(191) NOT NULL,
    [description] NVARCHAR(1000),
    [colorHex] NVARCHAR(191),
    [colorMode] NVARCHAR(191),
    [isSystem] BIT NOT NULL CONSTRAINT [Scope_isSystem_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Scope_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [Scope_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[UserRole] (
    [id] NVARCHAR(191) NOT NULL,
    [userId] NVARCHAR(191) NOT NULL,
    [roleId] NVARCHAR(191) NOT NULL,

    CONSTRAINT [UserRole_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[UserScope] (
    [id] NVARCHAR(191) NOT NULL,
    [userId] NVARCHAR(191) NOT NULL,
    [scopeId] NVARCHAR(191) NOT NULL,

    CONSTRAINT [UserScope_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Category] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [slug] NVARCHAR(191) NOT NULL,
    [parentId] NVARCHAR(191),
    [colorHex] NVARCHAR(191),
    [colorMode] NVARCHAR(191),
    [sortOrder] INT NOT NULL CONSTRAINT [Category_sortOrder_df] DEFAULT 0,
    [defaultLabelTemplateId] NVARCHAR(191),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Category_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [Category_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Location] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [slug] NVARCHAR(191) NOT NULL,
    [parentId] NVARCHAR(191),
    [colorHex] NVARCHAR(191),
    [colorMode] NVARCHAR(191),
    [code] NVARCHAR(191),
    [description] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Location_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [Location_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AssetStatus] (
    [id] NVARCHAR(191) NOT NULL,
    [key] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [color] NVARCHAR(191),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetStatus_createdAt_df] DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT [AssetStatus_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Asset] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [make] NVARCHAR(191),
    [model] NVARCHAR(191),
    [assetTag] NVARCHAR(191) NOT NULL,
    [serialNumber] NVARCHAR(191),
    [notes] NVARCHAR(2000),
    [purchaseDate] DATETIME2,
    [warrantyExpiry] DATETIME2,
    [categoryId] NVARCHAR(191),
    [statusId] NVARCHAR(191),
    [assignedUserId] NVARCHAR(191),
    [assignedLocationId] NVARCHAR(191),
    [labelTemplateId] NVARCHAR(191),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Asset_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [Asset_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AssetScope] (
    [id] NVARCHAR(191) NOT NULL,
    [assetId] NVARCHAR(191) NOT NULL,
    [scopeId] NVARCHAR(191) NOT NULL,

    CONSTRAINT [AssetScope_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LabelTemplate] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [slug] NVARCHAR(191) NOT NULL,
    [description] NVARCHAR(1000),
    [widthMm] FLOAT(53) NOT NULL,
    [heightMm] FLOAT(53) NOT NULL,
    [unit] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplate_unit_df] DEFAULT N'millimeters',
    [orientation] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplate_orientation_df] DEFAULT N'portrait',
    [marginTopMm] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplate_marginTopMm_df] DEFAULT 1,
    [marginRightMm] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplate_marginRightMm_df] DEFAULT 1,
    [marginBottomMm] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplate_marginBottomMm_df] DEFAULT 1,
    [marginLeftMm] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplate_marginLeftMm_df] DEFAULT 1,
    [isEnabled] BIT NOT NULL CONSTRAINT [LabelTemplate_isEnabled_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LabelTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [LabelTemplate_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LabelTemplateField] (
    [id] NVARCHAR(191) NOT NULL,
    [templateId] NVARCHAR(191) NOT NULL,
    [type] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplateField_type_df] DEFAULT N'text',
    [fieldKey] NVARCHAR(191) NOT NULL,
    [label] NVARCHAR(191),
    [isVisible] BIT NOT NULL CONSTRAINT [LabelTemplateField_isVisible_df] DEFAULT 1,
    [posX] FLOAT(53) NOT NULL,
    [posY] FLOAT(53) NOT NULL,
    [width] FLOAT(53) NOT NULL,
    [height] FLOAT(53) NOT NULL,
    [fontSize] INT,
    [fontWeight] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplateField_fontWeight_df] DEFAULT N'normal',
    [italic] BIT NOT NULL CONSTRAINT [LabelTemplateField_italic_df] DEFAULT 0,
    [alignment] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplateField_alignment_df] DEFAULT N'left',
    [rotation] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplateField_rotation_df] DEFAULT 0,
    [zIndex] INT NOT NULL CONSTRAINT [LabelTemplateField_zIndex_df] DEFAULT 0,

    CONSTRAINT [LabelTemplateField_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Setting] (
    [id] NVARCHAR(191) NOT NULL,
    [category] NVARCHAR(191) NOT NULL,
    [key] NVARCHAR(191) NOT NULL,
    [value] NVARCHAR(MAX) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Setting_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [Setting_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BrandingAsset] (
    [id] NVARCHAR(191) NOT NULL,
    [kind] NVARCHAR(191) NOT NULL,
    [fileName] NVARCHAR(255) NOT NULL,
    [filePath] NVARCHAR(1000) NOT NULL,
    [mimeType] NVARCHAR(191),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BrandingAsset_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [BrandingAsset_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuthProviderConfig] (
    [id] NVARCHAR(191) NOT NULL,
    [providerKey] NVARCHAR(191) NOT NULL,
    [isEnabled] BIT NOT NULL CONSTRAINT [AuthProviderConfig_isEnabled_df] DEFAULT 0,
    [configJson] NVARCHAR(MAX) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuthProviderConfig_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,

    CONSTRAINT [AuthProviderConfig_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] NVARCHAR(191) NOT NULL,
    [actorUserId] NVARCHAR(191),
    [action] NVARCHAR(191) NOT NULL,
    [entityType] NVARCHAR(191) NOT NULL,
    [entityId] NVARCHAR(191),
    [summary] NVARCHAR(1000) NOT NULL,
    [payloadJson] NVARCHAR(MAX),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [User_email_key] ON [dbo].[User]([email]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [Session_token_key] ON [dbo].[Session]([token]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [Role_key_key] ON [dbo].[Role]([key]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [Scope_slug_key] ON [dbo].[Scope]([slug]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [UserRole_userId_roleId_key] ON [dbo].[UserRole]([userId], [roleId]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [UserScope_userId_scopeId_key] ON [dbo].[UserScope]([userId], [scopeId]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [Category_slug_key] ON [dbo].[Category]([slug]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [Location_slug_key] ON [dbo].[Location]([slug]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [Location_code_key] ON [dbo].[Location]([code]) WHERE [code] IS NOT NULL;

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [AssetStatus_key_key] ON [dbo].[AssetStatus]([key]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [Asset_assetTag_key] ON [dbo].[Asset]([assetTag]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [AssetScope_assetId_scopeId_key] ON [dbo].[AssetScope]([assetId], [scopeId]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [LabelTemplate_slug_key] ON [dbo].[LabelTemplate]([slug]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LabelTemplateField_templateId_zIndex_idx] ON [dbo].[LabelTemplateField]([templateId], [zIndex]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [Setting_key_key] ON [dbo].[Setting]([key]);

-- CreateIndex
CREATE UNIQUE NONCLUSTERED INDEX [AuthProviderConfig_providerKey_key] ON [dbo].[AuthProviderConfig]([providerKey]);

-- AddForeignKey
ALTER TABLE [dbo].[Session] ADD CONSTRAINT [Session_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserScope] ADD CONSTRAINT [UserScope_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[UserScope] ADD CONSTRAINT [UserScope_scopeId_fkey] FOREIGN KEY ([scopeId]) REFERENCES [dbo].[Scope]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Category] ADD CONSTRAINT [Category_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[Category]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Category] ADD CONSTRAINT [Category_defaultLabelTemplateId_fkey] FOREIGN KEY ([defaultLabelTemplateId]) REFERENCES [dbo].[LabelTemplate]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Location] ADD CONSTRAINT [Location_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[Location]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_statusId_fkey] FOREIGN KEY ([statusId]) REFERENCES [dbo].[AssetStatus]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_assignedUserId_fkey] FOREIGN KEY ([assignedUserId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_assignedLocationId_fkey] FOREIGN KEY ([assignedLocationId]) REFERENCES [dbo].[Location]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_labelTemplateId_fkey] FOREIGN KEY ([labelTemplateId]) REFERENCES [dbo].[LabelTemplate]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AssetScope] ADD CONSTRAINT [AssetScope_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AssetScope] ADD CONSTRAINT [AssetScope_scopeId_fkey] FOREIGN KEY ([scopeId]) REFERENCES [dbo].[Scope]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[LabelTemplateField] ADD CONSTRAINT [LabelTemplateField_templateId_fkey] FOREIGN KEY ([templateId]) REFERENCES [dbo].[LabelTemplate]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_actorUserId_fkey] FOREIGN KEY ([actorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE CASCADE;

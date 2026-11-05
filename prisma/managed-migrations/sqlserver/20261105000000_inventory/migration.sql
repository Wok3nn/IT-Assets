BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

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
    [passwordHash] NVARCHAR(191) NOT NULL,
    [canLogin] BIT NOT NULL CONSTRAINT [User_canLogin_df] DEFAULT 1,
    [isActive] BIT NOT NULL CONSTRAINT [User_isActive_df] DEFAULT 1,
    [lastLoginAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[GuestProfile] (
    [id] NVARCHAR(191) NOT NULL,
    [displayName] NVARCHAR(191) NOT NULL,
    [guestType] NVARCHAR(191) NOT NULL CONSTRAINT [GuestProfile_guestType_df] DEFAULT 'Guest',
    [notes] NVARCHAR(max),
    [isActive] BIT NOT NULL CONSTRAINT [GuestProfile_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [GuestProfile_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [GuestProfile_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Session] (
    [id] NVARCHAR(191) NOT NULL,
    [token] NVARCHAR(191) NOT NULL,
    [userId] NVARCHAR(191) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [ipAddress] NVARCHAR(191),
    [userAgent] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Session_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Session_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Session_token_key] UNIQUE NONCLUSTERED ([token])
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] NVARCHAR(191) NOT NULL,
    [key] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[Scope] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [slug] NVARCHAR(191) NOT NULL,
    [description] NVARCHAR(max),
    [colorHex] NVARCHAR(191),
    [colorMode] NVARCHAR(191),
    [isSystem] BIT NOT NULL CONSTRAINT [Scope_isSystem_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Scope_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Scope_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Scope_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[UserRole] (
    [id] NVARCHAR(191) NOT NULL,
    [userId] NVARCHAR(191) NOT NULL,
    [roleId] NVARCHAR(191) NOT NULL,
    CONSTRAINT [UserRole_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserRole_userId_roleId_key] UNIQUE NONCLUSTERED ([userId],[roleId])
);

-- CreateTable
CREATE TABLE [dbo].[UserScope] (
    [id] NVARCHAR(191) NOT NULL,
    [userId] NVARCHAR(191) NOT NULL,
    [scopeId] NVARCHAR(191) NOT NULL,
    CONSTRAINT [UserScope_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UserScope_userId_scopeId_key] UNIQUE NONCLUSTERED ([userId],[scopeId])
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
    CONSTRAINT [Category_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Category_slug_key] UNIQUE NONCLUSTERED ([slug])
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
    [description] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Location_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Location_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Location_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[AssetStatus] (
    [id] NVARCHAR(191) NOT NULL,
    [key] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [color] NVARCHAR(191),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AssetStatus_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AssetStatus_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AssetStatus_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[Asset] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [make] NVARCHAR(191),
    [model] NVARCHAR(191),
    [assetTag] NVARCHAR(191) NOT NULL,
    [serialNumber] NVARCHAR(191),
    [notes] NVARCHAR(max),
    [purchaseDate] DATETIME2,
    [warrantyExpiry] DATETIME2,
    [categoryId] NVARCHAR(191),
    [statusId] NVARCHAR(191),
    [assignedUserId] NVARCHAR(191),
    [assignedGuestProfileId] NVARCHAR(191),
    [assignedLocationId] NVARCHAR(191),
    [labelTemplateId] NVARCHAR(191),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Asset_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Asset_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Asset_assetTag_key] UNIQUE NONCLUSTERED ([assetTag])
);

-- CreateTable
CREATE TABLE [dbo].[BorrowedItem] (
    [id] NVARCHAR(191) NOT NULL,
    [assetId] NVARCHAR(191),
    [activeAssetId] NVARCHAR(191),
    [itemName] NVARCHAR(191),
    [quantity] INT NOT NULL CONSTRAINT [BorrowedItem_quantity_df] DEFAULT 1,
    [borrowerUserId] NVARCHAR(191) NOT NULL,
    [borrowedAt] DATETIME2 NOT NULL CONSTRAINT [BorrowedItem_borrowedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [dueAt] DATETIME2 NOT NULL,
    [returnedAt] DATETIME2,
    [issuedByUserId] NVARCHAR(191) NOT NULL,
    [returnedByUserId] NVARCHAR(191),
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BorrowedItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BorrowedItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BorrowedItemNotification] (
    [id] NVARCHAR(191) NOT NULL,
    [borrowedItemId] NVARCHAR(191),
    [dedupeKey] NVARCHAR(191),
    [type] NVARCHAR(191) NOT NULL,
    [recipient] NVARCHAR(191) NOT NULL,
    [status] NVARCHAR(191) NOT NULL,
    [sentAt] DATETIME2,
    [error] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BorrowedItemNotification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [BorrowedItemNotification_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[BorrowedItemReminderDedupe] (
    [dedupeKey] NVARCHAR(191) NOT NULL,
    [borrowedItemId] NVARCHAR(191),
    [type] NVARCHAR(191) NOT NULL,
    [scheduledFor] DATETIME2 NOT NULL,
    [status] NVARCHAR(191) NOT NULL,
    [notificationId] NVARCHAR(191),
    [lastAttemptAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [BorrowedItemReminderDedupe_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [BorrowedItemReminderDedupe_pkey] PRIMARY KEY CLUSTERED ([dedupeKey])
);

-- CreateTable
CREATE TABLE [dbo].[AssetScope] (
    [id] NVARCHAR(191) NOT NULL,
    [assetId] NVARCHAR(191) NOT NULL,
    [scopeId] NVARCHAR(191) NOT NULL,
    CONSTRAINT [AssetScope_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AssetScope_assetId_scopeId_key] UNIQUE NONCLUSTERED ([assetId],[scopeId])
);

-- CreateTable
CREATE TABLE [dbo].[LabelTemplate] (
    [id] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NOT NULL,
    [slug] NVARCHAR(191) NOT NULL,
    [description] NVARCHAR(max),
    [widthMm] FLOAT(53) NOT NULL,
    [heightMm] FLOAT(53) NOT NULL,
    [unit] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplate_unit_df] DEFAULT 'millimeters',
    [orientation] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplate_orientation_df] DEFAULT 'portrait',
    [marginTopMm] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplate_marginTopMm_df] DEFAULT 1,
    [marginRightMm] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplate_marginRightMm_df] DEFAULT 1,
    [marginBottomMm] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplate_marginBottomMm_df] DEFAULT 1,
    [marginLeftMm] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplate_marginLeftMm_df] DEFAULT 1,
    [isEnabled] BIT NOT NULL CONSTRAINT [LabelTemplate_isEnabled_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LabelTemplate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [LabelTemplate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LabelTemplate_slug_key] UNIQUE NONCLUSTERED ([slug])
);

-- CreateTable
CREATE TABLE [dbo].[LabelTemplateField] (
    [id] NVARCHAR(191) NOT NULL,
    [templateId] NVARCHAR(191) NOT NULL,
    [type] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplateField_type_df] DEFAULT 'text',
    [fieldKey] NVARCHAR(191) NOT NULL,
    [label] NVARCHAR(191),
    [isVisible] BIT NOT NULL CONSTRAINT [LabelTemplateField_isVisible_df] DEFAULT 1,
    [posX] FLOAT(53) NOT NULL,
    [posY] FLOAT(53) NOT NULL,
    [width] FLOAT(53) NOT NULL,
    [height] FLOAT(53) NOT NULL,
    [fontSize] INT,
    [fontWeight] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplateField_fontWeight_df] DEFAULT 'normal',
    [italic] BIT NOT NULL CONSTRAINT [LabelTemplateField_italic_df] DEFAULT 0,
    [alignment] NVARCHAR(191) NOT NULL CONSTRAINT [LabelTemplateField_alignment_df] DEFAULT 'left',
    [rotation] FLOAT(53) NOT NULL CONSTRAINT [LabelTemplateField_rotation_df] DEFAULT 0,
    [zIndex] INT NOT NULL CONSTRAINT [LabelTemplateField_zIndex_df] DEFAULT 0,
    CONSTRAINT [LabelTemplateField_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Setting] (
    [id] NVARCHAR(191) NOT NULL,
    [category] NVARCHAR(191) NOT NULL,
    [key] NVARCHAR(191) NOT NULL,
    [value] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Setting_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Setting_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Setting_key_key] UNIQUE NONCLUSTERED ([key])
);

-- CreateTable
CREATE TABLE [dbo].[BrandingAsset] (
    [id] NVARCHAR(191) NOT NULL,
    [kind] NVARCHAR(191) NOT NULL,
    [fileName] NVARCHAR(191) NOT NULL,
    [filePath] NVARCHAR(191) NOT NULL,
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
    [configJson] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuthProviderConfig_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [AuthProviderConfig_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AuthProviderConfig_providerKey_key] UNIQUE NONCLUSTERED ([providerKey])
);

-- CreateTable
CREATE TABLE [dbo].[AuditLog] (
    [id] NVARCHAR(191) NOT NULL,
    [actorUserId] NVARCHAR(191),
    [action] NVARCHAR(191) NOT NULL,
    [entityType] NVARCHAR(191) NOT NULL,
    [entityId] NVARCHAR(191),
    [summary] NVARCHAR(max) NOT NULL,
    [payloadJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditLog_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditLog_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GuestProfile_displayName_idx] ON [dbo].[GuestProfile]([displayName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GuestProfile_guestType_idx] ON [dbo].[GuestProfile]([guestType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [GuestProfile_isActive_idx] ON [dbo].[GuestProfile]([isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Asset_assignedGuestProfileId_idx] ON [dbo].[Asset]([assignedGuestProfileId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItem_assetId_idx] ON [dbo].[BorrowedItem]([assetId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItem_borrowerUserId_returnedAt_idx] ON [dbo].[BorrowedItem]([borrowerUserId], [returnedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItem_dueAt_idx] ON [dbo].[BorrowedItem]([dueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItem_issuedByUserId_idx] ON [dbo].[BorrowedItem]([issuedByUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItem_returnedByUserId_idx] ON [dbo].[BorrowedItem]([returnedByUserId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItemNotification_borrowedItemId_type_status_idx] ON [dbo].[BorrowedItemNotification]([borrowedItemId], [type], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItemNotification_dedupeKey_idx] ON [dbo].[BorrowedItemNotification]([dedupeKey]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItemNotification_type_status_createdAt_idx] ON [dbo].[BorrowedItemNotification]([type], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItemNotification_recipient_idx] ON [dbo].[BorrowedItemNotification]([recipient]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItemReminderDedupe_borrowedItemId_type_scheduledFor_idx] ON [dbo].[BorrowedItemReminderDedupe]([borrowedItemId], [type], [scheduledFor]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [BorrowedItemReminderDedupe_type_status_scheduledFor_idx] ON [dbo].[BorrowedItemReminderDedupe]([type], [status], [scheduledFor]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [LabelTemplateField_templateId_zIndex_idx] ON [dbo].[LabelTemplateField]([templateId], [zIndex]);

-- AddForeignKey
ALTER TABLE [dbo].[Session] ADD CONSTRAINT [Session_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserScope] ADD CONSTRAINT [UserScope_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserScope] ADD CONSTRAINT [UserScope_scopeId_fkey] FOREIGN KEY ([scopeId]) REFERENCES [dbo].[Scope]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Category] ADD CONSTRAINT [Category_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[Category]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Category] ADD CONSTRAINT [Category_defaultLabelTemplateId_fkey] FOREIGN KEY ([defaultLabelTemplateId]) REFERENCES [dbo].[LabelTemplate]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Location] ADD CONSTRAINT [Location_parentId_fkey] FOREIGN KEY ([parentId]) REFERENCES [dbo].[Location]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_categoryId_fkey] FOREIGN KEY ([categoryId]) REFERENCES [dbo].[Category]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_statusId_fkey] FOREIGN KEY ([statusId]) REFERENCES [dbo].[AssetStatus]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_assignedUserId_fkey] FOREIGN KEY ([assignedUserId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_assignedGuestProfileId_fkey] FOREIGN KEY ([assignedGuestProfileId]) REFERENCES [dbo].[GuestProfile]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_assignedLocationId_fkey] FOREIGN KEY ([assignedLocationId]) REFERENCES [dbo].[Location]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_labelTemplateId_fkey] FOREIGN KEY ([labelTemplateId]) REFERENCES [dbo].[LabelTemplate]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowedItem] ADD CONSTRAINT [BorrowedItem_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowedItem] ADD CONSTRAINT [BorrowedItem_activeAssetId_fkey] FOREIGN KEY ([activeAssetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowedItem] ADD CONSTRAINT [BorrowedItem_borrowerUserId_fkey] FOREIGN KEY ([borrowerUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowedItem] ADD CONSTRAINT [BorrowedItem_issuedByUserId_fkey] FOREIGN KEY ([issuedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowedItem] ADD CONSTRAINT [BorrowedItem_returnedByUserId_fkey] FOREIGN KEY ([returnedByUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowedItemNotification] ADD CONSTRAINT [BorrowedItemNotification_borrowedItemId_fkey] FOREIGN KEY ([borrowedItemId]) REFERENCES [dbo].[BorrowedItem]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[BorrowedItemReminderDedupe] ADD CONSTRAINT [BorrowedItemReminderDedupe_borrowedItemId_fkey] FOREIGN KEY ([borrowedItemId]) REFERENCES [dbo].[BorrowedItem]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetScope] ADD CONSTRAINT [AssetScope_assetId_fkey] FOREIGN KEY ([assetId]) REFERENCES [dbo].[Asset]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AssetScope] ADD CONSTRAINT [AssetScope_scopeId_fkey] FOREIGN KEY ([scopeId]) REFERENCES [dbo].[Scope]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LabelTemplateField] ADD CONSTRAINT [LabelTemplateField_templateId_fkey] FOREIGN KEY ([templateId]) REFERENCES [dbo].[LabelTemplate]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditLog] ADD CONSTRAINT [AuditLog_actorUserId_fkey] FOREIGN KEY ([actorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE UNIQUE INDEX [Location_code_key] ON [dbo].[Location] ([code]) WHERE [code] IS NOT NULL;
CREATE UNIQUE INDEX [BorrowedItem_activeAssetId_key] ON [dbo].[BorrowedItem] ([activeAssetId]) WHERE [activeAssetId] IS NOT NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

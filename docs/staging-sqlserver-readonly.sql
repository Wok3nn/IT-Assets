-- Run manually in SSMS, connected to the intended server/database with the application login.
-- Read-only metadata. Do not send credentials, connection URLs or migration logs.
SELECT DB_NAME() AS database_name, @@VERSION AS server_version,
 HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','VIEW DEFINITION') AS can_view_definition;
SELECT migration_name, checksum, finished_at, rolled_back_at
FROM dbo._prisma_migrations ORDER BY migration_name;
SELECT SCHEMA_NAME(schema_id) AS schema_name, name, type_desc
FROM sys.objects WHERE is_ms_shipped=0 AND parent_object_id=0 ORDER BY schema_name,name;
SELECT OBJECT_NAME(i.object_id) AS table_name, i.name, i.is_unique,
 i.is_disabled, i.filter_definition, c.key_ordinal, COL_NAME(c.object_id,c.column_id) AS column_name
FROM sys.indexes i JOIN sys.index_columns c
ON i.object_id=c.object_id AND i.index_id=c.index_id
WHERE OBJECT_SCHEMA_NAME(i.object_id)='dbo'
AND OBJECT_NAME(i.object_id) IN ('Location','BorrowedItem')
ORDER BY table_name,i.name,c.key_ordinal;

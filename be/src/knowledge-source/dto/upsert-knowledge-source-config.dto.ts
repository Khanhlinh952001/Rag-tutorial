export class UpsertKnowledgeSourceConfigDto {
  sourceName?: string;
  dbType!: 'POSTGRES' | 'MYSQL' | 'SQLITE';

  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  schema?: string;
  sqlitePath?: string;

  tableName?: string;
  idColumn?: string;
  contentColumn?: string;
  titleColumn?: string;
  whereClause?: string;
}

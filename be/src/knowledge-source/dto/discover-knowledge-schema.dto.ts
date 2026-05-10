export class DiscoverKnowledgeSchemaDto {
  dbType!: 'POSTGRES' | 'MYSQL' | 'SQLITE';

  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  schema?: string;
  sqlitePath?: string;

  tableName?: string;
}

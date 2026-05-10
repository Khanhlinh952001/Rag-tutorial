import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { VectorService } from '../vector/vector.service';
import { ExternalDbType } from '../generated/prisma/enums';
import type { DiscoverKnowledgeSchemaDto } from './dto/discover-knowledge-schema.dto';
import type { UpsertKnowledgeSourceConfigDto } from './dto/upsert-knowledge-source-config.dto';

type ExternalRow = Record<string, unknown>;

@Injectable()
export class KnowledgeSourceService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(VectorService)
    private readonly vectorService: VectorService,
  ) {}

  async listConfigs() {
    const configs = await this.prisma.knowledgeSourceConfig
      .findMany({
        where: { isActive: true },
        orderBy: [{ updatedAt: 'desc' }],
      })
      .catch((error: unknown) => {
        if (this.isKnowledgeConfigTableMissing(error)) {
          return [];
        }
        throw error;
      });
    return configs.map((config) => this.maskPassword(config));
  }

  async getConfigById(id: string) {
    const config = await this.prisma.knowledgeSourceConfig
      .findFirst({
        where: { id, isActive: true },
      })
      .catch((error: unknown) => {
        if (this.isKnowledgeConfigTableMissing(error)) {
          return null;
        }
        throw error;
      });
    if (!config) return null;
    return this.maskPassword(config);
  }

  async upsertConfig(dto: UpsertKnowledgeSourceConfigDto) {
    const dbType = this.toDbType(dto.dbType);
    this.validateConfig(dbType, dto);
    const sourceName = dto.sourceName?.trim() || 'default';

    const saved = await this.prisma.knowledgeSourceConfig
      .upsert({
        where: { name: sourceName },
        update: {
          name: sourceName,
          dbType,
          host: dto.host ?? null,
          port: dto.port ?? null,
          username: dto.username ?? null,
          password: dto.password ?? null,
          database: dto.database ?? null,
          schema: dto.schema ?? null,
          sqlitePath: dto.sqlitePath ?? null,
          tableName: dto.tableName ?? '',
          idColumn: dto.idColumn ?? 'id',
          contentColumn: dto.contentColumn ?? 'content',
          titleColumn: dto.titleColumn ?? null,
          whereClause: dto.whereClause ?? null,
          isActive: true,
        },
        create: {
          name: sourceName,
          dbType,
          host: dto.host ?? null,
          port: dto.port ?? null,
          username: dto.username ?? null,
          password: dto.password ?? null,
          database: dto.database ?? null,
          schema: dto.schema ?? null,
          sqlitePath: dto.sqlitePath ?? null,
          tableName: dto.tableName ?? '',
          idColumn: dto.idColumn ?? 'id',
          contentColumn: dto.contentColumn ?? 'content',
          titleColumn: dto.titleColumn ?? null,
          whereClause: dto.whereClause ?? null,
          isActive: true,
        },
      })
      .catch((error: unknown) => {
        if (this.isKnowledgeConfigTableMissing(error)) {
          this.throwSchemaNotReady();
        }
        throw error;
      });

    return this.maskPassword(saved);
  }

  async removeConfig(id: string) {
    const result = await this.prisma.knowledgeSourceConfig
      .deleteMany({ where: { id, isActive: true } })
      .catch((error: unknown) => {
        if (this.isKnowledgeConfigTableMissing(error)) {
          this.throwSchemaNotReady();
        }
        throw error;
      });

    return {
      removed: result.count > 0,
      count: result.count,
    };
  }

  async discoverSchema(dto: DiscoverKnowledgeSchemaDto) {
    const dbType = this.toDbType(dto.dbType);
    this.validateConnectionOnly(dbType, dto);

    const tableName = dto.tableName?.trim() || undefined;
    const safeTableName = tableName ? this.ensureSafeIdentifier(tableName, 'tableName') : undefined;

    if (dbType === ExternalDbType.POSTGRES) {
      const schema = dto.schema?.trim() || 'public';
      const tables = await this.listPostgresTables({
        host: dto.host,
        port: dto.port,
        username: dto.username,
        password: dto.password,
        database: dto.database,
        schema,
      }).catch((error: unknown) => this.rethrowExternalDbError(error));
      const columns = safeTableName
        ? await this.listPostgresColumns(
            {
              host: dto.host,
              port: dto.port,
              username: dto.username,
              password: dto.password,
              database: dto.database,
              schema,
            },
            safeTableName,
          ).catch((error: unknown) => this.rethrowExternalDbError(error))
        : [];
      const sampleRows = safeTableName
        ? await this.listPostgresSampleRows(
            {
              host: dto.host,
              port: dto.port,
              username: dto.username,
              password: dto.password,
              database: dto.database,
              schema,
            },
            safeTableName,
          ).catch((error: unknown) => this.rethrowExternalDbError(error))
        : [];
      return { dbType, schema, tables, columns, sampleRows };
    }

    if (dbType === ExternalDbType.MYSQL) {
      const tables = await this.listMySqlTables({
        host: dto.host,
        port: dto.port,
        username: dto.username,
        password: dto.password,
        database: dto.database,
      }).catch((error: unknown) => this.rethrowExternalDbError(error));
      const columns = safeTableName
        ? await this.listMySqlColumns(
            {
              host: dto.host,
              port: dto.port,
              username: dto.username,
              password: dto.password,
              database: dto.database,
            },
            safeTableName,
          ).catch((error: unknown) => this.rethrowExternalDbError(error))
        : [];
      const sampleRows = safeTableName
        ? await this.listMySqlSampleRows(
            {
              host: dto.host,
              port: dto.port,
              username: dto.username,
              password: dto.password,
              database: dto.database,
            },
            safeTableName,
          ).catch((error: unknown) => this.rethrowExternalDbError(error))
        : [];
      return { dbType, tables, columns, sampleRows };
    }

    const sqlitePath = dto.sqlitePath?.trim();
    if (!sqlitePath) {
      throw new BadRequestException('sqlitePath가 비어 있습니다.');
    }
    const tables = await this.listSqliteTables(sqlitePath).catch((error: unknown) =>
      this.rethrowExternalDbError(error),
    );
    const columns = safeTableName
      ? await this.listSqliteColumns(sqlitePath, safeTableName).catch((error: unknown) =>
          this.rethrowExternalDbError(error),
        )
      : [];
    const sampleRows = safeTableName
      ? await this.listSqliteSampleRows(sqlitePath, safeTableName).catch((error: unknown) =>
          this.rethrowExternalDbError(error),
        )
      : [];
    return { dbType, tables, columns, sampleRows };
  }

  async testConnection(sourceId?: string) {
    const config = await this.resolveSourceConfig(sourceId);
    if (!config) {
      throw new BadRequestException('활성화된 Knowledge Source 설정이 없습니다.');
    }

    const tables = await this.listTablesByDbType(config.dbType, {
      host: config.host ?? undefined,
      port: config.port ?? undefined,
      username: config.username ?? undefined,
      password: config.password ?? undefined,
      database: config.database ?? undefined,
      schema: config.schema ?? undefined,
      sqlitePath: config.sqlitePath ?? undefined,
    }).catch((error: unknown) => this.rethrowExternalDbError(error));

    return {
      ok: true,
      dbType: config.dbType,
      tableName: config.tableName || null,
      sampledRows: 0,
      totalTables: tables.length,
    };
  }

  async syncSource(limit?: number, sourceId?: string) {
    const config = await this.resolveSourceConfig(sourceId);
    if (!config) {
      throw new BadRequestException('활성화된 Knowledge Source 설정이 없습니다.');
    }

    const safeLimit =
      Number.isFinite(limit) && limit != null && limit > 0 ? Math.floor(limit) : 200;
    const selectedTables = this.parseSelectedTables(config.tableName);
    if (selectedTables.length === 0) {
      throw new BadRequestException('동기화할 테이블을 먼저 선택해 주세요.');
    }

    const limitPerTable = Math.max(1, Math.floor(safeLimit / selectedTables.length));
    const allRows: Array<{ table: string; row: ExternalRow }> = [];
    for (const table of selectedTables) {
      const rows = await this.fetchRowsForTableAllColumns(config.dbType, {
        host: config.host ?? undefined,
        port: config.port ?? undefined,
        username: config.username ?? undefined,
        password: config.password ?? undefined,
        database: config.database ?? undefined,
        schema: config.schema ?? undefined,
        sqlitePath: config.sqlitePath ?? undefined,
        tableName: table,
        whereClause: config.whereClause ?? undefined,
      }, limitPerTable).catch((error: unknown) => this.rethrowExternalDbError(error));
      allRows.push(...rows.map((row) => ({ table, row })));
    }

    const maybeChunks = allRows.map((item, index) =>
      this.rowToChunkAllColumns(item.row, index, item.table),
    );
    const chunks = maybeChunks.filter((chunk) => chunk != null);

    if (chunks.length === 0) {
      return { indexed: 0, totalRows: allRows.length, note: '색인할 텍스트가 없습니다.' };
    }

    const virtualDocumentId = `external-${config.id}`;
    const result = await this.vectorService.indexDocumentChunks({
      documentId: virtualDocumentId,
      mimeType: `external/${config.dbType.toLowerCase()}`,
      source: `${config.dbType}:${selectedTables.join(',')}`,
      chunks: chunks.map((chunk) => ({
        index: chunk.index,
        content: chunk.content,
        metadata: chunk.metadata,
      })),
    });

    return {
      dbType: config.dbType,
      sourceTable: selectedTables.join(','),
      totalRows: allRows.length,
      indexed: result.indexed,
      store: result.store,
      documentId: virtualDocumentId,
      syncedTables: selectedTables,
    };
  }

  private rowToChunkAllColumns(row: ExternalRow, fallbackIndex: number, tableName: string) {
    const entries = Object.entries(row)
      .filter(([, value]) => value != null)
      .map(([key, value]) => `${key}: ${this.stringifyValue(value)}`);
    if (entries.length === 0) {
      return null;
    }

    const rowId = row.id;
    const chunkIndex = Number.isFinite(Number(rowId)) ? Number(rowId) : fallbackIndex;
    const normalized = entries.join('\n').replace(/\s+\n/g, '\n').trim();
    return {
      index: chunkIndex,
      content: normalized,
      metadata: {
        sourceType: 'external-db',
        tableName,
        rowId: row.id ?? null,
        title: typeof row.title === 'string' ? row.title : undefined,
      },
    };
  }

  private validateConfig(dbType: ExternalDbType, dto: UpsertKnowledgeSourceConfigDto) {
    if (dbType === ExternalDbType.SQLITE) {
      if (!dto.sqlitePath?.trim()) {
        throw new BadRequestException('sqlite 사용 시 sqlitePath는 필수입니다.');
      }
      return;
    }
    if (!dto.host?.trim() || !dto.database?.trim()) {
      throw new BadRequestException('host, database는 필수입니다.');
    }
    if (!dto.username?.trim()) {
      throw new BadRequestException('username은 필수입니다.');
    }
  }

  private validateConnectionOnly(
    dbType: ExternalDbType,
    dto: Pick<
      DiscoverKnowledgeSchemaDto,
      'host' | 'database' | 'username' | 'sqlitePath'
    >,
  ) {
    if (dbType === ExternalDbType.SQLITE) {
      if (!dto.sqlitePath?.trim()) {
        throw new BadRequestException('sqlite 사용 시 sqlitePath는 필수입니다.');
      }
      return;
    }
    if (!dto.host?.trim() || !dto.database?.trim()) {
      throw new BadRequestException('host, database는 필수입니다.');
    }
    if (!dto.username?.trim()) {
      throw new BadRequestException('username은 필수입니다.');
    }
  }

  private parseSelectedTables(raw: string): string[] {
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => this.ensureSafeIdentifier(value, 'tableName'));
  }

  private stringifyValue(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private toDbType(value: string): ExternalDbType {
    const normalized = value.toUpperCase();
    if (
      normalized !== ExternalDbType.POSTGRES &&
      normalized !== ExternalDbType.MYSQL &&
      normalized !== ExternalDbType.SQLITE
    ) {
      throw new BadRequestException('dbType은 POSTGRES | MYSQL | SQLITE 중 하나여야 합니다.');
    }
    return normalized as ExternalDbType;
  }

  private maskPassword<T extends { password: string | null }>(config: T) {
    return {
      ...config,
      password: config.password ? '********' : null,
    };
  }

  private async fetchRows(
    dbType: ExternalDbType,
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      schema?: string;
      sqlitePath?: string;
      tableName: string;
      idColumn: string;
      contentColumn: string;
      titleColumn?: string;
      whereClause?: string;
    },
    limit: number,
  ): Promise<ExternalRow[]> {
    if (dbType === ExternalDbType.POSTGRES) {
      return this.fetchRowsFromPostgres(config, limit);
    }
    if (dbType === ExternalDbType.MYSQL) {
      return this.fetchRowsFromMySql(config, limit);
    }
    return this.fetchRowsFromSqlite(config, limit);
  }

  private async listTablesByDbType(
    dbType: ExternalDbType,
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      schema?: string;
      sqlitePath?: string;
    },
  ): Promise<string[]> {
    if (dbType === ExternalDbType.POSTGRES) {
      return this.listPostgresTables({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
        schema: config.schema ?? 'public',
      });
    }
    if (dbType === ExternalDbType.MYSQL) {
      return this.listMySqlTables({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        database: config.database,
      });
    }
    if (!config.sqlitePath) {
      throw new BadRequestException('sqlitePath가 비어 있습니다.');
    }
    return this.listSqliteTables(config.sqlitePath);
  }

  private async fetchRowsForTableAllColumns(
    dbType: ExternalDbType,
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      schema?: string;
      sqlitePath?: string;
      tableName: string;
      whereClause?: string;
    },
    limit: number,
  ): Promise<ExternalRow[]> {
    if (dbType === ExternalDbType.POSTGRES) {
      return this.fetchPostgresRowsAllColumns(config, limit);
    }
    if (dbType === ExternalDbType.MYSQL) {
      return this.fetchMySqlRowsAllColumns(config, limit);
    }
    return this.fetchSqliteRowsAllColumns(config, limit);
  }

  private async fetchPostgresRowsAllColumns(
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      schema?: string;
      tableName: string;
      whereClause?: string;
    },
    limit: number,
  ): Promise<ExternalRow[]> {
    const pgModule = await this.loadPgModule();
    const { Client } = pgModule as {
      Client: new (args: Record<string, unknown>) => {
        connect: () => Promise<void>;
        query: (queryText: string) => Promise<{ rows: ExternalRow[] }>;
        end: () => Promise<void>;
      };
    };
    const client = new Client({
      host: config.host,
      port: config.port ?? 5432,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    const schema = this.ensureSafeIdentifier(config.schema ?? 'public', 'schema');
    const table = this.ensureSafeIdentifier(config.tableName, 'tableName');
    const where = config.whereClause?.trim() ? ` WHERE ${config.whereClause.trim()} ` : ' ';
    const safeLimit = Math.max(1, Math.floor(limit));
    await client.connect();
    try {
      const sql = `SELECT * FROM "${schema}"."${table}"${where}LIMIT ${safeLimit}`;
      const result = await client.query(sql);
      return result.rows;
    } finally {
      await client.end();
    }
  }

  private async fetchMySqlRowsAllColumns(
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      tableName: string;
      whereClause?: string;
    },
    limit: number,
  ): Promise<ExternalRow[]> {
    const mysql = (await this.loadMySqlModule()) as {
      createConnection: (args: Record<string, unknown>) => Promise<{
        query: (query: string) => Promise<[unknown]>;
        end: () => Promise<void>;
      }>;
    };
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port ?? 3306,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    const table = this.ensureSafeIdentifier(config.tableName, 'tableName');
    const where = config.whereClause?.trim() ? ` WHERE ${config.whereClause.trim()} ` : ' ';
    const safeLimit = Math.max(1, Math.floor(limit));
    try {
      const [rows] = await connection.query(
        `SELECT * FROM \`${table}\`${where}LIMIT ${safeLimit}`,
      );
      return Array.isArray(rows) ? (rows as ExternalRow[]) : [];
    } finally {
      await connection.end();
    }
  }

  private async fetchSqliteRowsAllColumns(
    config: {
      sqlitePath?: string;
      tableName: string;
      whereClause?: string;
    },
    limit: number,
  ): Promise<ExternalRow[]> {
    if (!config.sqlitePath) {
      throw new BadRequestException('sqlitePath가 비어 있습니다.');
    }
    const sqlite = (await this.dynamicImport('node:sqlite')) as {
      DatabaseSync: new (path: string) => {
        prepare: (sql: string) => { all: () => ExternalRow[] };
        close: () => void;
      };
    };
    const database = new sqlite.DatabaseSync(config.sqlitePath);
    const table = this.ensureSafeIdentifier(config.tableName, 'tableName');
    const where = config.whereClause?.trim() ? ` WHERE ${config.whereClause.trim()} ` : ' ';
    const safeLimit = Math.max(1, Math.floor(limit));
    try {
      return database
        .prepare(`SELECT * FROM "${table}"${where}LIMIT ${safeLimit}`)
        .all();
    } finally {
      database.close();
    }
  }

  private async fetchRowsFromPostgres(
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      schema?: string;
      tableName: string;
      idColumn: string;
      contentColumn: string;
      titleColumn?: string;
      whereClause?: string;
    },
    limit: number,
  ): Promise<ExternalRow[]> {
    const pgModule = await this.loadPgModule();
    const { Client } = pgModule as {
      Client: new (args: Record<string, unknown>) => {
        connect: () => Promise<void>;
        query: (queryText: string) => Promise<{ rows: ExternalRow[] }>;
        end: () => Promise<void>;
      };
    };
    const client = new Client({
      host: config.host,
      port: config.port ?? 5432,
      user: config.username,
      password: config.password,
      database: config.database,
    });

    const schemaPrefix = config.schema?.trim() ? `"${config.schema}".` : '';
    const sql = this.buildSelectQuery(
      `${schemaPrefix}"${config.tableName}"`,
      config.idColumn,
      config.contentColumn,
      config.titleColumn,
      config.whereClause,
      limit,
    );

    await client.connect();
    try {
      const result = await client.query(sql);
      return result.rows;
    } finally {
      await client.end();
    }
  }

  private async listPostgresTables(config: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    schema: string;
  }): Promise<string[]> {
    const pgModule = await this.loadPgModule();
    const { Client } = pgModule as {
      Client: new (args: Record<string, unknown>) => {
        connect: () => Promise<void>;
        query: (
          queryText: string,
          values?: unknown[],
        ) => Promise<{ rows: Array<{ table_name?: unknown }> }>;
        end: () => Promise<void>;
      };
    };
    const client = new Client({
      host: config.host,
      port: config.port ?? 5432,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    await client.connect();
    try {
      const result = await client.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [config.schema],
      );
      return result.rows
        .map((row) => row.table_name)
        .filter((name): name is string => typeof name === 'string');
    } finally {
      await client.end();
    }
  }

  private async listPostgresColumns(
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      schema: string;
    },
    tableName: string,
  ): Promise<string[]> {
    const pgModule = await this.loadPgModule();
    const { Client } = pgModule as {
      Client: new (args: Record<string, unknown>) => {
        connect: () => Promise<void>;
        query: (
          queryText: string,
          values?: unknown[],
        ) => Promise<{ rows: Array<{ column_name?: unknown }> }>;
        end: () => Promise<void>;
      };
    };
    const client = new Client({
      host: config.host,
      port: config.port ?? 5432,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    await client.connect();
    try {
      const result = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [config.schema, tableName],
      );
      return result.rows
        .map((row) => row.column_name)
        .filter((name): name is string => typeof name === 'string');
    } finally {
      await client.end();
    }
  }

  private async listPostgresSampleRows(
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      schema: string;
    },
    tableName: string,
  ): Promise<ExternalRow[]> {
    const pgModule = await this.loadPgModule();
    const { Client } = pgModule as {
      Client: new (args: Record<string, unknown>) => {
        connect: () => Promise<void>;
        query: (queryText: string) => Promise<{ rows: ExternalRow[] }>;
        end: () => Promise<void>;
      };
    };
    const client = new Client({
      host: config.host,
      port: config.port ?? 5432,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    await client.connect();
    try {
      const sql = `SELECT * FROM "${config.schema}"."${tableName}" LIMIT 10`;
      const result = await client.query(sql);
      return result.rows;
    } finally {
      await client.end();
    }
  }

  private async fetchRowsFromMySql(
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
      tableName: string;
      idColumn: string;
      contentColumn: string;
      titleColumn?: string;
      whereClause?: string;
    },
    limit: number,
  ): Promise<ExternalRow[]> {
    const mysql = (await this.loadMySqlModule()) as {
      createConnection: (args: Record<string, unknown>) => Promise<{
        query: (query: string) => Promise<[unknown]>;
        end: () => Promise<void>;
      }>;
    };
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port ?? 3306,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    const sql = this.buildSelectQuery(
      `\`${config.tableName}\``,
      config.idColumn,
      config.contentColumn,
      config.titleColumn,
      config.whereClause,
      limit,
      true,
    );

    try {
      const [rows] = await connection.query(sql);
      return Array.isArray(rows) ? (rows as ExternalRow[]) : [];
    } finally {
      await connection.end();
    }
  }

  private async listMySqlTables(config: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
  }): Promise<string[]> {
    const mysql = (await this.loadMySqlModule()) as {
      createConnection: (args: Record<string, unknown>) => Promise<{
        query: (query: string) => Promise<[unknown]>;
        end: () => Promise<void>;
      }>;
    };
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port ?? 3306,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    try {
      const [rows] = await connection.query('SHOW TABLES');
      if (!Array.isArray(rows)) return [];
      return rows
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const values = Object.values(row as Record<string, unknown>);
          const first = values[0];
          return typeof first === 'string' ? first : null;
        })
        .filter((name): name is string => Boolean(name));
    } finally {
      await connection.end();
    }
  }

  private async listMySqlColumns(
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
    },
    tableName: string,
  ): Promise<string[]> {
    const mysql = (await this.dynamicImport('mysql2/promise')) as {
      createConnection: (args: Record<string, unknown>) => Promise<{
        query: (query: string) => Promise<[unknown]>;
        end: () => Promise<void>;
      }>;
    };
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port ?? 3306,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    try {
      const safeTable = this.ensureSafeIdentifier(tableName, 'tableName');
      const [rows] = await connection.query(`SHOW COLUMNS FROM \`${safeTable}\``);
      if (!Array.isArray(rows)) return [];
      return rows
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const field = (row as { Field?: unknown }).Field;
          return typeof field === 'string' ? field : null;
        })
        .filter((name): name is string => Boolean(name));
    } finally {
      await connection.end();
    }
  }

  private async listMySqlSampleRows(
    config: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string;
    },
    tableName: string,
  ): Promise<ExternalRow[]> {
    const mysql = (await this.loadMySqlModule()) as {
      createConnection: (args: Record<string, unknown>) => Promise<{
        query: (query: string) => Promise<[unknown]>;
        end: () => Promise<void>;
      }>;
    };
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port ?? 3306,
      user: config.username,
      password: config.password,
      database: config.database,
    });
    try {
      const safeTable = this.ensureSafeIdentifier(tableName, 'tableName');
      const [rows] = await connection.query(`SELECT * FROM \`${safeTable}\` LIMIT 10`);
      return Array.isArray(rows) ? (rows as ExternalRow[]) : [];
    } finally {
      await connection.end();
    }
  }

  private async fetchRowsFromSqlite(
    config: {
      sqlitePath?: string;
      tableName: string;
      idColumn: string;
      contentColumn: string;
      titleColumn?: string;
      whereClause?: string;
    },
    limit: number,
  ): Promise<ExternalRow[]> {
    if (!config.sqlitePath) {
      throw new BadRequestException('sqlitePath가 비어 있습니다.');
    }
    const sqlite = await import('node:sqlite');
    const database = new sqlite.DatabaseSync(config.sqlitePath);
    const sql = this.buildSelectQuery(
      `"${config.tableName}"`,
      config.idColumn,
      config.contentColumn,
      config.titleColumn,
      config.whereClause,
      limit,
    );
    const statement = database.prepare(sql);
    const rows = statement.all() as ExternalRow[];
    database.close();
    return rows;
  }

  private async listSqliteTables(sqlitePath: string): Promise<string[]> {
    const sqlite = (await this.dynamicImport('node:sqlite')) as {
      DatabaseSync: new (path: string) => {
        prepare: (sql: string) => { all: () => Array<{ name?: unknown }> };
        close: () => void;
      };
    };
    const database = new sqlite.DatabaseSync(sqlitePath);
    try {
      const rows = database
        .prepare(
          `SELECT name FROM sqlite_master
           WHERE type='table' AND name NOT LIKE 'sqlite_%'
           ORDER BY name`,
        )
        .all();
      return rows
        .map((row) => row.name)
        .filter((name): name is string => typeof name === 'string');
    } finally {
      database.close();
    }
  }

  private async listSqliteColumns(
    sqlitePath: string,
    tableName: string,
  ): Promise<string[]> {
    const sqlite = (await this.dynamicImport('node:sqlite')) as {
      DatabaseSync: new (path: string) => {
        prepare: (sql: string) => { all: () => Array<{ name?: unknown }> };
        close: () => void;
      };
    };
    const database = new sqlite.DatabaseSync(sqlitePath);
    const safeTable = this.ensureSafeIdentifier(tableName, 'tableName');
    try {
      const rows = database.prepare(`PRAGMA table_info("${safeTable}")`).all();
      return rows
        .map((row) => row.name)
        .filter((name): name is string => typeof name === 'string');
    } finally {
      database.close();
    }
  }

  private async listSqliteSampleRows(
    sqlitePath: string,
    tableName: string,
  ): Promise<ExternalRow[]> {
    const sqlite = (await this.dynamicImport('node:sqlite')) as {
      DatabaseSync: new (path: string) => {
        prepare: (sql: string) => { all: () => ExternalRow[] };
        close: () => void;
      };
    };
    const database = new sqlite.DatabaseSync(sqlitePath);
    const safeTable = this.ensureSafeIdentifier(tableName, 'tableName');
    try {
      return database.prepare(`SELECT * FROM "${safeTable}" LIMIT 10`).all();
    } finally {
      database.close();
    }
  }

  private buildSelectQuery(
    tableName: string,
    idColumn: string,
    contentColumn: string,
    titleColumn: string | undefined,
    whereClause: string | undefined,
    limit: number,
    useBackticks = false,
  ): string {
    const quote = (name: string) => {
      if (useBackticks) return `\`${name}\``;
      return `"${name}"`;
    };
    const columns = [
      `${quote(idColumn)} as id`,
      `${quote(contentColumn)} as content`,
      titleColumn ? `${quote(titleColumn)} as title` : `'external' as title`,
    ].join(', ');

    const where = whereClause?.trim() ? ` WHERE ${whereClause.trim()} ` : ' ';
    return `SELECT ${columns} FROM ${tableName}${where}ORDER BY ${quote(idColumn)} DESC LIMIT ${Math.max(1, Math.floor(limit))}`;
  }

  private async dynamicImport(moduleName: string): Promise<unknown> {
    return import(moduleName);
  }

  private async importAny(moduleNames: string[]): Promise<unknown> {
    let lastError: unknown = null;
    for (const moduleName of moduleNames) {
      try {
        return await this.dynamicImport(moduleName);
      } catch (error: unknown) {
        lastError = error;
      }
    }
    throw lastError ?? new Error(`Cannot import modules: ${moduleNames.join(', ')}`);
  }

  private async loadPgModule(): Promise<unknown> {
    try {
      return await this.importAny(['pg', 'pg/lib/index.js']);
    } catch {
      throw new BadRequestException(
        "PostgreSQL 드라이버를 찾을 수 없습니다. 'pnpm add pg' 후 서버를 재시작해 주세요.",
      );
    }
  }

  private async loadMySqlModule(): Promise<unknown> {
    try {
      return await this.importAny(['mysql2/promise', 'mysql2/promise.js']);
    } catch {
      throw new BadRequestException(
        "MySQL 드라이버를 찾을 수 없습니다. 'pnpm add mysql2' 후 서버를 재시작해 주세요.",
      );
    }
  }

  private ensureSafeIdentifier(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      throw new BadRequestException(
        `${fieldName}에는 영문/숫자/밑줄(_)만 사용할 수 있습니다.`,
      );
    }
    return trimmed;
  }

  private isKnowledgeConfigTableMissing(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const prismaError = error as { code?: unknown; meta?: unknown };
    if (prismaError.code !== 'P2021') return false;
    const meta =
      prismaError.meta && typeof prismaError.meta === 'object'
        ? (prismaError.meta as { modelName?: unknown })
        : null;
    return meta?.modelName === 'KnowledgeSourceConfig';
  }

  private throwSchemaNotReady(): never {
    throw new BadRequestException(
      [
        'KnowledgeSourceConfig 테이블이 아직 생성되지 않았습니다.',
        '백엔드에서 아래 명령으로 스키마를 반영해 주세요:',
        '- pnpm run db:push',
        '- (또는) pnpm run db:migrate',
      ].join('\n'),
    );
  }

  private async resolveSourceConfig(sourceId?: string) {
    return this.prisma.knowledgeSourceConfig
      .findFirst({
        where: sourceId ? { id: sourceId, isActive: true } : { isActive: true },
        orderBy: { updatedAt: 'desc' },
      })
      .catch((error: unknown) => {
        if (this.isKnowledgeConfigTableMissing(error)) {
          this.throwSchemaNotReady();
        }
        throw error;
      });
  }

  private rethrowExternalDbError(error: unknown): never {
    if (error instanceof BadRequestException) {
      throw error;
    }
    const errorLike =
      error && typeof error === 'object'
        ? (error as { code?: unknown; message?: unknown })
        : null;
    const code = typeof errorLike?.code === 'string' ? errorLike.code : '';
    const message =
      typeof errorLike?.message === 'string' ? errorLike.message : '외부 DB 연결 실패';

    if (code === '3D000') {
      throw new BadRequestException(`DB가 존재하지 않습니다: ${message}`);
    }
    if (code === '28P01') {
      throw new BadRequestException('DB 인증 실패: 사용자명/비밀번호를 확인해 주세요.');
    }
    if (code === 'ECONNREFUSED') {
      throw new BadRequestException('DB 연결 실패: host/port를 확인해 주세요.');
    }

    throw new BadRequestException(`외부 DB 오류: ${message}`);
  }
}

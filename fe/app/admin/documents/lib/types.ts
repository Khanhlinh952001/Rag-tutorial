export type DocumentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type ProcessingJob = {
  id: string;
  status: DocumentStatus;
  currentStep?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
};

export type DocumentItem = {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  status: DocumentStatus;
  totalChunks?: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { chunks: number };
  processingJobs?: ProcessingJob[];
};

export type DocumentChunkItem = {
  id: string;
  chunkIndex: number;
  content: string;
};

export type DocumentDetail = DocumentItem & {
  chunks?: DocumentChunkItem[];
};

export type DeleteTarget = {
  id: string;
  title: string;
};

export type KnowledgeDbType = "POSTGRES" | "MYSQL" | "SQLITE";

export type KnowledgeConfigForm = {
  sourceName: string;
  dbType: KnowledgeDbType;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  schema: string;
  sqlitePath: string;
  tableName: string;
  idColumn: string;
  contentColumn: string;
  titleColumn: string;
  whereClause: string;
};

export type KnowledgeSourceItem = {
  id: string;
  name: string;
  dbType: KnowledgeDbType;
  tableName: string;
  host?: string | null;
  port?: number | null;
  username?: string | null;
  database?: string | null;
  schema?: string | null;
  sqlitePath?: string | null;
};

export type KnowledgeDiscoverResponse = {
  tables?: string[];
  columns?: string[];
  sampleRows?: Array<Record<string, unknown>>;
};

export type KnowledgeSyncSummary = {
  sourceId: string;
  tableCount: number;
  indexed: number;
  syncedAt: string;
};

export type DiscoverPageRow = {
  url: string;
  pageTitle: string | null;
  hasText: boolean;
  charCount: number;
  textPreview: string;
};

export type DiscoverWebResponse = {
  seedUrl: string;
  hostname: string;
  pages: DiscoverPageRow[];
  maxFetches: number;
  stoppedEarly: boolean;
};

export type FilterKey = "ALL" | DocumentStatus;

"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  useState,
} from "react";
import { Database, Globe, ImagePlus, Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { DocumentCard } from "./document-card";
import { DocumentListEmptyState } from "./document-list-empty";
import { DocumentDeleteAlert } from "./document-delete-alert";
import { KnowledgeDialog } from "./knowledge-dialog";
import { KnowledgeDeleteAlert } from "./knowledge-delete-alert";
import { KnowledgeSourceCard } from "./knowledge-source-card";
import { OcrPreviewDialog } from "./ocr-preview-dialog";
import { UploadDocumentDialog } from "./upload-document-dialog";
import { WebScanDialog } from "./web-scan-dialog";
import {
  API_BASE,
  FILTER_LABELS,
  INITIAL_KNOWLEDGE_CONFIG,
  KNOWLEDGE_SUMMARY_STORAGE_KEY,
  SHOW_WEB_DEV_PANEL,
} from "./lib/constants";
import type {
  DeleteTarget,
  DiscoverWebResponse,
  DocumentItem,
  DocumentDetail,
  FilterKey,
  KnowledgeConfigForm,
  KnowledgeDbType,
  KnowledgeDiscoverResponse,
  KnowledgeSourceItem,
  KnowledgeSyncSummary,
} from "./lib/types";

export default function AdminDocumentsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [isDragging, setIsDragging] = useState(false);
  const [webUrl, setWebUrl] = useState("");
  const [webTitle, setWebTitle] = useState("");
  const [webIngesting, setWebIngesting] = useState(false);
  const [devWebUrl, setDevWebUrl] = useState("");
  const [devWebTitle, setDevWebTitle] = useState("");
  const [discoverMaxPages, setDiscoverMaxPages] = useState("");
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverResult, setDiscoverResult] = useState<DiscoverWebResponse | null>(
    null,
  );
  const [selectedPageUrls, setSelectedPageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const [webPreviewError, setWebPreviewError] = useState<string | null>(null);
  const [webConfirmLoading, setWebConfirmLoading] = useState(false);
  const [isWebPreviewDialogOpen, setIsWebPreviewDialogOpen] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isKnowledgeDeleteDialogOpen, setIsKnowledgeDeleteDialogOpen] =
    useState(false);
  const [deletingKnowledge, setDeletingKnowledge] = useState(false);
  const [retrainingKnowledge, setRetrainingKnowledge] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSourceItem[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [knowledgeConfig, setKnowledgeConfig] = useState<KnowledgeConfigForm>(
    INITIAL_KNOWLEDGE_CONFIG,
  );
  const [knowledgeSaving, setKnowledgeSaving] = useState(false);
  const [knowledgeTesting, setKnowledgeTesting] = useState(false);
  const [knowledgeDiscovering, setKnowledgeDiscovering] = useState(false);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [tablePreviewRows, setTablePreviewRows] = useState<
    Array<Record<string, unknown>>
  >([]);
  const [knowledgeSyncSummary, setKnowledgeSyncSummary] =
    useState<KnowledgeSyncSummary | null>(null);
  const [isKnowledgeDialogOpen, setIsKnowledgeDialogOpen] = useState(false);
  const [isOcrPreviewDialogOpen, setIsOcrPreviewDialogOpen] = useState(false);
  const [ocrPreviewLoading, setOcrPreviewLoading] = useState(false);
  const [ocrPreviewDocId, setOcrPreviewDocId] = useState<string | null>(null);
  const [ocrPreviewTitle, setOcrPreviewTitle] = useState("");
  const [ocrPreviewContent, setOcrPreviewContent] = useState("");
  const [ocrPreviewError, setOcrPreviewError] = useState<string | null>(null);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const loadDocuments = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      setError("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const response = await fetch(`${API_BASE}/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (response.ok && Array.isArray(data)) {
        setDocuments(data as DocumentItem[]);
      } else {
        const serverMessage =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "서버 오류";
        setError(
          `문서 목록 불러오기 실패 (HTTP ${response.status}): ${serverMessage}`,
        );
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.",
      );
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const loadKnowledgeConfig = useCallback(async () => {
    const token = localStorage.getItem("admin_access_token");
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/admin/knowledge-source/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const serverMessage =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "설정을 불러오지 못했습니다.";
        toast.error(serverMessage);
        return;
      }
      if (!Array.isArray(data)) {
        setKnowledgeSources([]);
        return;
      }
      const sources = data.filter((item): item is Record<string, unknown> => {
        return item != null && typeof item === "object";
      });
      setKnowledgeSources(
        sources.map((parsed) => ({
          id: typeof parsed.id === "string" ? parsed.id : "",
          name: typeof parsed.name === "string" ? parsed.name : "",
          dbType:
            parsed.dbType === "MYSQL" || parsed.dbType === "SQLITE"
              ? (parsed.dbType as KnowledgeDbType)
              : "POSTGRES",
          tableName: typeof parsed.tableName === "string" ? parsed.tableName : "",
          host: typeof parsed.host === "string" ? parsed.host : null,
          port: typeof parsed.port === "number" ? parsed.port : null,
          username: typeof parsed.username === "string" ? parsed.username : null,
          database: typeof parsed.database === "string" ? parsed.database : null,
          schema: typeof parsed.schema === "string" ? parsed.schema : null,
          sqlitePath: typeof parsed.sqlitePath === "string" ? parsed.sqlitePath : null,
        })),
      );
      if (!activeSourceId) {
        setKnowledgeConfig(INITIAL_KNOWLEDGE_CONFIG);
        setAvailableTables([]);
        setSelectedTables([]);
        setTablePreviewRows([]);
        return;
      }
      const parsed = sources.find((item) => item.id === activeSourceId) ?? null;
      if (!parsed) {
        setActiveSourceId(null);
        setKnowledgeConfig(INITIAL_KNOWLEDGE_CONFIG);
        setSelectedTables([]);
        return;
      }
      setActiveSourceId(typeof parsed.id === "string" ? parsed.id : null);
      setKnowledgeConfig({
        sourceName: typeof parsed.name === "string" ? parsed.name : "",
        dbType:
          parsed.dbType === "MYSQL" || parsed.dbType === "SQLITE"
            ? (parsed.dbType as KnowledgeDbType)
            : "POSTGRES",
        host: typeof parsed.host === "string" ? parsed.host : "",
        port:
          typeof parsed.port === "number" && Number.isFinite(parsed.port)
            ? String(parsed.port)
            : parsed.dbType === "MYSQL"
              ? "3306"
              : "5432",
        username: typeof parsed.username === "string" ? parsed.username : "",
        password: "",
        database: typeof parsed.database === "string" ? parsed.database : "",
        schema: typeof parsed.schema === "string" ? parsed.schema : "public",
        sqlitePath:
          typeof parsed.sqlitePath === "string" ? parsed.sqlitePath : "",
        tableName: typeof parsed.tableName === "string" ? parsed.tableName : "",
        idColumn: typeof parsed.idColumn === "string" ? parsed.idColumn : "id",
        contentColumn:
          typeof parsed.contentColumn === "string"
            ? parsed.contentColumn
            : "content",
        titleColumn:
          typeof parsed.titleColumn === "string" ? parsed.titleColumn : "title",
        whereClause:
          typeof parsed.whereClause === "string" ? parsed.whereClause : "",
      });
      setAvailableTables([]);
      setSelectedTables(
        typeof parsed.tableName === "string" && parsed.tableName.trim().length > 0
          ? parsed.tableName
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "지식 소스 설정을 불러오는 중 오류가 발생했습니다.",
      );
    } finally {
      // no-op
    }
  }, [activeSourceId]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDocuments();
      void loadKnowledgeConfig();
    });
  }, [loadDocuments, loadKnowledgeConfig]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(KNOWLEDGE_SUMMARY_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as KnowledgeSyncSummary;
      if (
        parsed &&
        typeof parsed.sourceId === "string" &&
        typeof parsed.tableCount === "number" &&
        typeof parsed.indexed === "number" &&
        typeof parsed.syncedAt === "string"
      ) {
        queueMicrotask(() => setKnowledgeSyncSummary(parsed));
      }
    } catch {
      // ignore invalid stored state
    }
  }, []);

  // Auto-refresh while there are PROCESSING / PENDING documents to track learning progress.
  useEffect(() => {
    const hasInFlight = documents.some(
      (d) => d.status === "PROCESSING" || d.status === "PENDING",
    );
    if (!hasInFlight) return;
    const id = window.setInterval(() => {
      void loadDocuments({ silent: true });
    }, 4000);
    return () => window.clearInterval(id);
  }, [documents, loadDocuments]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    setSelectedFiles(list?.length ? Array.from(list) : []);
    setInfo(null);
    setError(null);
  }

  function pickFilesFromList(list: FileList | null): File[] {
    if (!list?.length) return [];
    return Array.from(list);
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setIsDragging(false);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = pickFilesFromList(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setInfo(null);
      setError(null);
    }
  }

  function clearSelectedFile() {
    setSelectedFiles([]);
    setInfo(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function closeUploadDialog() {
    if (uploading || webIngesting) return;
    setIsUploadDialogOpen(false);
    setIsDragging(false);
    setSelectedFiles([]);
    setWebUrl("");
    setWebTitle("");
    setError(null);
    setInfo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onIngestWeb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = webUrl.trim();
    if (!trimmedUrl) {
      setError("URL을 입력하세요.");
      return;
    }
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      setError("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setWebIngesting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await fetch(`${API_BASE}/documents/from-web`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: trimmedUrl,
          title: webTitle.trim() || undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        title?: string;
        totalChunks?: number;
        url?: string;
      };

      if (!response.ok) {
        const message =
          typeof data.message === "string"
            ? data.message
            : "URL 인덱싱에 실패했습니다.";
        setError(message);
        return;
      }

      const label =
        typeof data.title === "string" && data.title.length > 0
          ? data.title
          : trimmedUrl;
      const chunks =
        typeof data.totalChunks === "number" ? data.totalChunks : 0;
      setInfo(`웹 페이지 학습 완료: ${label} (${chunks} 청크)`);
      setWebUrl("");
      setWebTitle("");
      setIsUploadDialogOpen(false);
      void loadDocuments({ silent: true });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.",
      );
    } finally {
      setWebIngesting(false);
    }
  }

  function parseApiMessage(data: unknown): string {
    if (!data || typeof data !== "object") return "요청에 실패했습니다.";
    const d = data as { message?: unknown };
    if (typeof d.message === "string") return d.message;
    if (Array.isArray(d.message)) {
      const first = d.message[0];
      if (typeof first === "string") return first;
    }
    return "요청에 실패했습니다.";
  }

  async function runSiteDiscover() {
    const trimmed = devWebUrl.trim();
    if (!trimmed) {
      setWebPreviewError("URL을 입력하세요.");
      return;
    }
    if (discoverMaxPages.trim()) {
      const n = Number(discoverMaxPages);
      if (!Number.isFinite(n) || n < 1 || n > 2000) {
        setWebPreviewError("최대 페이지(스캔)는 1~2000 사이 숫자여야 합니다.");
        return;
      }
    }
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      setWebPreviewError("로그인 세션이 없습니다.");
      return;
    }
    setDiscoverLoading(true);
    setWebPreviewError(null);
    setDiscoverResult(null);
    setSelectedPageUrls(new Set());
    try {
      const maxPagesPayload = discoverMaxPages.trim()
        ? Math.min(2000, Math.max(1, Math.floor(Number(discoverMaxPages))))
        : undefined;
      const response = await fetch(`${API_BASE}/documents/discover-web`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: trimmed,
          ...(maxPagesPayload != null ? { maxPages: maxPagesPayload } : {}),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setWebPreviewError(parseApiMessage(data));
        return;
      }
      const parsed = data as DiscoverWebResponse;
      if (!parsed.pages?.length) {
        setWebPreviewError("발견된 페이지가 없습니다.");
        return;
      }
      setDiscoverResult(parsed);
      const allUrls = new Set(
        parsed.pages.filter((p) => p.hasText).map((p) => p.url),
      );
      if (allUrls.size === 0) {
        setWebPreviewError(
          "텍스트가 있는 페이지가 없습니다. 목록에서 확인해 주세요.",
        );
        setSelectedPageUrls(new Set(parsed.pages.map((p) => p.url)));
      } else {
        setSelectedPageUrls(allUrls);
      }
      setDevWebTitle((prev) =>
        prev.trim().length > 0 ? prev : parsed.hostname ?? "",
      );
    } catch (e) {
      setWebPreviewError(
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.",
      );
    } finally {
      setDiscoverLoading(false);
    }
  }

  function togglePageSelected(url: string, checked: boolean) {
    setSelectedPageUrls((prev) => {
      const next = new Set(prev);
      if (checked) next.add(url);
      else next.delete(url);
      return next;
    });
  }

  function selectAllDiscoveredPages() {
    if (!discoverResult) return;
    setSelectedPageUrls(new Set(discoverResult.pages.map((p) => p.url)));
  }

  function clearAllDiscoveredPages() {
    setSelectedPageUrls(new Set());
  }

  async function confirmDevWebIngest() {
    const trimmedUrl = devWebUrl.trim();
    if (!trimmedUrl) {
      setWebPreviewError("URL을 입력하세요.");
      return;
    }
    if (!discoverResult) {
      setWebPreviewError("먼저「페이지 스캔」으로 사이트에서 페이지 목록을 불러오세요.");
      return;
    }
    const selected = [...selectedPageUrls];
    if (selected.length === 0) {
      setWebPreviewError("학습할 페이지를 하나 이상 선택하세요.");
      return;
    }
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      setWebPreviewError("로그인 세션이 없습니다.");
      return;
    }
    setWebConfirmLoading(true);
    setWebPreviewError(null);
    setError(null);
    setInfo(null);
    try {
      const response = await fetch(`${API_BASE}/documents/from-web`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: trimmedUrl,
          title: devWebTitle.trim() || undefined,
          selectedUrls: selected,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setWebPreviewError(parseApiMessage(data));
        return;
      }
      const label =
        typeof (data as { title?: string }).title === "string"
          ? (data as { title: string }).title
          : trimmedUrl;
      const chunks =
        typeof (data as { totalChunks?: number }).totalChunks === "number"
          ? (data as { totalChunks: number }).totalChunks
          : 0;
      const pagesIndexed = (data as { pagesIndexed?: number }).pagesIndexed;
      const mode = (data as { mode?: string }).mode;
      setInfo(
        mode === "selected" && typeof pagesIndexed === "number"
          ? `선택 페이지 학습 완료: ${label} (${pagesIndexed}페이지, ${chunks} 청크)`
          : `웹 학습 완료: ${label} (${chunks} 청크)`,
      );
      setDiscoverResult(null);
      setSelectedPageUrls(new Set());
      setDevWebUrl("");
      setDevWebTitle("");
      setDiscoverMaxPages("");
      setIsWebPreviewDialogOpen(false);
      void loadDocuments({ silent: true });
    } catch (e) {
      setWebPreviewError(
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.",
      );
    } finally {
      setWebConfirmLoading(false);
    }
  }

  function openWebPreviewDialog() {
    setWebPreviewError(null);
    setDiscoverResult(null);
    setSelectedPageUrls(new Set());
    setDiscoverMaxPages("");
    setIsWebPreviewDialogOpen(true);
  }

  function closeWebPreviewDialog() {
    if (discoverLoading || webConfirmLoading) return;
    setIsWebPreviewDialogOpen(false);
    setDevWebUrl("");
    setDevWebTitle("");
    setDiscoverMaxPages("");
    setDiscoverResult(null);
    setSelectedPageUrls(new Set());
    setWebPreviewError(null);
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const maxBatch = 30;
    if (selectedFiles.length === 0) {
      setError("업로드할 파일을 선택하세요.");
      return;
    }
    if (selectedFiles.length > maxBatch) {
      setError(`한 번에 최대 ${maxBatch}개까지 업로드할 수 있습니다.`);
      return;
    }
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      setError("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setUploading(true);
    setError(null);
    setInfo(null);

    try {
      const formData = new FormData();
      for (const f of selectedFiles) {
        formData.append("files", f);
      }

      const response = await fetch(`${API_BASE}/uploads/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          typeof (data as { message?: unknown })?.message === "string"
            ? (data as { message: string }).message
            : "업로드에 실패했습니다.";
        setError(message);
        return;
      }

      const count = selectedFiles.length;
      setInfo(
        count > 1
          ? `업로드 완료: ${count}개 파일. AI 학습용으로 처리 중입니다.`
          : `업로드 완료: ${selectedFiles[0]?.name ?? ""}. AI 학습용으로 처리 중입니다.`,
      );
      setSelectedFiles([]);
      setIsUploadDialogOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void loadDocuments({ silent: true });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function openOcrPreview(doc: DocumentItem) {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      setError("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setIsOcrPreviewDialogOpen(true);
    setOcrPreviewLoading(true);
    setOcrPreviewDocId(doc.id);
    setOcrPreviewTitle(doc.title);
    setOcrPreviewContent("");
    setOcrPreviewError(null);

    try {
      const response = await fetch(`${API_BASE}/documents/${doc.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as DocumentDetail | null;
      if (!response.ok || !data) {
        const message =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "OCR 내용을 불러오지 못했습니다.";
        setOcrPreviewError(message);
        return;
      }

      const chunks = Array.isArray(data.chunks) ? data.chunks : [];
      const content = chunks
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map((chunk) => chunk.content?.trim() ?? "")
        .filter((chunk) => chunk.length > 0)
        .join("\n\n");

      setOcrPreviewTitle(data.title ?? doc.title);
      setOcrPreviewContent(content);
      if (!content) {
        setOcrPreviewError("추출된 텍스트가 비어 있습니다.");
      }
    } catch (e) {
      setOcrPreviewError(
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.",
      );
    } finally {
      setOcrPreviewLoading(false);
    }
  }

  async function deleteDocument(id: string) {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      setError("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }

    setDeleteTarget(null);
    setDeleting(true);
    setError(null);
    setInfo(null);

    let previousDocs: DocumentItem[] = [];
    setDocuments((prev) => {
      previousDocs = prev;
      return prev.filter((d) => d.id !== id);
    });

    try {
      const response = await fetch(`${API_BASE}/documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setDocuments(previousDocs);
        setError("삭제에 실패했습니다.");
        return;
      }
      setInfo("문서가 삭제되었습니다.");
      void loadDocuments({ silent: true });
    } catch (e) {
      setDocuments(previousDocs);
      setError(
        e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function deleteKnowledgeSource(sourceId: string | null) {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      toast.error("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setDeletingKnowledge(true);
    try {
      if (!sourceId) {
        toast.error("삭제할 DB 소스를 먼저 선택해 주세요.");
        return;
      }
      const response = await fetch(
        `${API_BASE}/admin/knowledge-source/config/${sourceId}`,
        {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "DB 소스 삭제에 실패했습니다.";
        toast.error(message);
        return;
      }

      setKnowledgeSources((prev) => prev.filter((source) => source.id !== sourceId));
      setSelectedTables([]);
      setTablePreviewRows([]);
      setActiveSourceId(null);
      setKnowledgeSyncSummary(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(KNOWLEDGE_SUMMARY_STORAGE_KEY);
      }
      setKnowledgeConfig(INITIAL_KNOWLEDGE_CONFIG);
      toast.success("DB 소스를 삭제했습니다.");
      await loadKnowledgeConfig();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "DB 소스 삭제 중 오류가 발생했습니다.",
      );
    } finally {
      setDeletingKnowledge(false);
      setIsKnowledgeDeleteDialogOpen(false);
    }
  }

  function updateKnowledgeField<K extends keyof KnowledgeConfigForm>(
    key: K,
    value: KnowledgeConfigForm[K],
  ) {
    setKnowledgeConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveKnowledgeConfig() {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      toast.error("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setKnowledgeSaving(true);
    try {
      const response = await fetch(`${API_BASE}/admin/knowledge-source/config`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dbType: knowledgeConfig.dbType,
          sourceName: knowledgeConfig.sourceName || undefined,
          host: knowledgeConfig.host || undefined,
          port: knowledgeConfig.port ? Number(knowledgeConfig.port) : undefined,
          username: knowledgeConfig.username || undefined,
          password: knowledgeConfig.password || undefined,
          database: knowledgeConfig.database || undefined,
          schema: knowledgeConfig.schema || undefined,
          sqlitePath: knowledgeConfig.sqlitePath || undefined,
          tableName:
            selectedTables.length > 0
              ? selectedTables.join(",")
              : knowledgeConfig.tableName,
          idColumn: knowledgeConfig.idColumn || "id",
          contentColumn: knowledgeConfig.contentColumn || "content",
          titleColumn: knowledgeConfig.titleColumn || undefined,
          whereClause: knowledgeConfig.whereClause || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const serverMessage =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "설정 저장에 실패했습니다.";
        toast.error(serverMessage);
        return;
      }
      toast.success("설정을 저장했습니다. 학습 동기화를 시작합니다.");

      const syncResponse = await fetch(`${API_BASE}/admin/knowledge-source/sync`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sourceId: activeSourceId ?? undefined, limit: 500 }),
      });
      const syncData = await syncResponse.json().catch(() => null);
      if (!syncResponse.ok) {
        const syncMessage =
          syncData &&
          typeof syncData === "object" &&
          "message" in syncData &&
          typeof (syncData as { message?: unknown }).message === "string"
            ? (syncData as { message: string }).message
            : "동기화에 실패했습니다.";
        toast.error(syncMessage);
        return;
      }

      const indexed =
        syncData &&
        typeof syncData === "object" &&
        "indexed" in syncData &&
        typeof (syncData as { indexed?: unknown }).indexed === "number"
          ? (syncData as { indexed: number }).indexed
          : 0;
      const tableCount =
        syncData &&
        typeof syncData === "object" &&
        "syncedTables" in syncData &&
        Array.isArray((syncData as { syncedTables?: unknown }).syncedTables)
          ? ((syncData as { syncedTables: unknown[] }).syncedTables.length ?? 0)
          : selectedTables.length;

      toast.success(`학습 완료: ${tableCount}개 테이블, ${indexed}개 청크`);
      const nextSummary = {
        sourceId: activeSourceId ?? "",
        tableCount,
        indexed,
        syncedAt: new Date().toISOString(),
      };
      setKnowledgeSyncSummary(nextSummary);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          KNOWLEDGE_SUMMARY_STORAGE_KEY,
          JSON.stringify(nextSummary),
        );
      }
      setKnowledgeConfig((prev) => ({ ...prev, password: "" }));
      setIsKnowledgeDialogOpen(false);
      void loadKnowledgeConfig();
      void loadDocuments({ silent: true });
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "설정 저장 중 네트워크 오류가 발생했습니다.",
      );
    } finally {
      setKnowledgeSaving(false);
    }
  }

  async function retrainKnowledgeSource(sourceId: string) {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      toast.error("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setRetrainingKnowledge(true);
    try {
      const syncResponse = await fetch(`${API_BASE}/admin/knowledge-source/sync`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sourceId, limit: 500 }),
      });
      const syncData = await syncResponse.json().catch(() => null);
      if (!syncResponse.ok) {
        const syncMessage =
          syncData &&
          typeof syncData === "object" &&
          "message" in syncData &&
          typeof (syncData as { message?: unknown }).message === "string"
            ? (syncData as { message: string }).message
            : "재학습에 실패했습니다.";
        toast.error(syncMessage);
        return;
      }

      const indexed =
        syncData &&
        typeof syncData === "object" &&
        "indexed" in syncData &&
        typeof (syncData as { indexed?: unknown }).indexed === "number"
          ? (syncData as { indexed: number }).indexed
          : 0;
      const tableCount =
        syncData &&
        typeof syncData === "object" &&
        "syncedTables" in syncData &&
        Array.isArray((syncData as { syncedTables?: unknown }).syncedTables)
          ? ((syncData as { syncedTables: unknown[] }).syncedTables.length ?? 0)
          : selectedTables.length;

      const nextSummary = {
        sourceId,
        tableCount,
        indexed,
        syncedAt: new Date().toISOString(),
      };
      setKnowledgeSyncSummary(nextSummary);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          KNOWLEDGE_SUMMARY_STORAGE_KEY,
          JSON.stringify(nextSummary),
        );
      }
      toast.success(`재학습 완료: ${tableCount}개 테이블, ${indexed}개 청크`);
      void loadDocuments({ silent: true });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "재학습 중 네트워크 오류가 발생했습니다.",
      );
    } finally {
      setRetrainingKnowledge(false);
    }
  }

  async function testKnowledgeConnection() {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      toast.error("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setKnowledgeTesting(true);
    try {
      await discoverTables();
      toast.success("연결 성공. 학습할 테이블을 선택한 뒤 완료를 누르세요.");
    } finally {
      setKnowledgeTesting(false);
    }
  }

  async function discoverTables() {
    const token = localStorage.getItem("admin_access_token");
    if (!token) {
      toast.error("로그인 세션이 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setKnowledgeDiscovering(true);
    try {
      const response = await fetch(`${API_BASE}/admin/knowledge-source/discover`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dbType: knowledgeConfig.dbType,
          host: knowledgeConfig.host || undefined,
          port: knowledgeConfig.port ? Number(knowledgeConfig.port) : undefined,
          username: knowledgeConfig.username || undefined,
          password: knowledgeConfig.password || undefined,
          database: knowledgeConfig.database || undefined,
          schema: knowledgeConfig.schema || undefined,
          sqlitePath: knowledgeConfig.sqlitePath || undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | KnowledgeDiscoverResponse
        | null;
      if (!response.ok) {
        const serverMessage =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "테이블 조회에 실패했습니다.";
        toast.error(serverMessage);
        return;
      }

      const tables = Array.isArray(data?.tables)
        ? data.tables.filter((v): v is string => typeof v === "string")
        : [];
      setAvailableTables(tables);
      setTablePreviewRows([]);

      if (tables.length === 0) {
        toast.error("조회 가능한 테이블이 없습니다.");
        return;
      }

      if (!tables.includes(knowledgeConfig.tableName)) {
        updateKnowledgeField("tableName", tables[0]);
        await discoverColumns(tables[0]);
      } else {
        await discoverColumns(knowledgeConfig.tableName);
      }
      setSelectedTables((prev) => {
        if (prev.length === 0) return tables.length > 0 ? [tables[0]] : [];
        return prev.filter((table) => tables.includes(table));
      });
      toast.success(`테이블 ${tables.length}개를 불러왔습니다.`);
    } catch (e) {
      toast.error(
          e instanceof Error ? e.message : "테이블 조회 중 오류가 발생했습니다.",
      );
    } finally {
      setKnowledgeDiscovering(false);
    }
  }

  async function discoverColumns(tableName: string) {
    const token = localStorage.getItem("admin_access_token");
    if (!token || !tableName) return;
    try {
      const response = await fetch(`${API_BASE}/admin/knowledge-source/discover`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dbType: knowledgeConfig.dbType,
          host: knowledgeConfig.host || undefined,
          port: knowledgeConfig.port ? Number(knowledgeConfig.port) : undefined,
          username: knowledgeConfig.username || undefined,
          password: knowledgeConfig.password || undefined,
          database: knowledgeConfig.database || undefined,
          schema: knowledgeConfig.schema || undefined,
          sqlitePath: knowledgeConfig.sqlitePath || undefined,
          tableName,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | KnowledgeDiscoverResponse
        | null;
      if (!response.ok) {
        const serverMessage =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message?: unknown }).message === "string"
            ? (data as { message: string }).message
            : "컬럼 조회에 실패했습니다.";
        toast.error(serverMessage);
        return;
      }
      const sampleRows = Array.isArray(data?.sampleRows)
        ? data.sampleRows.filter(
            (row): row is Record<string, unknown> =>
              typeof row === "object" && row !== null,
          )
        : [];
      setTablePreviewRows(sampleRows);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "컬럼 조회 중 오류가 발생했습니다.",
      );
    } finally {
      // no-op
    }
  }

  const counts = useMemo(() => {
    return documents.reduce(
      (acc, doc) => {
        acc.ALL += 1;
        acc[doc.status] += 1;
        return acc;
      },
      { ALL: 0, PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 } as Record<
        FilterKey,
        number
      >,
    );
  }, [documents]);

  const visibleDocs = useMemo(
    () =>
      filter === "ALL"
        ? documents
        : documents.filter((d) => d.status === filter),
    [documents, filter],
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">문서 관리</h1>
        <p className="text-sm text-muted-foreground">
          AI가 학습할 문서를 업로드하고, 어떤 자료가 학습되었는지 한눈에
          확인하세요.
        </p>
      </header>
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => {
              const isActive = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  )}
                >
                  {FILTER_LABELS[key]}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] tabular-nums",
                      isActive
                        ? "bg-background/20"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[key]}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setActiveSourceId(null);
                setKnowledgeConfig(INITIAL_KNOWLEDGE_CONFIG);
                setAvailableTables([]);
                setSelectedTables([]);
                setTablePreviewRows([]);
                setIsKnowledgeDialogOpen(true);
              }}
            >
              <Database className="h-3.5 w-3.5" /> DB 소스 추가
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setError(null);
                setInfo(null);
                setSelectedFiles([]);
                setWebUrl("");
                setWebTitle("");
                setIsUploadDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              추가
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setError(null);
                setInfo("OCR 학습용 이미지를 선택하세요. (Ctrl/Cmd로 여러 장 선택 가능)");
                setSelectedFiles([]);
                setWebUrl("");
                setWebTitle("");
                setIsUploadDialogOpen(true);
                window.setTimeout(() => {
                  fileInputRef.current?.click();
                }, 0);
              }}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              이미지 OCR 추가
            </Button>
            {SHOW_WEB_DEV_PANEL ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => openWebPreviewDialog()}
              >
                <Globe className="h-3.5 w-3.5" />
                웹 미리보기
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDocuments()}
              disabled={loading}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              새로고침
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {knowledgeSources.map((source) => (
              <KnowledgeSourceCard
                key={source.id}
                sourceName={source.name || "default"}
                dbType={source.dbType}
                knowledgeSyncSummary={
                  knowledgeSyncSummary?.sourceId === source.id
                    ? knowledgeSyncSummary
                    : null
                }
                retraining={retrainingKnowledge}
                onOpenConfig={() => {
                  setActiveSourceId(source.id);
                  setKnowledgeConfig({
                    sourceName: source.name ?? "",
                    dbType: source.dbType,
                    host: source.host ?? "",
                    port:
                      typeof source.port === "number"
                        ? String(source.port)
                        : source.dbType === "MYSQL"
                          ? "3306"
                          : "5432",
                    username: source.username ?? "",
                    password: "",
                    database: source.database ?? "",
                    schema: source.schema ?? "public",
                    sqlitePath: source.sqlitePath ?? "",
                    tableName: source.tableName ?? "",
                    idColumn: "id",
                    contentColumn: "content",
                    titleColumn: "title",
                    whereClause: "",
                  });
                  setSelectedTables(
                    (source.tableName ?? "")
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  );
                  setIsKnowledgeDialogOpen(true);
                }}
                onRetrain={() => {
                  void retrainKnowledgeSource(source.id);
                }}
                onDelete={() => {
                  setActiveSourceId(source.id);
                  setIsKnowledgeDeleteDialogOpen(true);
                }}
              />
            ))}
            {visibleDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isHydrated={isHydrated}
                ocrPreviewLoading={ocrPreviewLoading && ocrPreviewDocId === doc.id}
                onPreviewOcr={
                  doc.mimeType.startsWith("image/")
                    ? () => {
                        void openOcrPreview(doc);
                      }
                    : undefined
                }
                onDelete={() => setDeleteTarget({ id: doc.id, title: doc.title })}
              />
            ))}
          </div>
          {visibleDocs.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed bg-muted/25 px-4">
              <DocumentListEmptyState filter={filter} loading={loading} />
            </div>
          ) : null}
        </div>
      </section>
      {isUploadDialogOpen ? (
        <UploadDocumentDialog
          fileInputRef={fileInputRef}
          uploading={uploading}
          webIngesting={webIngesting}
          isDragging={isDragging}
          selectedFiles={selectedFiles}
          webUrl={webUrl}
          webTitle={webTitle}
          error={error}
          info={info}
          showWebDevPanel={SHOW_WEB_DEV_PANEL}
          onClose={closeUploadDialog}
          onUpload={onUpload}
          onIngestWeb={onIngestWeb}
          onFileChange={onFileChange}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          openFilePicker={openFilePicker}
          clearSelectedFile={clearSelectedFile}
          setWebUrl={setWebUrl}
          setWebTitle={setWebTitle}
        />
      ) : null}

      {isWebPreviewDialogOpen ? (
        <WebScanDialog
          discoverLoading={discoverLoading}
          webConfirmLoading={webConfirmLoading}
          devWebUrl={devWebUrl}
          setDevWebUrl={(v) => {
            setDevWebUrl(v);
            setDiscoverResult(null);
            setSelectedPageUrls(new Set());
          }}
          devWebTitle={devWebTitle}
          setDevWebTitle={setDevWebTitle}
          discoverMaxPages={discoverMaxPages}
          setDiscoverMaxPages={setDiscoverMaxPages}
          discoverResult={discoverResult}
          selectedPageUrls={selectedPageUrls}
          webPreviewError={webPreviewError}
          onClose={closeWebPreviewDialog}
          onRunDiscover={() => void runSiteDiscover()}
          onSelectAll={selectAllDiscoveredPages}
          onClearAll={clearAllDiscoveredPages}
          onConfirmIngest={() => void confirmDevWebIngest()}
          onTogglePage={togglePageSelected}
        />
      ) : null}

      <OcrPreviewDialog
        open={isOcrPreviewDialogOpen}
        loading={ocrPreviewLoading}
        title={ocrPreviewTitle}
        content={ocrPreviewContent}
        error={ocrPreviewError}
        onOpenChange={(open) => {
          setIsOcrPreviewDialogOpen(open);
          if (!open && !ocrPreviewLoading) {
            setOcrPreviewDocId(null);
            setOcrPreviewTitle("");
            setOcrPreviewContent("");
            setOcrPreviewError(null);
          }
        }}
      />

      <DocumentDeleteAlert
        deleteTarget={deleteTarget}
        deleting={deleting}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        onConfirmDelete={() => {
          if (!deleteTarget) return;
          void deleteDocument(deleteTarget.id);
        }}
      />

      <KnowledgeDeleteAlert
        open={isKnowledgeDeleteDialogOpen}
        deleting={deletingKnowledge}
        onOpenChange={(open) => {
          if (!open && !deletingKnowledge) setIsKnowledgeDeleteDialogOpen(false);
        }}
        onConfirmDelete={() => {
          void deleteKnowledgeSource(activeSourceId);
        }}
      />

      {isKnowledgeDialogOpen ? (
        <KnowledgeDialog
          knowledgeConfig={knowledgeConfig}
          availableTables={availableTables}
          selectedTables={selectedTables}
          tablePreviewRows={tablePreviewRows}
          knowledgeSaving={knowledgeSaving}
          knowledgeTesting={knowledgeTesting}
          knowledgeDiscovering={knowledgeDiscovering}
          onClose={() => setIsKnowledgeDialogOpen(false)}
          updateKnowledgeField={updateKnowledgeField}
          onTableToggle={(table) => {
            updateKnowledgeField("tableName", table);
            void discoverColumns(table);
            setSelectedTables((prev) =>
              prev.includes(table)
                ? prev.filter((name) => name !== table)
                : [...prev, table],
            );
          }}
          onTestConnection={() => void testKnowledgeConnection()}
          onSave={() => void saveKnowledgeConfig()}
        />
      ) : null}
    </div>
  );
}


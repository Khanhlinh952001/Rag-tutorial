"use client";

import { Database, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { stringifyPreviewCell } from "./lib/format";
import type { KnowledgeConfigForm, KnowledgeDbType } from "./lib/types";

export type KnowledgeDialogProps = {
  knowledgeConfig: KnowledgeConfigForm;
  availableTables: string[];
  selectedTables: string[];
  tablePreviewRows: Array<Record<string, unknown>>;
  knowledgeSaving: boolean;
  knowledgeTesting: boolean;
  knowledgeDiscovering: boolean;
  onClose: () => void;
  updateKnowledgeField: <K extends keyof KnowledgeConfigForm>(
    key: K,
    value: KnowledgeConfigForm[K],
  ) => void;
  onTableToggle: (table: string) => void;
  onTestConnection: () => void;
  onSave: () => void;
};

export function KnowledgeDialog({
  knowledgeConfig,
  availableTables,
  selectedTables,
  tablePreviewRows,
  knowledgeSaving,
  knowledgeTesting,
  knowledgeDiscovering,
  onClose,
  updateKnowledgeField,
  onTableToggle,
  onTestConnection,
  onSave,
}: KnowledgeDialogProps) {
  const busy = knowledgeSaving || knowledgeTesting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Knowledge Source 설정"
    >
      <button
        type="button"
        className="absolute inset-0 bg-background/60 backdrop-blur-[1px]"
        aria-label="닫기"
        onClick={() => {
          if (busy) return;
          onClose();
        }}
        disabled={busy}
      />
      <section className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Knowledge Source 설정</h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          관리자에서 외부 DB(Postgres/MySQL/SQLite) 연결 정보를 저장하고 테스트 및
          동기화를 실행할 수 있습니다.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">소스 이름</span>
            <Input
              value={knowledgeConfig.sourceName}
              onChange={(e) => updateKnowledgeField("sourceName", e.target.value)}
              placeholder="예: sales-db"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">DB 타입</span>
            <select
              className="h-10 rounded-lg border border-input bg-background px-2 text-sm outline-none"
              value={knowledgeConfig.dbType}
              onChange={(e) => {
                const next = e.target.value as KnowledgeDbType;
                updateKnowledgeField("dbType", next);
                if (next === "MYSQL") updateKnowledgeField("port", "3306");
                if (next === "POSTGRES") updateKnowledgeField("port", "5432");
              }}
            >
              <option value="POSTGRES">PostgreSQL</option>
              <option value="MYSQL">MySQL</option>
              <option value="SQLITE">SQLite</option>
            </select>
          </label>
          <div className="sm:col-span-2 rounded-lg border border-dashed p-2.5">
            <p className="mb-2 text-[11px] text-muted-foreground">
              테이블 선택 ({availableTables.length}) · 선택 {selectedTables.length}개
            </p>
            {availableTables.length > 0 ? (
              <div className="max-h-28 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {availableTables.map((table) => (
                    <button
                      key={table}
                      type="button"
                      onClick={() => onTableToggle(table)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11px]",
                        selectedTables.includes(table)
                          ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {table}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                연결 테스트를 눌러 테이블 목록을 불러와 주세요.
              </p>
            )}
          </div>

          {knowledgeConfig.dbType === "SQLITE" ? (
            <label className="flex flex-col gap-1 text-xs sm:col-span-2">
              <span className="text-muted-foreground">SQLite 파일 경로</span>
              <Input
                value={knowledgeConfig.sqlitePath}
                onChange={(e) =>
                  updateKnowledgeField("sqlitePath", e.target.value)
                }
                placeholder="/absolute/path/to/knowledge.db"
                className="rounded-lg border border-input bg-background"
              />
            </label>
          ) : (
            <>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Host</span>
                <Input
                  value={knowledgeConfig.host}
                  onChange={(e) => updateKnowledgeField("host", e.target.value)}
                  placeholder="localhost"
                  className="rounded-lg border border-input bg-background"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Port</span>
                <Input
                  value={knowledgeConfig.port}
                  onChange={(e) => updateKnowledgeField("port", e.target.value)}
                  placeholder={
                    knowledgeConfig.dbType === "MYSQL" ? "3306" : "5432"
                  }
                  className="rounded-lg border border-input bg-background"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Username</span>
                <Input
                  value={knowledgeConfig.username}
                  onChange={(e) =>
                    updateKnowledgeField("username", e.target.value)
                  }
                  className="rounded-lg border border-input bg-background"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Password</span>
                <Input
                  type="password"
                  value={knowledgeConfig.password}
                  onChange={(e) =>
                    updateKnowledgeField("password", e.target.value)
                  }
                  placeholder="변경 시에만 입력"
                  className="rounded-lg border border-input bg-background"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Database</span>
                <Input
                  value={knowledgeConfig.database}
                  onChange={(e) =>
                    updateKnowledgeField("database", e.target.value)
                  }
                  className="rounded-lg border border-input bg-background"
                />
              </label>
              {knowledgeConfig.dbType === "POSTGRES" ? (
                <label className="flex flex-col gap-1 text-xs">
                  <span className="text-muted-foreground">Schema (Postgres)</span>
                  <Input
                    value={knowledgeConfig.schema}
                    onChange={(e) =>
                      updateKnowledgeField("schema", e.target.value)
                    }
                    placeholder="public"
                    className="rounded-lg border border-input bg-background"
                  />
                </label>
              ) : (
                <div />
              )}
            </>
          )}

          <div className="sm:col-span-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            선택한 테이블은 전체 컬럼을 자동 학습합니다. 컬럼 선택은 필요 없습니다.
          </div>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="text-muted-foreground">WHERE 조건 (옵션)</span>
            <Textarea
              value={knowledgeConfig.whereClause}
              onChange={(e) =>
                updateKnowledgeField("whereClause", e.target.value)
              }
              placeholder="is_published = true"
              className="min-h-20"
            />
          </label>

          {tablePreviewRows.length > 0 ? (
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">
                데이터 미리보기 (최대 10행)
              </p>
              <div className="overflow-auto rounded-lg border">
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      {Object.keys(tablePreviewRows[0] ?? {}).map((key) => (
                        <th
                          key={key}
                          className="border-b px-2 py-1 text-left font-medium"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tablePreviewRows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b last:border-b-0">
                        {Object.keys(tablePreviewRows[0] ?? {}).map((key) => (
                          <td key={`${rowIndex}-${key}`} className="px-2 py-1">
                            {stringifyPreviewCell(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void onTestConnection()}
            disabled={knowledgeDiscovering || knowledgeTesting}
          >
            {knowledgeTesting || knowledgeDiscovering
              ? "연결 확인 중..."
              : "연결 테스트"}
          </Button>
          <Button
            size="sm"
            onClick={() => void onSave()}
            disabled={knowledgeSaving || selectedTables.length === 0}
          >
            {knowledgeSaving ? "저장 중..." : "완료"}
          </Button>
        </div>
      </section>
    </div>
  );
}

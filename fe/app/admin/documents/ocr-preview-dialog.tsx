"use client";

import { Loader } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type OcrPreviewDialogProps = {
  open: boolean;
  loading: boolean;
  title: string;
  content: string;
  error: string | null;
  onOpenChange: (open: boolean) => void;
};

export function OcrPreviewDialog({
  open,
  loading,
  title,
  content,
  error,
  onOpenChange,
}: OcrPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 pt-5 pb-4">
          <DialogTitle>OCR 추출 내용 확인</DialogTitle>
          <DialogDescription className="truncate">
            {title || "선택한 이미지 문서"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader className="h-4 w-4 animate-spin" />
              OCR 내용을 불러오는 중...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-3 text-xs leading-5">
              {content || "추출된 텍스트가 없습니다."}
            </pre>
          )}
        </div>

        <DialogFooter className="mt-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

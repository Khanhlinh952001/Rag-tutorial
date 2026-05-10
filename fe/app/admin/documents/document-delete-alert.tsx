"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { DeleteTarget } from "./lib/types";

export function DocumentDeleteAlert({
  deleteTarget,
  deleting,
  onOpenChange,
  onConfirmDelete,
}: {
  deleteTarget: DeleteTarget | null;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
}) {
  return (
    <AlertDialog
      open={Boolean(deleteTarget)}
      onOpenChange={onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>문서를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget ? `"${deleteTarget.title}" 문서를 삭제합니다.` : ""}
            <br />
            벡터 인덱스도 함께 제거되며, 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting || !deleteTarget}
            onClick={onConfirmDelete}
          >
            {deleting ? "삭제 중..." : "삭제"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import type { FormEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { Input, Select } from "@/src/ui/components";

type ExpenseEvidenceUploadFormProps = {
  action: string;
  children?: ReactNode;
  defaultSortOrder: number;
  expenseId?: string;
  intent?: "create" | "add-evidence";
  submitLabel: string;
  submitClassName: string;
};

type UploadTarget = {
  assetUrl: string;
  headers: Record<string, string>;
  uploadUrl: string;
};

function resolveContentType(file: File) {
  return file.type || "application/octet-stream";
}

function EvidenceFieldHelp() {
  return (
    <p className="mt-1.5 text-xs leading-5 text-slate-500">
      凭证标签用于给这份凭证起一个展示名，不填则使用文件名；右侧数字是展示顺序，数字越小越靠前。
    </p>
  );
}

async function createUploadTarget(file: File) {
  const response = await fetch("/api/admin/expenses/evidence/upload-url", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: resolveContentType(file),
    }),
  });

  if (!response.ok) {
    throw new Error("无法创建凭证上传地址。");
  }

  return (await response.json()) as UploadTarget;
}

export function ExpenseEvidenceUploadForm({
  action,
  children,
  defaultSortOrder,
  expenseId,
  intent = "create",
  submitLabel,
  submitClassName,
}: ExpenseEvidenceUploadFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const assetUrlInputRef = useRef<HTMLInputElement>(null);
  const fileNameInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (assetUrlInputRef.current?.value && fileNameInputRef.current?.value) {
      return;
    }

    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("evidenceFile");

    if (!(fileInput instanceof HTMLInputElement)) {
      return;
    }

    const file = fileInput.files?.[0];

    if (!file) {
      if (intent === "add-evidence") {
        event.preventDefault();
        setError("请选择要上传的凭证文件。");
      }

      return;
    }

    event.preventDefault();
    setError(null);
    setIsUploading(true);

    try {
      const target = await createUploadTarget(file);
      const uploadResponse = await fetch(target.uploadUrl, {
        method: "PUT",
        headers: target.headers,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("凭证文件上传失败。");
      }

      if (assetUrlInputRef.current) {
        assetUrlInputRef.current.value = target.assetUrl;
      }

      if (fileNameInputRef.current) {
        fileNameInputRef.current.value = file.name;
      }

      window.setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 0);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "凭证文件上传失败。",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={action}
      method="post"
      onSubmit={handleSubmit}
      className={
        intent === "create" ? "mt-6 space-y-5" : "rounded-2xl border border-slate-200 bg-slate-50 p-4"
      }
    >
      {intent !== "create" ? (
        <>
          <input type="hidden" name="intent" value="add-evidence" />
          <input type="hidden" name="expenseId" value={expenseId} />
        </>
      ) : null}
      <input ref={assetUrlInputRef} type="hidden" name="assetUrl" />
      <input ref={fileNameInputRef} type="hidden" name="fileName" />

      {children}

      <div
        className={
          intent === "create" ? "grid gap-5 md:grid-cols-4" : "grid gap-3"
        }
      >
        <div className={intent === "create" ? "md:col-span-2" : ""}>
          <Input
            label="上传凭证"
            id={expenseId ? `evidence-file-${expenseId}` : "evidence-file-new"}
            name="evidenceFile"
            type="file"
            required={intent === "add-evidence"}
            className="py-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
        </div>
        <div className={intent === "create" ? "" : "grid gap-3 sm:grid-cols-2"}>
          <Input
            aria-label="凭证标签"
            name="label"
            placeholder="凭证标签"
          />
          {intent === "add-evidence" ? (
            <Input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={defaultSortOrder}
              placeholder="排序数字"
              aria-label="凭证排序"
            />
          ) : null}
          <div className="sm:col-span-2">
            <EvidenceFieldHelp />
          </div>
        </div>
        {intent === "create" ? (
          <div>
            <Input
              name="sortOrder"
              type="number"
              min="0"
              defaultValue={defaultSortOrder}
              placeholder="排序数字"
              aria-label="凭证排序"
            />
            <EvidenceFieldHelp />
          </div>
        ) : null}
        <div className={intent === "add-evidence" ? "grid gap-3 sm:grid-cols-2" : ""}>
          <Select
            name="visibility"
            defaultValue="PUBLIC"
            aria-label="凭证可见性"
            options={[
              { value: "PUBLIC", label: "公开凭证" },
              { value: "AUDIT_ONLY", label: "仅审计凭证" },
            ]}
          />
          {intent === "add-evidence" ? (
            <button
              type="submit"
              disabled={isUploading}
              className={submitClassName}
            >
              {isUploading ? "上传中..." : submitLabel}
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {intent === "create" ? (
        <button type="submit" disabled={isUploading} className={submitClassName}>
          {isUploading ? "上传中..." : submitLabel}
        </button>
      ) : null}
    </form>
  );
}

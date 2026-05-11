/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";

import { getExpenseDetail } from "@/src/application/public";
import { formatFenToYuan } from "@/src/shared";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

function isImageEvidence(evidence: { assetUrl: string; fileName: string }) {
  const imageExtensionPattern = /\.(apng|avif|gif|jpe?g|png|svg|webp)$/i;

  try {
    const url = new URL(evidence.assetUrl);
    return imageExtensionPattern.test(url.pathname) || imageExtensionPattern.test(evidence.fileName);
  } catch {
    return imageExtensionPattern.test(evidence.assetUrl) || imageExtensionPattern.test(evidence.fileName);
  }
}

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const { expenseId } = await params;
  const expense = await getExpenseDetail(expenseId);

  if (!expense) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/expenses" className="text-sm font-medium text-blue-600">
          返回列表
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">支出项目</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {expense.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">
              {expense.description}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-right">
            <p className="text-sm text-slate-500">支出金额</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {formatFenToYuan(expense.amountFen)}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              时间：{formatDate(expense.createdAt)}
            </p>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">公开凭证</h2>
            <span className="text-xs text-slate-400">
              {expense.detailVisibility === "PUBLIC" ? "详情公开" : "仅摘要"}
            </span>
          </div>

          {expense.evidence.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              暂无凭证
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {expense.evidence
                .slice()
                .sort((left, right) => left.sortOrder - right.sortOrder)
                .map((evidence) => {
                  const title = evidence.label ?? evidence.fileName;

                  if (isImageEvidence(evidence)) {
                    return (
                      <figure
                        key={evidence.id}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        <a
                          href={evidence.assetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                        >
                          <img
                            src={evidence.assetUrl}
                            alt={title}
                            className="h-72 w-full object-cover transition duration-200 hover:scale-[1.01]"
                          />
                        </a>
                        <figcaption className="flex items-center justify-between px-4 py-3 text-sm text-slate-600">
                          <span>{title}</span>
                          <span className="text-xs text-slate-400">
                            #{evidence.sortOrder}
                          </span>
                        </figcaption>
                      </figure>
                    );
                  }

                  return (
                    <div
                      key={evidence.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {title}
                      </p>
                      <p className="mt-1 break-all text-xs text-slate-500">
                        {evidence.fileName}
                      </p>
                      <a
                        href={evidence.assetUrl}
                        download={evidence.fileName}
                        className="mt-4 inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        下载 {title}
                      </a>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { listAdminExpenses } from "@/src/application/admin";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";
import { formatFenToYuan } from "@/src/shared";

import { ExpenseEvidenceUploadForm } from "./ExpenseEvidenceUploadForm";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "未记录";
  }

  return new Date(value).toLocaleString("zh-CN");
}

function visibilityLabel(value: "PUBLIC" | "AUDIT_ONLY") {
  return value === "PUBLIC" ? "公开" : "仅审计";
}

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageSession();
  const [expenses, resolvedSearchParams] = await Promise.all([
    listAdminExpenses(),
    searchParams,
  ]);
  const errorParam = resolvedSearchParams.error;
  const error = typeof errorParam === "string" ? errorParam : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">支出记录管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            新增、编辑支出记录，并维护公开凭证与仅审计凭证。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          当前记录：
          <span className="ml-2 font-semibold text-slate-900">
            {expenses.items.length} 条
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">新增支出</h2>
        <ExpenseEvidenceUploadForm
          action="/api/admin/expenses"
          defaultSortOrder={1}
          submitLabel="保存支出"
          submitClassName="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-700">
                支出项目
              </label>
              <input
                id="title"
                name="title"
                required
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-slate-700">
                支出金额
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-700">
              备注
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="detailVisibility" className="block text-sm font-medium text-slate-700">
                详情可见性
              </label>
              <select
                id="detailVisibility"
                name="detailVisibility"
                defaultValue="PUBLIC"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="PUBLIC">公开详情</option>
                <option value="AUDIT_ONLY">仅审计详情</option>
              </select>
            </div>
          </div>
        </ExpenseEvidenceUploadForm>
      </section>

      <section className="space-y-5">
        {expenses.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            暂无支出记录。
          </div>
        ) : (
          expenses.items.map((expense) => (
            <article
              key={expense.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {expense.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatTimestamp(expense.createdAt)} · {visibilityLabel(expense.detailVisibility)}
                  </p>
                </div>
                <p className="text-2xl font-semibold text-slate-900">
                  {formatFenToYuan(expense.amountFen)}
                </p>
              </div>

              <form action="/api/admin/expenses" method="post" className="mt-5 grid gap-4 lg:grid-cols-6">
                <input type="hidden" name="intent" value="update-expense" />
                <input type="hidden" name="id" value={expense.id} />
                <input
                  name="title"
                  defaultValue={expense.title}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none lg:col-span-2"
                />
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={(expense.amountFen / 100).toFixed(2)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                />
                <select
                  name="detailVisibility"
                  defaultValue={expense.detailVisibility}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="PUBLIC">公开详情</option>
                  <option value="AUDIT_ONLY">仅审计详情</option>
                </select>
                <input
                  name="description"
                  defaultValue={expense.description}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none lg:col-span-2"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 lg:col-start-6"
                >
                  更新支出
                </button>
              </form>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <ExpenseEvidenceUploadForm
                  action="/api/admin/expenses"
                  defaultSortOrder={expense.evidence.length + 1}
                  expenseId={expense.id}
                  intent="add-evidence"
                  submitLabel="添加凭证"
                  submitClassName="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />

                <div className="space-y-3">
                  {expense.evidence.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                      暂无凭证。
                    </div>
                  ) : (
                    expense.evidence.map((evidence) => (
                      <form
                        key={evidence.id}
                        action="/api/admin/expenses"
                        method="post"
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <input type="hidden" name="intent" value="update-evidence" />
                        <input type="hidden" name="id" value={evidence.id} />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <a
                              href={evidence.assetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate text-sm font-medium text-blue-700"
                            >
                              {evidence.label || evidence.fileName}
                            </a>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {evidence.fileName}
                            </p>
                          </div>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
                            {visibilityLabel(evidence.visibility)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-4">
                          <input
                            name="label"
                            defaultValue={evidence.label ?? ""}
                            placeholder="标签"
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none sm:col-span-2"
                          />
                          <input
                            name="sortOrder"
                            type="number"
                            min="0"
                            defaultValue={evidence.sortOrder}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                          />
                          <select
                            name="visibility"
                            defaultValue={evidence.visibility}
                            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none"
                          >
                            <option value="PUBLIC">公开</option>
                            <option value="AUDIT_ONLY">仅审计</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          更新凭证
                        </button>
                      </form>
                    ))
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

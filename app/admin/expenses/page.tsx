import { listAdminExpenses } from "@/src/application/admin";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";
import { formatFenToYuan } from "@/src/shared";
import { Input, Select, Textarea } from "@/src/ui/components";

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
            <Input
              label="支出项目"
              id="title"
              name="title"
              required
            />
            <Input
              label="支出金额"
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
            />
          </div>
          <Textarea
            label="备注"
            id="description"
            name="description"
            rows={3}
            containerClassName="mt-5"
          />
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Select
              label="详情可见性"
              id="detailVisibility"
              name="detailVisibility"
              defaultValue="PUBLIC"
              options={[
                { value: "PUBLIC", label: "公开详情" },
                { value: "AUDIT_ONLY", label: "仅审计详情" },
              ]}
            />
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
                <Input
                  name="title"
                  defaultValue={expense.title}
                  containerClassName="lg:col-span-2"
                  aria-label="支出项目"
                />
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  defaultValue={(expense.amountFen / 100).toFixed(2)}
                  aria-label="支出金额"
                />
                <Select
                  name="detailVisibility"
                  defaultValue={expense.detailVisibility}
                  aria-label="详情可见性"
                  options={[
                    { value: "PUBLIC", label: "公开详情" },
                    { value: "AUDIT_ONLY", label: "仅审计详情" },
                  ]}
                />
                <Input
                  name="description"
                  defaultValue={expense.description}
                  containerClassName="lg:col-span-2"
                  aria-label="备注"
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
                          <Input
                            name="label"
                            defaultValue={evidence.label ?? ""}
                            placeholder="标签"
                            containerClassName="sm:col-span-2"
                            aria-label="标签"
                          />
                          <Input
                            name="sortOrder"
                            type="number"
                            min="0"
                            defaultValue={evidence.sortOrder}
                            aria-label="排序"
                          />
                          <Select
                            name="visibility"
                            defaultValue={evidence.visibility}
                            aria-label="可见性"
                            options={[
                              { value: "PUBLIC", label: "公开" },
                              { value: "AUDIT_ONLY", label: "仅审计" },
                            ]}
                          />
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

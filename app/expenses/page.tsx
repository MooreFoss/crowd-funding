import Link from "next/link";

import { listExpenses } from "@/src/application/public";
import { formatFenToYuan } from "@/src/shared";
import { PublicListPagination } from "@/src/ui/components";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN");
}

function resolvePageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const pageNumber = resolvePageNumber(resolvedSearchParams.page);
  const pageSize = 20;
  const expenses = await listExpenses({
    limit: pageSize,
    offset: (pageNumber - 1) * pageSize,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">支出明细</h1>
          <p className="mt-2 text-sm text-slate-500">
            每一笔资金的去向都清晰可见。我们承诺合理、高效地使用每一份支持。
          </p>
        </div>
      </div>

      {expenses.items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          暂无公开支出记录。
        </div>
      ) : (
        <>
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
            {expenses.items.map((expense) => (
              <Link
                key={expense.id}
                href={`/expenses/${expense.id}`}
                className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                    {formatDate(expense.createdAt)}
                  </span>
                  <span className="text-xl font-bold text-slate-900 tabular-nums">
                    {formatFenToYuan(expense.amountFen)}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {expense.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {expense.description}
                </p>
                <div className="mt-6 flex items-center justify-between text-xs font-medium">
                  <span className="text-blue-600">查看详情</span>
                  <span className="text-slate-400">
                    {expense.detailVisibility === "PUBLIC" ? "公开详情" : "仅公开摘要"}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
            支出摘要始终保留在公开列表中；若某条记录没有公开详情或公开凭证，详情页会明确提示当前没有可展示的图片材料。
          </div>
          <PublicListPagination
            basePath="/expenses"
            page={expenses.page}
            totalLoaded={expenses.items.length}
          />
        </>
      )}
    </div>
  );
}

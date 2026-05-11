import { listPledges } from "@/src/application/public";
import { formatFenToYuan } from "@/src/shared";
import { PublicListPagination } from "@/src/ui/components";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  return new Date(value ?? "").toLocaleDateString("zh-CN");
}

function resolvePageNumber(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function PledgesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const pageNumber = resolvePageNumber(resolvedSearchParams.page);
  const pageSize = 20;
  const pledges = await listPledges({
    limit: pageSize,
    offset: (pageNumber - 1) * pageSize,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">众筹记录</h1>
          <p className="mt-2 text-sm text-slate-500">
            所有支付成功的赞助记录在此公开。
          </p>
        </div>
      </div>

      {pledges.items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          暂无记录
        </div>
      ) : (
        <>
          <div className="mt-8 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                          赞助人
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                          留言
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900">
                          金额
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900">
                          日期
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {pledges.items.map((pledge) => (
                        <tr key={pledge.id} className="transition-colors hover:bg-slate-50">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                            {pledge.displayName}
                          </td>
                          <td className="max-w-xs px-3 py-4 text-sm text-slate-500">
                            {pledge.message || <span className="italic text-slate-300">无留言</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-bold text-slate-900 tabular-nums">
                            <div className="flex flex-col items-end">
                              <span>{formatFenToYuan(pledge.amountFen)}</span>
                              {pledge.status === "PARTIAL_REFUNDED" && (
                                <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                  {pledge.statusLabel}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-500 tabular-nums">
                            {formatDate(pledge.paidAt ?? pledge.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <PublicListPagination
            basePath="/pledges"
            page={pledges.page}
            totalLoaded={pledges.items.length}
          />
        </>
      )}
    </div>
  );
}

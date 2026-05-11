import { listAdminPledges } from "@/src/application/admin";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";
import { formatFenToYuan, getStatusLabel } from "@/src/shared";
import { Input, Textarea } from "@/src/ui/components";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "未确认";
  }

  return new Date(value).toLocaleString("zh-CN");
}

function getModerationTone(status?: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    case "REVIEW_ERROR":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-500";
  }
}

function ModerationBadge({
  review,
  fallback,
}: {
  review: {
    status: string;
    statusLabel: string;
    failureSummary: string | null;
    reviewedAt: string | null;
    retryCount: number;
  } | null;
  fallback: string;
}) {
  if (!review) {
    return (
      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
        {fallback}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getModerationTone(review.status)}`}
      title={[
        review.failureSummary,
        review.reviewedAt ? `审核时间：${formatTimestamp(review.reviewedAt)}` : null,
        review.retryCount > 0 ? `重试次数：${review.retryCount}` : null,
      ]
        .filter(Boolean)
        .join("；")}
    >
      {review.statusLabel}
    </span>
  );
}

export default async function AdminPledgesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageSession();
  const [pledges, resolvedSearchParams] = await Promise.all([
    listAdminPledges({ limit: 50, offset: 0 }),
    searchParams,
  ]);
  const errorParam = resolvedSearchParams.error;
  const error = typeof errorParam === "string" ? errorParam : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">赞助记录管理</h1>
          <p className="mt-1 text-sm text-slate-500">
            查看订单与审核状态；修改后将重新审核。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          当前加载：
          <span className="ml-2 font-semibold text-slate-900">
            {pledges.items.length} 条
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {pledges.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            暂无赞助记录。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">订单</th>
                  <th className="px-5 py-3">公开展示</th>
                  <th className="px-5 py-3">金额</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">审核</th>
                  <th className="px-5 py-3">编辑</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pledges.items.map((pledge) => {
                  const hasRecoverableReview =
                    pledge.moderation.displayName?.status === "REVIEW_ERROR" ||
                    pledge.moderation.message?.status === "REVIEW_ERROR";

                  return (
                    <tr key={pledge.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs font-semibold text-slate-900">
                          {pledge.merchantOrderNo}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          创建：{formatTimestamp(pledge.createdAt)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          支付：{formatTimestamp(pledge.paidAt)}
                        </p>
                      </td>
                      <td className="max-w-xs px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {pledge.displayName}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-slate-500">
                          {pledge.message || "无留言"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {formatFenToYuan(pledge.netAmountFen)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          原始 {formatFenToYuan(pledge.amountFen)}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {getStatusLabel(pledge.status)}
                      </td>
                      <td className="space-y-2 px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500">昵称</span>
                          <ModerationBadge
                            review={pledge.moderation.displayName}
                            fallback="未审核"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500">留言</span>
                          <ModerationBadge
                            review={pledge.moderation.message}
                            fallback="未审核"
                          />
                        </div>
                      </td>
                      <td className="w-80 px-5 py-4">
                        <form action="/api/admin/pledges" method="post" className="space-y-3">
                          <input type="hidden" name="id" value={pledge.id} />
                          <Input
                            name="displayName"
                            defaultValue={pledge.displayName === "匿名用户" ? "" : pledge.displayName}
                            maxLength={20}
                            placeholder="匿名用户"
                            aria-label="昵称"
                          />
                          <Textarea
                            name="message"
                            defaultValue={pledge.message}
                            maxLength={200}
                            rows={3}
                            placeholder="无留言"
                            aria-label="留言"
                          />
                          <button
                            type="submit"
                            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            {hasRecoverableReview ? "重试并保存" : "保存并提交审核"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

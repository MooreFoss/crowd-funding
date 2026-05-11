import { listRefundCenter } from "@/src/application/refunds";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";
import { formatFenToYuan, getStatusLabel } from "@/src/shared";
import { Input, Select, Textarea } from "@/src/ui/components";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "未记录";
  }

  return new Date(value).toLocaleString("zh-CN");
}

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageSession();
  const [refundCenter, resolvedSearchParams] = await Promise.all([
    listRefundCenter(),
    searchParams,
  ]);
  const campaign = refundCenter.campaign;
  const snapshot = campaign?.closeSnapshot;
  const errorParam = resolvedSearchParams.error;
  const error = typeof errorParam === "string" ? errorParam : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">退款与关停</h1>
          <p className="mt-1 text-sm text-slate-500">
            发起单笔退款，关闭众筹，并基于关闭快照创建按比例批量退款。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          众筹状态：
          <span className="ml-2 font-semibold text-slate-900">
            {getStatusLabel(campaign?.status ?? "ACTIVE")}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">关闭快照</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {snapshot
              ? formatFenToYuan(snapshot.refundableBalanceFen ?? snapshot.totalEligibleNetFen)
              : "未关闭"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {snapshot
              ? `快照时间：${formatTimestamp(snapshot.capturedAt)}`
              : "仍可接收赞助"}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">参与订单</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {snapshot?.pledges.length ?? 0}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            有效净额 {formatFenToYuan(snapshot?.totalEligibleNetFen ?? 0)}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">批量进度</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {campaign?.refundBatchNo ?? "未创建"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {campaign?.refundProgress
              ? JSON.stringify(campaign.refundProgress)
              : "暂无批量退款"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">单笔退款</h2>
          <form action="/api/admin/refunds" method="post" className="mt-5 space-y-4">
            <Select
              label="赞助订单"
              id="pledgeId"
              name="pledgeId"
              required
            >
              <option value="">选择可退款订单</option>
              {refundCenter.refundablePledges.map((pledge) => (
                <option key={pledge.id} value={pledge.id}>
                  {pledge.merchantOrderNo} · {pledge.displayName} · {formatFenToYuan(pledge.netAmountFen)}
                </option>
              ))}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="退款金额"
                aria-label="退款金额"
              />
              <Input
                name="reason"
                required
                placeholder="退款原因"
                aria-label="退款原因"
              />
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              发起退款
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">结束众筹</h2>
          <form action="/api/admin/funding/close" method="post" className="mt-5 space-y-4">
            <Textarea
              name="closeReason"
              rows={4}
              required
              placeholder="关闭原因"
              disabled={Boolean(snapshot)}
              aria-label="关闭原因"
            />
            <button
              type="submit"
              disabled={Boolean(snapshot)}
              className="inline-flex w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {snapshot ? "已生成关闭快照" : "结束众筹并冻结快照"}
            </button>
          </form>
          <form action="/api/admin/funding/batch-refunds" method="post" className="mt-4">
            <button
              type="submit"
              disabled={!snapshot}
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              创建按比例批量退款
            </button>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">退款记录</h2>
        </div>
        {refundCenter.refunds.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            暂无退款记录。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">退款单</th>
                  <th className="px-5 py-3">原订单</th>
                  <th className="px-5 py-3">金额</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">批次</th>
                  <th className="px-5 py-3">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refundCenter.refunds.map((refund) => (
                  <tr key={refund.id}>
                    <td className="px-5 py-4 font-mono text-xs text-slate-900">
                      {refund.merchantRefundNo}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {refund.merchantOrderNo ?? refund.pledgeId}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {formatFenToYuan(refund.amountFen)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {getStatusLabel(refund.status)}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {refund.batchNo ?? "单笔"}
                    </td>
                    <td className="px-5 py-4 text-slate-500">
                      {formatTimestamp(refund.completedAt ?? refund.requestedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

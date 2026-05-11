import Link from "next/link";

import { listAdminPledges } from "@/src/application/admin";
import { getSummary } from "@/src/application/public";
import { listRefundCenter } from "@/src/application/refunds";
import { getAdminSession } from "@/src/infrastructure/auth/session";
import { formatFenToYuan, getStatusLabel } from "@/src/shared";
import { Input } from "@/src/ui/components";

export const dynamic = "force-dynamic";

function getLoginErrorMessage(error: string | undefined) {
  switch (error) {
    case "invalid-credentials":
      return "账号或密码错误，请重新输入。";
    case "invalid-request":
      return "请完整填写登录信息后再提交。";
    default:
      return null;
  }
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();

  if (!session) {
    const resolvedSearchParams = await searchParams;
    const errorParam = resolvedSearchParams.error;
    const error =
      typeof errorParam === "string" ? getLoginErrorMessage(errorParam) : null;

    return (
      <div className="mx-auto flex min-h-[calc(100vh-64px-120px)] max-w-md items-center px-4 py-16 sm:px-6">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div>
            <p className="text-sm font-medium text-blue-600">管理入口</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              管理员登录
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              使用单管理员账号进入后台，维护条款版本、赞助记录、支出与退款流程。
            </p>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form action="/api/admin/session" method="post" className="mt-8 space-y-5">
            <Input
              label="管理员账号"
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
            />
            <Input
              label="管理员密码"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              登录后台
            </button>
          </form>
        </div>
      </div>
    );
  }

  const [summary, refunds, pledges] = await Promise.all([
    getSummary(),
    listRefundCenter(),
    listAdminPledges({ limit: 100, offset: 0 }),
  ]);
  const pendingRefunds = refunds.refunds.filter((refund) =>
    ["CREATED", "PROCESSING"].includes(refund.status),
  ).length;
  const moderationFailures = pledges.items.filter(
    (pledge) =>
      pledge.moderation.displayName?.status === "REJECTED" ||
      pledge.moderation.message?.status === "REJECTED" ||
      pledge.moderation.displayName?.status === "REVIEW_ERROR" ||
      pledge.moderation.message?.status === "REVIEW_ERROR",
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">管理控制台概览</h1>
        <p className="mt-1 text-sm text-slate-500">
          当前登录账号：{session.username}。指标来自当前权威数据。
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">资金池余额</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {formatFenToYuan(summary.balanceFen)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">待处理退款</p>
          <p className="mt-2 text-3xl font-semibold text-amber-600">
            {pendingRefunds}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">审核异常</p>
          <p className="mt-2 text-3xl font-semibold text-red-600">
            {moderationFailures}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">快速操作</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href="/admin/refunds"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              退款与关停
            </Link>
            <Link
              href="/admin/audit-logs"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              查看审计日志
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">活动状态</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li>众筹状态：{getStatusLabel(summary.campaignStatus)}</li>
            <li>累计赞助：{formatFenToYuan(summary.totalRaisedFen)}</li>
            <li>累计支出：{formatFenToYuan(summary.totalExpenseFen)}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

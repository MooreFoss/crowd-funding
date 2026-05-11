import Link from "next/link";

import { getEditableSiteSettings } from "@/src/application/admin";
import { getSummary } from "@/src/application/public";
import { formatFenToYuan, getStatusLabel } from "@/src/shared";
import { SponsorActionLink } from "@/src/ui/components";

export const dynamic = "force-dynamic";

function getCampaignStatusMessage(status: string) {
  switch (status) {
    case "CLOSING":
      return "众筹已关闭，结算与退款准备中。";
    case "REFUNDING":
      return "正在执行退款，数据持续更新。";
    case "ENDED":
    case "SETTLED":
      return "众筹已结束，保留资金与支出公示。";
    default:
      return "众筹进行中，数据实时更新。";
  }
}

export default async function HomePage() {
  const [summary, settings] = await Promise.all([
    getSummary(),
    getEditableSiteSettings(),
  ]);
  const campaignStatusLabel = getStatusLabel(summary.campaignStatus);
  const heroDescription =
    summary.campaignStatus === "ACTIVE"
      ? settings.heroDescription
      : getCampaignStatusMessage(summary.campaignStatus);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              状态：{campaignStatusLabel}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                {settings.heroTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {heroDescription}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">当前余额</p>
              <p className="mt-2 text-5xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
                {formatFenToYuan(summary.balanceFen)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {summary.canSponsor ? (
              <SponsorActionLink
                className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                立即赞助
              </SponsorActionLink>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="inline-flex cursor-not-allowed items-center justify-center rounded-full bg-slate-200 px-6 py-3 text-sm font-semibold text-slate-500"
              >
                众筹已关闭
              </button>
            )}
            <Link
              href="/pledges"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              众筹记录
            </Link>
            <Link
              href="/expenses"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              支出明细
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">累计赞助</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatFenToYuan(summary.totalRaisedFen)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">累计支出</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatFenToYuan(summary.totalExpenseFen)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">赞助人数</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {summary.sponsorCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">赞助入口</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {summary.canSponsor ? "开放中" : "已停用"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

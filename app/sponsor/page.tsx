import { getActiveTermsVersion } from "@/src/application/admin";
import { getSummary } from "@/src/application/public";

export const dynamic = "force-dynamic";

export default async function SponsorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [activeTerms, summary] = await Promise.all([
    getActiveTermsVersion(),
    getSummary(),
  ]);
  const resolvedSearchParams = await searchParams;
  const errorParam = resolvedSearchParams.error;
  const error = typeof errorParam === "string" ? errorParam : null;
  const sponsorshipClosed = !summary.canSponsor;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">发起赞助</h1>
        <p className="mt-4 text-lg text-slate-500">
          感谢您的支持。您的每一份赞助都将用于项目的持续建设与维护。
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {sponsorshipClosed ? (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          众筹已结束，当前不能创建新的赞助订单。
        </div>
      ) : null}

      <form action="/api/sponsorship/orders" method="post" className="mt-12 space-y-8 rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <div className="space-y-6">
          {/* Amount Selection */}
          <div>
            <label htmlFor="amount" className="text-base font-semibold text-slate-900">赞助金额 (¥)</label>
            <div className="mt-4">
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue="10"
                placeholder="10.00"
                className="block w-full rounded-lg border-slate-200 py-3 text-slate-900 shadow-sm focus:border-blue-600 focus:ring-blue-600 sm:text-sm"
              />
            </div>
          </div>

          {/* Nickname */}
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium text-slate-700">展示昵称</label>
            <div className="mt-1">
              <input
                type="text"
                name="displayName"
                id="nickname"
                placeholder="匿名用户"
                className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-600 focus:ring-blue-600 sm:text-sm"
              />
            </div>
          </div>

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-700">留言 (可选)</label>
            <div className="mt-1">
              <textarea
                id="message"
                name="message"
                rows={3}
                placeholder="想对我们说点什么？"
                className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-blue-600 focus:ring-blue-600 sm:text-sm"
              />
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="terms"
                name="termsAccepted"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="font-medium text-slate-700">
                我已阅读并同意 <a href="/terms" className="text-blue-600 underline">用户协议</a> 与 <a href="/terms" className="text-blue-600 underline">隐私政策</a>
              </label>
              <p className="mt-1 text-xs text-slate-400">
                当前生效版本：
                <span className="ml-1 text-slate-600">
                  {activeTerms
                    ? `${activeTerms.version} · ${activeTerms.title}`
                    : "暂无生效条款"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={sponsorshipClosed}
          className="flex w-full items-center justify-center rounded-full bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95"
        >
          {sponsorshipClosed ? "众筹已结束" : "确认并去支付"}
        </button>

        <div className="flex items-center justify-center gap-4 border-t border-slate-100 pt-6">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            加密安全支付
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            官方权威保障
          </div>
        </div>
      </form>
    </div>
  );
}

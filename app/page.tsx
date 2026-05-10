import Link from "next/link";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-[1000px] -translate-x-1/2 [mask-image:radial-gradient(closest-side,white,transparent)] sm:h-[800px]">
        <div className="absolute inset-0 bg-blue-100/50 [mask-image:radial-gradient(40%_40%_at_50%_0%,#1e40af_20%,transparent)]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-16 pb-24 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base font-semibold text-blue-600 tracking-wide uppercase">当前资金状态</h2>
          <div className="mt-4 flex flex-col items-center">
            <span className="text-sm font-medium text-slate-500 mb-1">资金池总余额</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-900 sm:text-6xl">¥</span>
              <span className="text-6xl font-black tracking-tighter text-slate-900 sm:text-8xl tabular-nums">
                123,456.78
              </span>
            </div>
          </div>
          
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/sponsor"
              className="rounded-full bg-blue-600 px-8 py-3 text-lg font-bold text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
            >
              立即赞助支持
            </Link>
            <Link
              href="/pledges"
              className="rounded-full bg-white px-8 py-3 text-lg font-bold text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all"
            >
              查看记录
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-8 border border-slate-100 shadow-sm transition-hover hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">累计赞助总额</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">¥ 150,000.00</p>
            <div className="mt-2 h-1 w-12 rounded bg-blue-500" />
          </div>
          <div className="rounded-2xl bg-white p-8 border border-slate-100 shadow-sm transition-hover hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">累计支出总额</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">¥ 26,543.22</p>
            <div className="mt-2 h-1 w-12 rounded bg-slate-200" />
          </div>
          <div className="rounded-2xl bg-white p-8 border border-slate-100 shadow-sm transition-hover hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">赞助人数</p>
            <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">1,280 人</p>
            <div className="mt-2 h-1 w-12 rounded bg-teal-500" />
          </div>
        </div>

        {/* Mission Statement */}
        <div className="mt-24 rounded-3xl bg-slate-900 p-8 sm:p-12 overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-white sm:text-3xl">资金透明公示原则</h3>
            <p className="mt-4 max-w-2xl text-lg text-slate-400">
              我们坚持每一分钱都可追溯。所有的赞助记录实时公开，所有的支出明细均附带备注与日期。您的支持是我们的动力，您的信任是我们最宝贵的资产。
            </p>
            <div className="mt-8 flex gap-6">
              <div className="flex items-center gap-2">
                <div className="size-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-sm font-medium text-slate-300">实时更新</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-sm font-medium text-slate-300">全量公开</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-sm font-medium text-slate-300">严谨审计</span>
              </div>
            </div>
          </div>
          {/* Decorative element */}
          <div className="absolute -right-20 -bottom-20 size-80 rounded-full bg-blue-600/10 blur-3xl" />
        </div>
      </div>
    </div>
  );
}

export default function SponsorPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">发起赞助</h1>
        <p className="mt-4 text-lg text-slate-500">
          感谢您的支持。您的每一份赞助都将用于项目的持续建设与维护。
        </p>
      </div>

      <form className="mt-12 space-y-8 rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <div className="space-y-6">
          {/* Amount Selection */}
          <div>
            <label className="text-base font-semibold text-slate-900">选择赞助金额 (¥)</label>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {['10', '50', '100', '200', '500', '1000'].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  className="flex items-center justify-center rounded-lg border border-slate-200 py-3 text-sm font-semibold text-slate-900 hover:border-blue-600 hover:text-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  ¥ {amount}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <input
                type="number"
                placeholder="自定义金额"
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
                name="nickname"
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
                name="terms"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="font-medium text-slate-700">
                我已阅读并同意 <a href="/terms" className="text-blue-600 underline">用户协议</a> 与 <a href="/terms" className="text-blue-600 underline">隐私政策</a>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-full bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95"
        >
          确认并去支付
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

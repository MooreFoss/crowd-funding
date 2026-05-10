import { requireAdminPageSession } from "@/src/infrastructure/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPageSession();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">系统全局配置</h1>
        <p className="mt-1 text-sm text-slate-500">管理站点基础信息、展示文本以及第三方服务接入（如 TMS）。</p>
      </div>

      <div className="mt-8 space-y-8">
        {/* 站点基础信息配置 */}
        <section className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-semibold text-slate-900">站点基础信息</h3>
            <p className="text-sm text-slate-500">这些设置将直接影响用户端页面标签与整体品牌展示。</p>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label htmlFor="site_title" className="block text-sm font-medium text-slate-700">网页标题 (Title)</label>
              <input
                type="text"
                id="site_title"
                defaultValue="众筹系统 - 透明可追溯的资金管理平台"
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="favicon_url" className="block text-sm font-medium text-slate-700">站点图标 (Favicon URL)</label>
              <input
                type="text"
                id="favicon_url"
                defaultValue="/favicon.ico"
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="hero_title" className="block text-sm font-medium text-slate-700">众筹核心标题 (首页大字)</label>
              <input
                type="text"
                id="hero_title"
                defaultValue="当前资金状态"
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </section>

        {/* 文本审核(TMS)配置 */}
        <section className="bg-white rounded-xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">内容安全与审核 (TMS)</h3>
              <p className="text-sm text-slate-500">配置昵称与留言的自动审核服务，确保合规性。</p>
            </div>
            <div className="flex items-center h-5">
              <input
                id="tms_enabled"
                name="tms_enabled"
                type="checkbox"
                defaultChecked
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <label htmlFor="tms_enabled" className="ml-2 text-sm font-medium text-slate-900">开启审核</label>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label htmlFor="tms_api_endpoint" className="block text-sm font-medium text-slate-700">TMS 服务端点 (API Endpoint)</label>
              <input
                type="text"
                id="tms_api_endpoint"
                defaultValue="https://api.tms-service.internal/v1/moderate"
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="tms_api_key" className="block text-sm font-medium text-slate-700">TMS API 密钥</label>
              <input
                type="password"
                id="tms_api_key"
                defaultValue="************************"
                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <p className="mt-1 text-xs text-slate-400">密钥已加密隐藏。输入新值以覆盖。</p>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button type="button" className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            放弃修改
          </button>
          <button type="button" className="rounded-md bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}

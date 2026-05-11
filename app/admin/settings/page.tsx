import { requireAdminPageSession } from "@/src/infrastructure/auth/session";
import { Input } from "@/src/ui/components";

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
        <section className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-semibold text-slate-900">站点基础信息</h3>
            <p className="text-sm text-slate-500">这些设置将直接影响用户端页面标签与整体品牌展示。</p>
          </div>
          <div className="p-6 space-y-6">
            <Input
              label="网页标题 (Title)"
              id="site_title"
              defaultValue="众筹系统 - 透明可追溯的资金管理平台"
            />
            <Input
              label="站点图标 (Favicon URL)"
              id="favicon_url"
              defaultValue="/favicon.ico"
            />
            <Input
              label="众筹核心标题 (首页大字)"
              id="hero_title"
              defaultValue="当前资金状态"
            />
          </div>
        </section>

        {/* 文本审核(TMS)配置 */}
        <section className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
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
            <Input
              label="TMS 服务端点 (API Endpoint)"
              id="tms_api_endpoint"
              defaultValue="https://api.tms-service.internal/v1/moderate"
            />
            <div>
              <Input
                label="TMS API 密钥"
                type="password"
                id="tms_api_key"
                defaultValue="************************"
              />
              <p className="mt-1 text-xs text-slate-400">密钥已加密隐藏。输入新值以覆盖。</p>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button type="button" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            放弃修改
          </button>
          <button type="button" className="rounded-xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}

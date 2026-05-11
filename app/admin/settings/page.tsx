import { requireAdminPageSession } from "@/src/infrastructure/auth/session";
import { Input } from "@/src/ui/components";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPageSession();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">系统全局配置</h1>
        <p className="mt-1 text-sm text-slate-500">管理站点基础信息与展示文本。</p>
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

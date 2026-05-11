import {
  getEditableSiteSettings,
} from "@/src/application/admin";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";
import { Input } from "@/src/ui/components";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageSession();
  const [settings, resolvedSearchParams] = await Promise.all([
    getEditableSiteSettings(),
    searchParams,
  ]);
  const errorParam = resolvedSearchParams.error;
  const savedParam = resolvedSearchParams.saved;
  const error = typeof errorParam === "string" ? errorParam : null;
  const saved = savedParam === "1";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">系统全局配置</h1>
        <p className="mt-1 text-sm text-slate-500">管理站点基础信息与展示文本。</p>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error === "invalid-request"
            ? "请完整填写站点标题、图标地址和首页标题。"
            : error}
        </div>
      ) : null}

      {saved ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          系统配置已保存。
        </div>
      ) : null}

      <form action="/api/admin/settings" method="post" className="mt-8 space-y-8">
        <section className="bg-white rounded-3xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-semibold text-slate-900">站点基础信息</h3>
            <p className="text-sm text-slate-500">这些设置将直接影响用户端页面标签与整体品牌展示。</p>
          </div>
          <div className="p-6 space-y-6">
            <Input
              label="网页标题 (Title)"
              id="site_title"
              name="siteTitle"
              defaultValue={settings.siteTitle}
              required
            />
            <Input
              label="站点图标 (Favicon URL)"
              id="favicon_url"
              name="faviconUrl"
              defaultValue={settings.faviconUrl}
              required
            />
            <Input
              label="众筹核心标题 (首页大字)"
              id="hero_title"
              name="heroTitle"
              defaultValue={settings.heroTitle}
              required
            />
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <a href="/admin/settings" className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            放弃修改
          </a>
          <button type="submit" className="rounded-xl bg-slate-900 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800">
            保存配置
          </button>
        </div>
      </form>
    </div>
  );
}

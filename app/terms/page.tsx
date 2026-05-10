import { getActiveTermsVersion } from "@/src/application/admin";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string | null) {
  if (!value) {
    return "未发布";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

export default async function TermsPage() {
  const activeTerms = await getActiveTermsVersion();

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <div className="border-b border-slate-100 pb-6">
          <p className="text-sm font-medium text-blue-600">政策条款与资金说明</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            {activeTerms?.title ?? "当前暂无生效条款"}
          </h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">
            <span>
              当前版本：{activeTerms?.version ?? "未配置"}
            </span>
            <span>
              生效日期：{formatTimestamp(activeTerms?.publishedAt ?? null)}
            </span>
          </div>
        </div>

        {activeTerms ? (
          <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-slate-600">
            {activeTerms.body}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
            管理端尚未发布条款版本。当前页面会在首个版本生效后自动展示最新公开内容。
          </div>
        )}

        <div className="mt-12 border-t border-slate-100 pt-6 text-xs text-slate-400">
          对外展示内容始终与当前生效版本保持一致。
        </div>
      </div>
    </div>
  );
}

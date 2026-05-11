import { getActiveTermsVersion, listTermsVersions } from "@/src/application/admin";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";
import { Input, Textarea } from "@/src/ui/components";

export const dynamic = "force-dynamic";

function getStatusLabel(status: "DRAFT" | "ACTIVE" | "RETIRED") {
  switch (status) {
    case "ACTIVE":
      return "生效中";
    case "RETIRED":
      return "已停用";
    default:
      return "草稿";
  }
}

function getStatusClasses(status: "DRAFT" | "ACTIVE" | "RETIRED") {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "RETIRED":
      return "bg-slate-100 text-slate-500 border-slate-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "未发布";
  }

  return new Date(value).toLocaleString("zh-CN");
}

export default async function AdminTermsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPageSession();
  const [activeTerms, termsList, resolvedSearchParams] = await Promise.all([
    getActiveTermsVersion(),
    listTermsVersions(),
    searchParams,
  ]);
  const errorParam = resolvedSearchParams.error;
  const showError = typeof errorParam === "string";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">条款版本维护</h1>
          <p className="mt-1 text-sm text-slate-500">
            管理用户协议、隐私政策与退款说明。
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          当前生效：
          <span className="ml-2 font-semibold text-slate-900">
            {activeTerms ? `${activeTerms.version} · ${activeTerms.title}` : "暂无"}
          </span>
        </div>
      </div>

      {showError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          请求参数不完整，请检查版本号、标题和正文。
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">创建新草稿</h2>
        <form action="/api/admin/terms" method="post" className="mt-6 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              label="版本号"
              id="version"
              name="version"
              type="text"
              placeholder="例如 v1.2.0"
              required
            />
            <Input
              label="条款标题"
              id="title"
              name="title"
              type="text"
              placeholder="例如 众筹系统政策条款"
              required
            />
          </div>
          <Textarea
            label="条款正文"
            id="body"
            name="body"
            rows={12}
            placeholder="按行输入协议、政策及退款说明。"
            required
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            保存为草稿
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">版本列表</h2>
        {termsList.items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            暂无条款版本。
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {termsList.items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {item.version}
                      </h3>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(item.status)}`}
                      >
                        {getStatusLabel(item.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {item.title}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-500">
                      {item.body}
                    </p>
                  </div>
                  <div className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 lg:w-64">
                    <p>创建人：{item.createdBy}</p>
                    <p className="mt-2">创建时间：{formatTimestamp(item.createdAt)}</p>
                    <p className="mt-2">发布时间：{formatTimestamp(item.publishedAt)}</p>
                    {item.status !== "ACTIVE" ? (
                      <form action="/api/admin/terms" method="post" className="mt-4">
                        <input type="hidden" name="intent" value="publish" />
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          className="inline-flex w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                        >
                          设为生效版本
                        </button>
                      </form>
                    ) : (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-medium text-emerald-700">
                        当前公开版本
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

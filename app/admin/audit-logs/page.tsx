import { listAuditLogs } from "@/src/application/admin";
import { requireAdminPageSession } from "@/src/infrastructure/auth/session";

export const dynamic = "force-dynamic";

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("zh-CN");
}

function formatSummary(value: Record<string, unknown> | null) {
  if (!value) {
    return "无";
  }

  return JSON.stringify(value);
}

export default async function AdminAuditLogsPage() {
  await requireAdminPageSession();
  const logs = await listAuditLogs({ limit: 100, offset: 0 });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">审计日志</h1>
          <p className="mt-1 text-sm text-slate-500">
            查看系统操作流水记录。
          </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          共计：
          <span className="ml-2 font-semibold text-slate-900">
            {logs.items.length} 条
          </span>
          </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {logs.items.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            暂无审计日志。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">时间</th>
                  <th className="px-5 py-3">动作</th>
                  <th className="px-5 py-3">操作者</th>
                  <th className="px-5 py-3">对象</th>
                  <th className="px-5 py-3">摘要</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.items.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                      {formatTimestamp(log.occurredAt)}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {log.action}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {log.actorType}
                      {log.actorId ? ` · ${log.actorId}` : ""}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {log.targetType}:{log.targetId}
                    </td>
                    <td className="max-w-xl px-5 py-4 text-xs text-slate-500">
                      <p className="break-all">
                        before: {formatSummary(log.beforeSummary)}
                      </p>
                      <p className="mt-1 break-all">
                        after: {formatSummary(log.afterSummary)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

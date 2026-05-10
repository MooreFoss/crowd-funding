export default function AdminDashboard() {
  const stats = [
    { name: "待处理退款", value: "3 笔", color: "text-amber-600" },
    { name: "今日新增赞助", value: "12 笔", color: "text-blue-600" },
    { name: "系统健康度", value: "100%", color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">管理控制台概览</h1>
        <p className="mt-1 text-sm text-slate-500">欢迎回来，管理员。以下是系统当前的关键指标。</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {stats.map((item) => (
          <div key={item.name} className="overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <dt className="truncate text-sm font-medium text-slate-500">{item.name}</dt>
            <dd className={`mt-2 text-3xl font-bold tracking-tight ${item.color}`}>{item.value}</dd>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Quick Actions */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">快速操作</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 p-4 hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-100">
              <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <span className="text-sm font-medium">录入支出</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-2 rounded-lg bg-slate-50 p-4 hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-100">
              <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <span className="text-sm font-medium">更新条款</span>
            </button>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">最近审计日志</h3>
          <ul className="space-y-4">
            <li className="flex gap-4 text-sm">
              <span className="text-slate-400 tabular-nums shrink-0">10:45</span>
              <p className="text-slate-600">管理员 <span className="font-medium text-slate-900">Admin</span> 修改了赞助记录 #1234 的昵称</p>
            </li>
            <li className="flex gap-4 text-sm">
              <span className="text-slate-400 tabular-nums shrink-0">09:12</span>
              <p className="text-slate-600">管理员 <span className="font-medium text-slate-900">Admin</span> 发起了一笔 ¥ 50.00 的退款</p>
            </li>
            <li className="flex gap-4 text-sm">
              <span className="text-slate-400 tabular-nums shrink-0">昨日</span>
              <p className="text-slate-600">系统自动发布了新版本条款 <span className="font-medium text-slate-900">v1.0.2</span></p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

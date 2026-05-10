export default function ExpensesPage() {
  const expenses = [
    { id: 1, title: "服务器租赁费用 - 2026年5月", amount: "1,200.00", description: "阿里云 ECS 实例，用于部署生产环境。", date: "2026-05-05" },
    { id: 2, title: "域名续费", amount: "88.00", description: ".com 域名一年续费。", date: "2026-05-01" },
    { id: 3, title: "CDN 流量包", amount: "500.00", description: "用于加速静态资源分发。", date: "2026-04-20" },
    { id: 4, title: "开源项目赞助", amount: "200.00", description: "向底层依赖的开源项目提供小额资金支持。", date: "2026-04-15" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">支出明细</h1>
          <p className="mt-2 text-sm text-slate-500">
            每一笔资金的去向都清晰可见。我们承诺合理、高效地使用每一份支持。
          </p>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
        {expenses.map((expense) => (
          <div key={expense.id} className="relative rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                {expense.date}
              </span>
              <span className="text-xl font-bold text-slate-900 tabular-nums">¥ {expense.amount}</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{expense.title}</h3>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">{expense.description}</p>
            <div className="mt-6 flex items-center gap-2 text-xs font-medium text-blue-600">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              已核销
            </div>
          </div>
        ))}
      </div>
      
      {/* Policy card */}
      <div className="mt-16 rounded-2xl bg-blue-50 p-8 border border-blue-100">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-600 p-2">
            <svg className="size-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h4 className="text-lg font-bold text-blue-900">关于支出的说明</h4>
            <p className="mt-2 text-sm text-blue-700 leading-relaxed">
              所有的支出记录均由系统管理员手动录入并上传凭证（审计可见）。如果您对某项支出有疑问，欢迎通过官方渠道联系我们。我们致力于建立一个透明、诚信的众筹社区。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

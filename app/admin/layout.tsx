import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigation = [
    { name: "概览", href: "/admin" },
    { name: "赞助管理", href: "/admin/pledges" },
    { name: "支出管理", href: "/admin/expenses" },
    { name: "退款处理", href: "/admin/refunds" },
    { name: "条款维护", href: "/admin/terms" },
    { name: "系统配置", href: "/admin/settings" },
    { name: "审计日志", href: "/admin/audit-logs" },
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px-120px)]">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 bg-white border-r border-slate-200 p-6">
        <nav className="space-y-1">
          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">管理菜单</p>
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              {item.name}
            </Link>
          ))}
          <div className="mt-8 pt-8 border-t border-slate-100">
            <Link
              href="/"
              className="group flex items-center rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              返回用户端
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-10 bg-slate-50/50">
        <div className="mx-auto max-w-5xl">
          {children}
        </div>
      </main>
    </div>
  );
}

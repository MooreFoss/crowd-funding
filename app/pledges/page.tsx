export default function PledgesPage() {
  const pledges = [
    { id: 1, name: "张三", amount: "500.00", message: "支持项目，加油！", date: "2026-05-10", status: "PAID" },
    { id: 2, name: "匿名用户", amount: "1,000.00", message: "", date: "2026-05-09", status: "PARTIAL_REFUNDED" },
    { id: 3, name: "李四", amount: "50.00", message: "一点心意", date: "2026-05-08", status: "PAID" },
    { id: 4, name: "王五", amount: "200.00", message: "非常棒的项目", date: "2026-05-07", status: "PAID" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">众筹记录</h1>
          <p className="mt-2 text-sm text-slate-500">
            所有已支付成功的赞助记录均在此公开。透明度是我们的核心价值。
          </p>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg bg-white">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                      赞助人
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      留言
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900">
                      金额
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900">
                      日期
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {pledges.map((pledge) => (
                    <tr key={pledge.id} className="hover:bg-slate-50 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                        {pledge.name}
                      </td>
                      <td className="px-3 py-4 text-sm text-slate-500 max-w-xs truncate">
                        {pledge.message || <span className="text-slate-300 italic">无留言</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right text-sm font-bold text-slate-900 tabular-nums">
                        <div className="flex flex-col items-end">
                          <span>¥ {pledge.amount}</span>
                          {pledge.status === "PARTIAL_REFUNDED" && (
                            <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                              部分退款
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right text-sm text-slate-500 tabular-nums">
                        {pledge.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      {/* Pagination Placeholder */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-lg shadow-sm">
        <div className="flex flex-1 justify-between sm:hidden">
          <button className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">上一页</button>
          <button className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">下一页</button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-700">
              显示第 <span className="font-medium">1</span> 到 <span className="font-medium">4</span> 条，共 <span className="font-medium">1,280</span> 条记录
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0">
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" /></svg>
              </button>
              <button className="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">1</button>
              <button className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0">2</button>
              <button className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0">3</button>
              <button className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0">
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l4.5-4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

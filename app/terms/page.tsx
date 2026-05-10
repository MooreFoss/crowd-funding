export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="bg-white p-8 sm:p-12 shadow-sm border border-slate-200 rounded-2xl">
        <h1 className="text-3xl font-bold text-slate-900 border-b border-slate-100 pb-6">政策条款与资金说明</h1>
        
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-600" />
              1. 赞助性质说明
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              本系统接受的赞助均为“无回报型赞助”，即用户支付后不对应具体的实物商品、虚拟权益或服务交付。所有的赞助款项将进入公开资金池，用于项目的运营与维护。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-600" />
              2. 资金透明度承诺
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              我们承诺对所有赞助资金的使用保持绝对透明。您可以在“众筹记录”中查看您的赞助状态，在“支出明细”中监督每一笔支出的用途。资金池余额按“有效赞助净额 - 有效支出净额”实时计算。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-600" />
              3. 退款政策
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              由于赞助款项会立即投入项目使用，我们原则上不支持自主退款。但在极端情况下（如误操作、重复支付），您可以联系管理员申请人工审核退款。一旦执行全额退款，对应的众筹记录将从公开列表中移除。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="size-2 rounded-full bg-blue-600" />
              4. 隐私保护
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              我们仅记录支付所需的基础信息。您的昵称与留言将公开展示，若您选择匿名，系统将使用“匿名用户”代称。我们不会向任何第三方出售或泄露您的个人隐私数据。
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
          <span>当前版本: v1.0.2 (2026-05-10 生效)</span>
          <span>© 众筹系统 运营团队</span>
        </div>
      </div>
    </div>
  );
}

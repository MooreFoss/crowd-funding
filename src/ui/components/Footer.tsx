import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">众</span>
            </div>
            <span className="text-lg font-bold text-slate-900">众筹系统</span>
          </div>
          
          <div className="flex gap-8 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-blue-600">用户协议</Link>
            <Link href="/terms" className="hover:text-blue-600">隐私政策</Link>
            <Link href="/terms" className="hover:text-blue-600">退款说明</Link>
          </div>
          
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} 众筹系统. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

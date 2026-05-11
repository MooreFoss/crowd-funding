import Link from "next/link";

type NavbarProps = {
  siteTitle: string;
  faviconUrl: string;
};

function getBrandName(siteTitle: string) {
  return siteTitle.split("-")[0]?.trim() || siteTitle;
}

function getIconBackgroundImage(faviconUrl: string) {
  return `url(${JSON.stringify(faviconUrl)})`;
}

export default function Navbar({ siteTitle, faviconUrl }: NavbarProps) {
  const brandName = getBrandName(siteTitle);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-8 rounded-lg bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: getIconBackgroundImage(faviconUrl),
              }}
            />
            <span className="text-xl font-bold text-slate-900 tracking-tight">
              {brandName}
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
              资金池
            </Link>
            <Link href="/pledges" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
              众筹记录
            </Link>
            <Link href="/expenses" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
              支出明细
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link 
            href="/sponsor" 
            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all active:scale-95"
          >
            立即赞助
          </Link>
        </div>
      </div>
    </nav>
  );
}

import Link from "next/link";

type FooterProps = {
  siteTitle: string;
  faviconUrl: string;
};

function getBrandName(siteTitle: string) {
  return siteTitle.split("-")[0]?.trim() || siteTitle;
}

function getIconBackgroundImage(faviconUrl: string) {
  return `url(${JSON.stringify(faviconUrl)})`;
}

export default function Footer({ siteTitle, faviconUrl }: FooterProps) {
  const brandName = getBrandName(siteTitle);

  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-6 rounded bg-cover bg-center bg-no-repeat"
              style={{
                backgroundImage: getIconBackgroundImage(faviconUrl),
              }}
            />
            <span className="text-lg font-bold text-slate-900">{brandName}</span>
          </div>
          
          <div className="flex gap-8 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-blue-600">用户协议</Link>
            <Link href="/terms" className="hover:text-blue-600">隐私政策</Link>
            <Link href="/terms" className="hover:text-blue-600">退款说明</Link>
          </div>
          
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

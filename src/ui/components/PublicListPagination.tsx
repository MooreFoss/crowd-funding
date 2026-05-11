import Link from "next/link";

import type { PublicPage } from "@/src/application/public";

type PublicListPaginationProps = {
  basePath: string;
  page: PublicPage;
  totalLoaded: number;
};

function createPageHref(basePath: string, pageNumber: number) {
  return `${basePath}?page=${pageNumber}`;
}

export function PublicListPagination({
  basePath,
  page,
  totalLoaded,
}: PublicListPaginationProps) {
  const currentPage = Math.floor(page.offset / page.limit) + 1;
  const previousPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = page.hasMore ? currentPage + 1 : null;
  const firstItem = totalLoaded === 0 ? 0 : page.offset + 1;
  const lastItem = page.offset + totalLoaded;
  const buttonBaseClass =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition";
  const enabledButtonClass =
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  const disabledButtonClass =
    "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400";

  return (
    <nav
      aria-label="列表分页"
      className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-medium text-slate-900">
          第 {currentPage} 页
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {totalLoaded > 0
            ? `当前显示第 ${firstItem} 至 ${lastItem} 条记录`
            : "当前页暂无记录"}
          {page.hasMore ? "，可继续加载下一页。" : "，已显示当前页全部记录。"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={basePath}
          className={`${buttonBaseClass} ${enabledButtonClass}`}
        >
          刷新列表
        </Link>
        {previousPage ? (
          <Link
            href={createPageHref(basePath, previousPage)}
            className={`${buttonBaseClass} ${enabledButtonClass}`}
          >
            上一页
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${buttonBaseClass} ${disabledButtonClass}`}
          >
            上一页
          </span>
        )}
        {nextPage ? (
          <Link
            href={createPageHref(basePath, nextPage)}
            className={`${buttonBaseClass} border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
          >
            下一页
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${buttonBaseClass} ${disabledButtonClass}`}
          >
            下一页
          </span>
        )}
      </div>
    </nav>
  );
}

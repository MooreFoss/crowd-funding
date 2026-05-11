"use client";

import { useEffect, useMemo } from "react";

type MiniProgramJumpClientProps = {
  urlLink: string;
  urlScheme: string;
  miniProgramPath: string;
};

export function MiniProgramJumpClient({
  urlLink,
  urlScheme,
  miniProgramPath,
}: MiniProgramJumpClientProps) {
  const targetUrl = useMemo(() => urlLink || urlScheme, [urlLink, urlScheme]);

  useEffect(() => {
    if (!targetUrl) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.location.href = targetUrl;
    }, 300);

    return () => window.clearTimeout(timer);
  }, [targetUrl]);

  return (
    <div className="mx-auto flex max-w-2xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-blue-600">微信小程序赞助</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          打开小程序继续支付
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          手机端赞助将进入小程序，由小程序调用微信支付。
        </p>

        {targetUrl ? (
          <a
            href={targetUrl}
            className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
          >
            打开小程序
          </a>
        ) : (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            小程序跳转链接尚未配置，请稍后再试。
          </div>
        )}

        <p className="mt-5 break-all text-xs text-slate-400">
          目标路径：{miniProgramPath}
        </p>
      </section>
    </div>
  );
}

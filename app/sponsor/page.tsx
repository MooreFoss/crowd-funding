import { getActiveTermsVersion } from "@/src/application/admin";
import { getSummary } from "@/src/application/public";

import { SponsorEntryClient } from "./SponsorEntryClient";

export const dynamic = "force-dynamic";

export default async function SponsorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [activeTerms, summary] = await Promise.all([
    getActiveTermsVersion(),
    getSummary(),
  ]);
  const resolvedSearchParams = await searchParams;
  const errorParam = resolvedSearchParams.error;
  const error = typeof errorParam === "string" ? errorParam : null;
  const sponsorshipClosed = !summary.canSponsor;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          发起赞助
        </h1>
        <p className="mt-4 text-lg text-slate-500">
          感谢支持。赞助将用于项目的建设与维护。
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {sponsorshipClosed ? (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          众筹已结束，暂停接收新赞助。
        </div>
      ) : null}

      <SponsorEntryClient
        activeTermsLabel={
          activeTerms
            ? `${activeTerms.version} · ${activeTerms.title}`
            : "暂无生效条款"
        }
        sponsorshipClosed={sponsorshipClosed}
      />
    </div>
  );
}

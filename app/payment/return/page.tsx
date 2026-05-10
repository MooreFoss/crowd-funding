import { cookies } from "next/headers";

import { LAST_SPONSOR_ORDER_COOKIE_NAME } from "@/src/application/payments";

import { PaymentReturnStatus } from "./PaymentReturnStatus";

export const dynamic = "force-dynamic";

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cookieStore = await cookies();
  const resolvedSearchParams = await searchParams;
  const merchantOrderNoParam = resolvedSearchParams.merchantOrderNo;
  const merchantOrderNoFromQuery =
    typeof merchantOrderNoParam === "string" ? merchantOrderNoParam : null;
  const merchantOrderNo =
    merchantOrderNoFromQuery ??
    cookieStore.get(LAST_SPONSOR_ORDER_COOKIE_NAME)?.value ??
    null;

  return (
    <div className="mx-auto flex max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      {merchantOrderNo ? (
        <PaymentReturnStatus merchantOrderNo={merchantOrderNo} />
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">处理中</h1>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            未找到可查询的订单，请返回赞助页重新发起。
          </p>
        </div>
      )}
    </div>
  );
}

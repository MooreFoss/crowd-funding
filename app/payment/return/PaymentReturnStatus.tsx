"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SponsorOrderStatus = {
  merchantOrderNo: string;
  status: string;
  statusLabel: string;
  paymentRedirectUrl: string | null;
};

const FINAL_STATUSES = new Set(["PAID", "CANCELLED", "FAILED"]);

export function PaymentReturnStatus({
  merchantOrderNo,
}: {
  merchantOrderNo: string;
}) {
  const [order, setOrder] = useState<SponsorOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const response = await fetch(`/api/public/orders/${merchantOrderNo}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("暂时无法确认订单状态。");
        }

        const nextOrder = (await response.json()) as SponsorOrderStatus;

        if (cancelled) {
          return;
        }

        setOrder(nextOrder);
        setError(null);

        if (!FINAL_STATUSES.has(nextOrder.status)) {
          timer = setTimeout(poll, 1500);
        }
      } catch (nextError) {
        if (cancelled) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "暂时无法确认订单状态。",
        );
      }
    };

    void poll();

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [merchantOrderNo]);

  const description = useMemo(() => {
    if (error) {
      return error;
    }

    if (!order || !FINAL_STATUSES.has(order.status)) {
      return "我们正在等待支付平台返回最终确认，请勿重复创建订单。";
    }

    if (order.status === "PAID") {
      return "支付已确认成功，资金池与公开记录会自动同步。";
    }

    if (order.status === "CANCELLED") {
      return "支付已取消。您可以返回赞助页重新发起。";
    }

    return "支付未成功完成。您可以返回赞助页重新尝试。";
  }, [error, order]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="text-center">
        <p className="text-sm font-medium text-blue-600">支付状态回显</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          {order?.statusLabel ?? "处理中"}
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-500">{description}</p>
        <p className="mt-4 text-xs text-slate-400">
          商户订单号：{merchantOrderNo}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          返回首页
        </Link>
        {order?.status !== "PAID" ? (
          <Link
            href="/sponsor"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            返回赞助页
          </Link>
        ) : null}
      </div>
    </div>
  );
}

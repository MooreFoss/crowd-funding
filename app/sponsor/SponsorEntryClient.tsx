"use client";

import { FormEvent, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { Input, Textarea } from "@/src/ui/components";

type NativeOrderResponse = {
  merchantOrderNo: string;
  amountFen: number;
  status: "PAYING";
  codeUrl: string;
};

type SponsorEntryClientProps = {
  activeTermsLabel: string;
  sponsorshipClosed: boolean;
};

function isMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(
    navigator.userAgent,
  );
}

function buildJumpUrl(formData: FormData) {
  const query = new URLSearchParams();
  const amount = String(formData.get("amount") ?? "");
  const message = String(formData.get("message") ?? "");

  if (amount) {
    query.set("amount", amount);
  }

  if (message) {
    query.set("message", message);
  }

  const queryString = query.toString();

  return queryString
    ? `/sponsor/mini-program-jump?${queryString}`
    : "/sponsor/mini-program-jump";
}

export function SponsorEntryClient({
  activeTermsLabel,
  sponsorshipClosed,
}: SponsorEntryClientProps) {
  const [nativeOrder, setNativeOrder] = useState<NativeOrderResponse | null>(
    null,
  );
  const [statusLabel, setStatusLabel] = useState("等待支付");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canRenderQrCode = useMemo(() => Boolean(nativeOrder?.codeUrl), [nativeOrder?.codeUrl]);

  async function pollOrder(merchantOrderNo: string) {
    const response = await fetch(`/api/public/orders/${merchantOrderNo}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("状态确认中...");
    }

    const order = (await response.json()) as { status: string; statusLabel: string };
    setStatusLabel(order.statusLabel);

    if (order.status === "PAID") {
      return;
    }

    if (!["FAILED", "CANCELLED"].includes(order.status)) {
      window.setTimeout(() => {
        void pollOrder(merchantOrderNo).catch((nextError) => {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "状态确认中...",
          );
        });
      }, 1500);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (isMobileBrowser()) {
      window.location.href = buildJumpUrl(formData);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sponsorship/native-orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: formData.get("amount"),
          displayName: formData.get("displayName"),
          message: formData.get("message"),
          termsAccepted: formData.get("termsAccepted") === "on",
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? "创建订单失败");
      }

      setNativeOrder(body);
      setStatusLabel("等待支付");
      void pollOrder(body.merchantOrderNo);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "创建订单失败",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-12 space-y-8">
      <form
        onSubmit={handleSubmit}
        className="space-y-8 rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200"
      >
        <div className="space-y-6">
          <Input
            label="赞助金额 (¥)"
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue="10"
            placeholder="10.00"
            required
          />
          <Input
            label="展示昵称"
            type="text"
            name="displayName"
            id="nickname"
            placeholder="匿名用户"
          />
          <Textarea
            label="留言"
            id="message"
            name="message"
            rows={3}
            placeholder="说点什么？"
          />
          <div className="flex items-start">
            <div className="flex h-5 items-center">
              <input
                id="terms"
                name="termsAccepted"
                type="checkbox"
                required
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="font-medium text-slate-700">
                同意{" "}
                <a href="/terms" className="text-blue-600 underline">
                  用户协议
                </a>{" "}
                与{" "}
                <a href="/terms" className="text-blue-600 underline">
                  隐私政策
                </a>
              </label>
              <p className="mt-1 text-xs text-slate-400">
                生效版本：
                <span className="ml-1 text-slate-600">
                  {activeTermsLabel}
                </span>
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={sponsorshipClosed || submitting}
          className="flex w-full items-center justify-center rounded-full bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          {sponsorshipClosed
            ? "众筹已结束"
            : submitting
              ? "正在创建订单"
              : "去支付"}
        </button>
      </form>

      {nativeOrder ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid gap-6 sm:grid-cols-[240px_1fr] sm:items-center">
            <div className="flex size-60 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              {canRenderQrCode && nativeOrder ? (
                <QRCodeSVG
                  value={nativeOrder.codeUrl}
                  title="微信支付二维码"
                  size={220}
                  marginSize={2}
                />
              ) : null}
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-600">
                微信支付二维码
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {statusLabel}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                请扫码支付，结果将自动同步。
              </p>
              <p className="mt-4 text-xs text-slate-400">
                单号：{nativeOrder.merchantOrderNo}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

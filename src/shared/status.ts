export const STATUS_LABELS = {
  PENDING: "待支付",
  PAYING: "支付中",
  PAID: "支付成功",
  CANCELLED: "用户取消支付",
  FAILED: "支付失败",
  PARTIAL_REFUNDED: "已部分退款",
  REFUNDED: "已全额退款",
  CLOSED: "已关闭",
  CREATED: "已创建",
  PROCESSING: "处理中",
  SUCCEEDED: "退款成功",
  REFUND_CLOSED: "退款关闭",
  EXCEPTION: "退款异常",
  PENDING_REVIEW: "待审核",
  APPROVED: "审核通过",
  REJECTED: "审核拒绝",
  REVIEW_ERROR: "审核异常",
  ACTIVE: "进行中",
  CLOSING: "关闭中",
  REFUNDING: "退款处理中",
  ENDED: "已结束",
  SETTLED: "已结束且已结算",
} as const;

export type SharedStatus = keyof typeof STATUS_LABELS;

export function getStatusLabel(status: string) {
  return STATUS_LABELS[status as SharedStatus] ?? status;
}

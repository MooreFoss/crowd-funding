export const STATUS_LABELS = {
  PENDING: "待支付",
  PAYING: "支付中",
  PAID: "支付成功",
  CANCELLED: "已取消",
  FAILED: "支付失败",
  PARTIAL_REFUNDED: "部分退款",
  REFUNDED: "已退款",
  CLOSED: "已关闭",
  CREATED: "处理中",
  PROCESSING: "处理中",
  SUCCEEDED: "退款成功",
  REFUND_CLOSED: "退款结束",
  EXCEPTION: "状态异常",
  PENDING_REVIEW: "待审核",
  APPROVED: "审核通过",
  REJECTED: "已拒绝",
  REVIEW_ERROR: "审核异常",
  ACTIVE: "进行中",
  CLOSING: "结算中",
  REFUNDING: "退款中",
  ENDED: "已结束",
  SETTLED: "已结算",
} as const;

export type SharedStatus = keyof typeof STATUS_LABELS;

export function getStatusLabel(status: string) {
  return STATUS_LABELS[status as SharedStatus] ?? status;
}

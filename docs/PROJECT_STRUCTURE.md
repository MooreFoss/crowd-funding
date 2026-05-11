# 项目骨架说明

本项目按 `docs/SRS.md` 的首期范围实现单活动众筹生命周期：公开展示、微信官方支付、腾讯云 TMS 审核、支出凭证、退款、关停结算和审计。

## 路由层

- `app/page.tsx`：用户端资金池总览入口。
- `app/pledges/page.tsx`：用户端公开众筹记录入口。
- `app/expenses/page.tsx`：用户端公开支出记录入口。
- `app/sponsor/page.tsx`：用户端发起赞助入口。
- `app/terms/page.tsx`：用户端生效条款入口。
- `app/admin/**`：管理端赞助、退款、支出、条款与审计入口。
- `app/api/**`：用户端、管理端、支付通知、退款通知和证据上传 URL 的 API 边界。

## 业务分层

- `src/domain/**`：领域模型、领域规则、状态模型和仓储接口。
- `src/application/**`：用户端、管理端、支付、退款、关停和审核应用用例。
- `src/infrastructure/**`：鉴权、持久化、微信支付、腾讯云 TMS、MinIO、审计等外部依赖适配层。
- `src/infrastructure/persistence/client.ts`：PostgreSQL 连接池入口，从服务端环境变量读取 `DATABASE_URL`。
- `src/infrastructure/persistence/migrations/**`：数据库迁移，按文件名顺序执行。
- `src/infrastructure/payments/wechatPay.ts`：微信支付 API v3 签名、JSAPI、Native、查单、退款和通知解密适配器。
- `src/infrastructure/payments/zpay.ts`：历史 ZPAY 兼容适配器，不是默认生产赞助路径。
- `src/infrastructure/moderation/tencentTms.ts`：腾讯云 TMS 文本审核适配器。
- `src/infrastructure/storage/minio.ts`：MinIO/S3 兼容凭证图片上传 URL 适配器。
- `src/infrastructure/audit/logger.ts`：审计事件写入入口。
- `src/validation/**`：表单、请求参数和回调载荷校验的预留位置。
- `src/ui/**`：页面组件和展示层组件。
- `src/server/**`：服务端 HTTP 工具和路由共享基础设施。
- `src/config/**`：路由、功能开关、运行配置等项目配置。
- `src/config/env.ts`：集中校验服务端环境变量，覆盖数据库、管理员认证、微信支付、腾讯云 TMS、MinIO 和公开静态资源基地址。
- `src/shared/**`：跨层共享的非业务工具。
- `src/shared/money.ts`：金额解析与人民币格式化工具，统一使用“分”为内部单位。
- `src/shared/status.ts`：支付、退款、审核、众筹活动等常见状态码到中文标签的共享映射。
- `src/shared/index.ts`：共享工具的统一导出入口。

## 测试目录

- `tests/unit`：领域规则、纯函数和用例级单元测试。
- `tests/integration`：API、持久化、支付适配等集成测试。
- `tests/e2e`：用户端和管理端关键流程端到端测试。
- `vitest.config.ts`：Vitest 单元/集成测试基础配置。
- `playwright.config.ts`：Playwright 端到端测试基础配置。

## 后续实现原则

1. 金额始终以“分”为内部单位，展示层再格式化为人民币。
2. 资金池余额必须从赞助、退款、支出明细反推。
3. 支付与退款结果处理必须幂等。
4. 公开展示信息与财务审计信息分离。
5. 管理端能力必须先通过认证与权限校验。
6. 真实数据库连接串仅放在 `.env.local` 或部署平台私密环境变量中，`.env.example` 只保留占位模板。
7. 所有支付、退款、审核、众筹活动状态文案应复用 `src/shared/status.ts`，避免页面与 API 各自维护标签。

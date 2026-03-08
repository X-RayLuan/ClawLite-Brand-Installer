# ClawLite MVP 实现清单（v0）

> 目标：先把 **可用闭环** 做出来（引导安装 → 采集最小漏斗数据 → 留存联系方式），后续再扩展分析和自动化。

## 1) 前端组件（Renderer）

### P0（本轮）
- [ ] `MvpFunnelTracker`（无 UI / hook）
  - 在关键步骤切换时上报事件（welcome / envCheck / install / config / done）
  - 自动带上 `sessionId`、`platform`、`appVersion`
- [ ] `MvpLeadCaptureCard`（Done 页）
  - 采集 email + source（默认 `installer_done`）
  - 成功/失败反馈
- [ ] `MvpDebugBadge`（仅 DEV 显示）
  - 展示当前 `sessionId` 和最近一次上报状态

### P1（下轮）
- [ ] 失败重试队列（本地缓存，重启后补发）
- [ ] 事件批量上报（降低请求数）

---

## 2) 后端路由（Vercel API）

### P0（本轮）
- [x] `POST /api/mvp-session`
  - 创建/更新会话元数据（session 级别）
- [x] `POST /api/mvp-event`
  - 接收漏斗事件（event 级别）
- [ ] `GET /api/mvp-session?sessionId=...`（内部调试）

### P1（下轮）
- [ ] `GET /api/mvp-report?from=...&to=...` 聚合报表
- [ ] 基础防刷（rate limit + 简单签名）

---

## 3) 数据结构（Shared Schema）

### 会话 `MvpSessionRecord`
- `sessionId: string`（主键）
- `platform: 'macos' | 'windows' | 'linux' | 'unknown'`
- `appVersion: string`
- `createdAt: string`
- `updatedAt: string`
- `source?: string`

### 事件 `MvpEventRecord`
- `id: string`
- `sessionId: string`
- `eventType: 'step_view' | 'step_complete' | 'lead_submit' | 'install_start' | 'install_done' | 'error'`
- `step?: 'welcome' | 'envCheck' | 'wslSetup' | 'install' | 'apiKeyGuide' | 'telegramGuide' | 'config' | 'done' | 'troubleshoot'`
- `payload?: Record<string, unknown>`
- `createdAt: string`

### 线索 `MvpLeadRecord`
- `email: string`
- `sessionId?: string`
- `source: string`
- `createdAt: string`

---

## 4) 验收标准（MVP Done）
- [ ] 新用户完成一次安装流程后，后台能看到至少 1 条 session + 多条事件。
- [ ] Done 页提交邮箱可成功写入（幂等去重）。
- [ ] 错误日志可定位到 `sessionId`。
- [ ] 对现有安装流程无阻断（失败时静默降级）。

---

## 5) 当前进度（2026-03-09）
- 已落地：
  - [x] 后端路由骨架：`/api/mvp-session`、`/api/mvp-event`
  - [x] 共享类型：`src/shared/mvp/types.ts`
- 进行中：
  - [ ] 前端 tracker/hook 接入

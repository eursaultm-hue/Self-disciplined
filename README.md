# Personal Learning OS — V0.1

一个单用户、浏览器本地持久化的个人学习操作系统最小版本，支持：长期目标、课程、固定课程表、任务优先级、每日计划、学习记录和每日复盘。

## 核心循环

`目标 → 计划 → 执行 → 记录 → 复盘 → 调整下一天计划`

## 运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。数据保存在当前浏览器的 `localStorage`（键为 `personal-learning-os-v01`）；清除站点数据会清除本地学习数据。

## 计划规则

每日计划从可用分钟数中扣减固定课程表时段，再按 MUST / SHOULD / COULD、目标与课程优先级，以及是否逾期或到期进行排序。计划不会超出当天剩余容量。

## V0.1 边界

本版本刻意不含认证、云同步、RAG、向量数据库、多 Agent、知识图谱、原生移动端和复杂仪表盘。下一阶段可将 `lib/domain.ts` 中的实体迁移到 Prisma/SQLite 或 PostgreSQL。

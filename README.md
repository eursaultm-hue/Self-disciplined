# Personal Learning OS — V0.1.1

一个单用户、浏览器本地持久化的个人学习操作系统版本，支持长期目标、课程、固定课程表、任务优先级、每日计划、学习记录和每日复盘。

## 核心循环

目标 → 计划 → 执行 → 记录 → 复盘 → 调整下一天计划

## 当前版本与数据安全

- 当前应用版本：0.1.1
- Android Application ID：com.eursaultm.selfdisciplined
- 本地学习数据继续使用 personal-learning-os-v01 这个 storage key。
- 数据增加 schema version 与迁移层，为后续数据结构升级做准备。
- 正常 Android 覆盖安装要保留数据，必须保持相同 Application ID、递增的 versionCode，并使用同一个发布签名密钥。
- 当前仓库提供 Android debug 构建流程，但 debug APK 仅用于开发测试，不能把不同构建机器生成的 debug APK 当作长期升级包。

## 运行

npm install
npm run dev

打开 http://localhost:3000。数据保存在当前浏览器的 localStorage；清除站点数据会清除本地学习数据。

## Android 构建

GitHub Actions 会在手动触发或推送 v* 标签时构建 debug APK。

版本号来源于 package.json。构建脚本会把 SemVer 映射为 Android versionCode：

X.Y.Z → X×1,000,000 + Y×1,000 + Z

正式发布前，需要配置固定的 Android release keystore 与 GitHub Secrets，然后把构建流程切换为 release 签名 APK。

## 计划规则

每日计划从可用分钟数中扣减固定课程表时段，再按 MUST / SHOULD / COULD、目标与课程优先级，以及是否逾期或到期进行排序。计划不会超出当天剩余容量。

## V0.1.x 边界

当前阶段重点是把能运行的网页原型变成可持续迭代、可安全升级的 Android 应用基础设施。

暂不包含认证、云同步、RAG、向量数据库、多 Agent、知识图谱和复杂仪表盘。后续可逐步迁移到更可靠的本地数据库或云端同步架构。

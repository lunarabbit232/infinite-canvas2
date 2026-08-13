---
title: 待测试
description: 当前版本已实现但仍需人工验证的变更项
---

# 待测试

- [ ] **知识库 RAG 关键词检索**：三个 Agent（导演/编剧/执行词）调用 `SearchRoleKnowledge` 按用户 prompt 关键词匹配知识条目，不再全量注入。知识条目新增 `Keywords` 字段。`BuildKnowledgeContext` 限制最多 5 条。
- [ ] **导演 Agent 增强**：JSON 输出新增 `lighting`、`continuity` 字段，系统 Prompt 扩展了景别递进、焦距范围、光线情绪等知识要点。
- [ ] **编剧 Agent 增强**：默认模式 JSON 新增 `emotionalArc`、场景 `atmosphere`、镜头 `lighting`/`continuity` 字段，Prompt 加入情绪弧线和具体描述规则。
- [ ] **执行词 Agent 增强**：JSON 新增 `overview`、`tips` 字段，Prompt 扩展了变量填写说明和避坑建议规则。修复了 RAG 调用顺序 bug。
- [ ] **前端参考图标签**：`image-reference-prompt.ts` 新增 `imageReferenceDescriptiveLabel`，有 name 时显示 `图片1(角色正面)` 格式。
- [ ] **前端模型能力配置**：`video-model-capabilities.ts` 重构为数据驱动（Set + 数组匹配），新增模型无需改函数逻辑。
- [ ] **CLIP 图片理解（基础设施）**：Python 依赖已安装（torch CPU + transformers + pillow），Go 端 `ImageEmbedding` / `InterrogateImageBytes` / `PickBestCharacterRef` / `CheckCharacterConsistency` 已实现，CLIP 模型下载后即可用。
- [ ] **Agent 闭环串联**：编剧 Agent 生成分镜后支持「导演细化」（逐场景注入运镜/光线/衔接）、「生成画布分镜」（自动建 Image 节点+场景标签+连线）、「生成执行词」（调用执行词 Agent）、「Director Cut」（全链路自动：导演细化+执行词一步到位）。`canvas-client-page.tsx` 新增 `handleApplyStoryboardScenes` 处理画布节点批量创建。

- [ ] **P1.1-1 生图结果一键送入视频生成台**：画布右键图片节点 → "在视频台打开" → 视频页自动导入为参考图（提示"已从画布导入参考图"）。传参：`sourceCanvas`、`sourceNode`。

- [ ] **P1.1-1 生图结果一键送入视频生成台**：画布右键图片节点 → "在视频台打开" → 视频页自动导入为参考图（提示"已从画布导入参考图"）。传参：`sourceCanvas`、`sourceNode`。
- [ ] **P1.1-2 连线自动映射**：连线图片节点到视频/Config节点 → 视频设置弹窗下拉列表即时出现该图片；生成时自动作为参考图。
- [ ] **画布连线驱动-端口区分**：`POST /api/v1/canvas/projects/resolve-edges` 接口 — 传入 projectId + 视频节点 ID → 返回连线图片节点的 ImageURL，按 targetHandle 区分 firstFrame / lastFrame / reference 端口类型。
- [ ] **P1.1-3 多图序列转视频**：画布视频设置→KlingV3→"自动填充图片"将连线图片转元素列表。视频创作台→Kling工作区→"自动填充参考图到元素列表"将参考图转元素列表+分镜提示词。
- [ ] **P1.1-4 首尾帧自动回填**：Config节点设置首/尾帧后执行视频生成 → 连接到该Config的Video节点自动同步首尾帧设置。
- [ ] **P1.2-1 人物库上传**：`/characters` 页面新建/编辑角色 → 封面上传 → 多张参考图上传（最多9张）→ 保存成功。连线角色节点到生成节点 → 提示词模板和参考图自动注入。
- [ ] **P1.3-1 视频任务队列面板**：画布中有生成中的视频节点 → 右上角出现"视频任务(N)"面板 → 显示每个任务的进度、阶段标签、耗时 → 点击跳转到对应节点。
- [ ] **P1.3-3 视频连续播放**：连线两个有内容的视频节点（A→B）→ 播放A到结束 → 自动播放B。
- [ ] **P2.1-1 视频创作工作流模板**：`/workflows` 页面 → 新建工作流 → 选"单视频生成"模式 → 配置视频模型/秒数/分辨率 → 填变量 → 生成视频 → 自动轮询完成。
- [ ] **P3.1-1 视频台全屏**：`/video` → 点工具栏"全屏"→ 工作台铺满视口 → "退出全屏"恢复。
- [ ] **P3.1-2+3 时间轴分镜编辑器**：Kling V3 启用多镜头→"分镜编辑器"面板→时间轴拖拽排序→点击分镜卡片展开编辑 prompt+时长。
- [ ] **视频任务取消**：画布任务队列面板点 Stop 按钮 / 视频创作台生成中卡片点 Stop → 任务标记为已取消，客户端停止轮询。
- [ ] **条件分支工作流**：`POST /api/workflows/evaluate-branch` — 传入 workflowData（含 conditions 字段）+ stepId + result → 根据 result.status 返回下一步 branch 和 nextStepId。
- [ ] **角色三视图生成**：`POST /api/v1/characters/generate-views` — 输入角色名称+描述+性别+风格 → 返回正面/侧面/背面三个生图 prompt。
- [ ] **场景生成**：`POST /api/v1/scenes/generate` — 输入场景描述+画风+尺寸 → 返回生图 prompt。
- [ ] **全景场景生成**：`POST /api/v1/scenes/generate-panorama` — 输入场景描述+画风+角度数 → 返回 8 个方向的全景 prompt。
- [ ] **人物漂移抑制剂 - 角色锚定注入**：画布生成请求携带 `characterIds` 字段 → 后端在转发 AI 请求前自动从角色库读取 promptTemplate 拼接锚定文本，注入到请求的 prompt 字段；参考图 URL 收集后一并注入。视频/图片生成 API 请求携带 `X-Character-IDs` header → 后端同样注入角色锚定。
- [ ] **角色链师徒系统**：`POST /api/v1/roles/mentor` 设导师 → `GET /api/v1/roles/chain` 查导师 → `GET /api/v1/roles/mentees` 查学员 → 个人知识库 CRUD 带 visibility 控制。Agent 调用时沿 mentor 链收集知识。

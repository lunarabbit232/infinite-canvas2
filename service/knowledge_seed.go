package service

import (
	"github.com/tigerowo/infinite-canvas/logger"
	"log"

	"github.com/tigerowo/infinite-canvas/model"
	"github.com/tigerowo/infinite-canvas/repository"
)

func SeedKnowledgeBase() {
	entries, err := repository.ListKnowledgeEntries("")
	if err != nil || len(entries) > 0 {
		return
	}
	seeds := []model.KnowledgeEntry{
		// --- 编剧 Agent ---
		{Category: "storyboard", Title: "三幕剧结构", Keywords: "三幕 结构 建置 对抗 解决 高潮 剧本 编剧 故事", Content: "第一幕（建置）：介绍主角、世界观、核心冲突的引子。目标是让观众在 10 分钟内知道「谁、在哪、要干什么」。\n\n第二幕（对抗）：冲突不断升级，主角主动或被动采取行动，每个场景都应该推动剧情或揭示性格。可以用「但是/因此」规则检查因果链——上一个场景的「因此」是下一个场景的「但是」。\n\n第三幕（解决）：高潮→转折→收束。高潮是主角做出决定性选择的关键时刻，必须由前两幕铺垫而来。收束不宜过长，点到为止。"},
		{Category: "storyboard", Title: "「但是/因此」因果链", Keywords: "因果 但是 因此 场景 连接 剧情 驱动", Content: "每个场景之间必须用「因此」或「但是」连接，严禁用「然后」。\n\n例：主角收到威胁信 → 因此他报警 → 但是警察不信他 → 因此他决定自己调查 → 但是线索指向他的上司 → 因此他陷入两难。\n\n这条规则是检验剧情驱动力的最有效工具。"},
		{Category: "storyboard", Title: "角色弧线设计", Keywords: "角色弧线 成长 缺陷 转变 抉择 性格 剧本", Content: "每个主要角色应该有清晰的成长轨迹：\n\n1. 内在缺陷（want vs need）：角色想要什么（表面目标）vs 真正需要什么（内在成长）\n2. 触发事件：迫使角色走出舒适区\n3. 渐进改变：每场戏推动一点点改变，不要在结尾突然转折\n4. 高潮抉择：让角色做出「两难」选择——两边都要付出代价\n5. 最终状态：角色学到了什么？他和故事开头最大的不同在哪？"},
		{Category: "storyboard", Title: "短剧节奏控制", Keywords: "短剧 节奏 钩子 反转 信息密度 情绪 曲线 时长", Content: "短剧（每集 1-3 分钟）的节奏要点：\n\n1. 钩子前置：每集开头 5 秒内必须有冲突或悬念\n2. 单集闭环：每集制造一个问题并解决/悬置，但至少推进一个情节节点\n3. 结尾反转：每集最后一句台词/最后一个画面必须有反转或悬念\n4. 信息密度：对话不要废话，每句话都必须推进剧情或揭示性格\n5. 情绪曲线：1 集内至少有 2 次情绪起伏（紧张→缓和→再紧张）"},
		{Category: "storyboard", Title: "分镜脚本格式", Keywords: "分镜 脚本 格式 镜号 景别 画面 描述 对白 时长", Content: "标准分镜脚本每行包含以下字段：\n\n| 镜号 | 景别 | 机位/角度 | 运镜 | 画面描述 | 对白/旁白 | 时长(s) | 备注 |\n\n画面描述要点：\n- 用动词开头：推、拉、摇、切、淡入\n- 写明主体+动作+情绪：如「女主（惊恐）猛然回头，看向门的方向」\n- 环境一笔带过：如「深夜/雨/路灯昏黄」"},
		{Category: "storyboard", Title: "角色入场原则", Keywords: "角色 入场 出场 身份 性格 功能 第一印象", Content: "每个重要角色首次出场要交代三样信息：\n\n1. 身份信号：视觉或台词暗示他是谁（如穿白大褂→医生）\n2. 性格切片：一个动作或一句台词立住人设（如沉默寡言者只说了三个字「我从不」）\n3. 功能预告：暗示他在故事里将扮演什么角色（盟友/对手/导师/变量）\n\n反例：「一个穿西装的男人走进来」→ 信息为零。正例：「一个左袖空空的退伍军人推开酒吧门，环视一圈后在角落坐下，背靠墙壁。」"},

		// --- 导演 Agent ---
		{Category: "director", Title: "景别选择速查", Keywords: "景别 远景 全景 中景 近景 特写 大特写 递进", Content: "大远景：交代地理环境、时代背景。适合开场和转场。\n全景：人物全身+环境关系。适合动作戏和群体戏。\n中景：膝盖以上。叙事主力景别，适合对话和日常动作。\n近景：胸部以上。强调表情和情绪，适合关键台词和情感爆点。\n特写：面部或物体细节。适合揭示内心、强调关键道具、制造张力。\n\n递进原则：同一场景内的景别应从大到小递进（全景→中景→近景→特写），让观众逐步深入。"},
		{Category: "director", Title: "180度轴线规则", Keywords: "轴线 越轴 对话 空间 方向 机位", Content: "两人对话场景的铁律：在两人之间画一条虚拟轴线，所有机位必须在轴线同一侧。\n\n作用：保证A在画面左边、B在画面右边，观众不会产生空间混乱。\n\n破例时机：\n- 角色移动跨越轴线（如起身走到对方身边）→ 此时可以越轴\n- 插入中性镜头（如角色手中的物体特写）→ 越轴过渡\n- 主观镜头（角色看到的画面）→ 不受轴线限制\n- 故意越轴制造不安感 → 恐怖片/心理惊悚常用"},
		{Category: "director", Title: "运镜语言词典", Keywords: "运镜 推拉摇移 跟拍 手持 升降 镜头 运动", Content: "推（Dolly In）：镜头向前推进。从环境聚焦到主体，强调「注意这里」。\n拉（Dolly Out）：镜头向后拉开。从主体揭示环境，强调「原来如此」。\n摇（Pan）：水平旋转。交代空间范围，常用于跟拍行进中的角色。\n移（Truck）：横向平移。适合展现并列关系或追逐戏。\n跟（Tracking）：跟随主体移动。强临场感，观众与角色同步。\n升/降（Boom）：垂直运动。上升→揭示规模/俯瞰，下降→进入/压迫。\n手持（Handheld）：抖动画面。紧张/混乱/纪实感。\n静态（Static）：固定机位。客观/冷静/让表演说话。"},
		{Category: "director", Title: "焦距的美学含义", Keywords: "焦距 广角 标准 长焦 超长焦 镜头 空间 压缩", Content: "广角（14-35mm）：\n- 夸张前景、压缩后景，制造空间纵深感\n- 适合展现环境、群戏、动作场面\n- 近拍人物会产生扭曲（鼻子变大）→ 可用于表达角色精神状态异常\n\n标准（35-70mm）：\n- 最接近人眼视角，自然、平实\n- 适合叙事性对话、日常场景\n\n长焦（85-200mm）：\n- 压缩空间，拉近主体与背景距离\n- 适合肖像、偷窥视角、孤立感\n- 浅景深突出主体，背景虚化为色块\n\n超长焦（200mm+）：\n- 极致压缩，画面扁平如画\n- 适合远景中的孤独感、偷拍/监视感"},
		{Category: "director", Title: "光影情绪表", Keywords: "光线 打光 照明 光影 高调 低调 逆光 侧光 底光 暖光 冷光 情绪 色调", Content: "高调光（High Key）：明亮、低反差。适合喜剧、爱情、广告。\n低调光（Low Key）：昏暗、高反差。适合悬疑、恐怖、黑色电影。\n侧光：一半脸亮一半脸暗。矛盾、隐藏、双重人格。\n逆光：主体背对光源。剪影→神秘感；轮廓光→神圣/浪漫。\n底光：光源从下往上打。反常/恐怖/反派专属。\n顶光：光源正上方。压抑/审讯/孤独。\n暖光（2700-3500K）：温馨/怀旧/浪漫（日落、烛光、钨丝灯）。\n冷光（5000-6500K）：疏离/科技/紧张（阴天、荧光灯、月光）。\n\n调色方向：暖色推进情，冷色推剧情。"},
		{Category: "director", Title: "构图七法", Keywords: "构图 三分法 引导线 对称 框架 负空间 前景 头顶空间", Content: "1. 三分法：主体放在网格线交点（1/3 或 2/3 处），留白给视线方向\n2. 引导线：道路/栏杆/墙壁线条把观众目光引向主体\n3. 对称构图：左右对称，适合权力/秩序/仪式感（韦斯·安德森标志性手法）\n4. 框架构图：门窗/拱廊框住主体，增加层次感\n5. 负空间：主体只占画面小部分，大面积留白表达孤独/渺小\n6. 前景遮挡：前景放置虚化物体，增加纵深感\n7. 头顶空间（Headroom）：近景特写头顶保留少量空间，不要切到额头"},
		{Category: "director", Title: "对话戏的拍法", Keywords: "对话 双人 过肩 镜头 覆盖 切换 正反打", Content: "标准二人对话覆盖公式：\n\n1. 全景定场（Establishing）：交代两人位置关系和环境\n2. A 过肩（OTS-A）：从 B 肩后拍 A，展现 B 的模糊轮廓\n3. B 过肩（OTS-B）：镜像\n4. A 近景（CU-A）：情绪爆点时切到单人\n5. B 近景（CU-B）：对应\n6. 双人中景（Two-Shot）：两人同框，适合氛围段落\n\n镜头时长原则：平静对话 5-8 秒一切，紧张对话 2-4 秒一切。\n\n禁忌：同一角度连续切（跳切），除非故意制造割裂感。"},

		// --- 执行词 Agent ---
		{Category: "execution", Title: "Prompt 工程原则", Keywords: "prompt 提示词 主体 动作 环境 风格 参数 写法", Content: "好 prompt 的五个要素（按权重排序）：\n\n1. 主体（Subject）：谁/什么，最核心。如「一位穿着和服的年轻女性」\n2. 动作/状态（Action）：主体在做什么。如「正站在樱花树下回头微笑」\n3. 环境/场景（Setting）：在哪。如「日式庭院，午后阳光透过树叶」\n4. 风格/介质（Style）：画面类型。如「电影感写实摄影，35mm 胶片质感」\n5. 技术参数（Tech）：景别/灯光/构图。如「近景，逆光，大光圈浅景深」\n\n原则：具体 > 抽象，视觉化 > 概念化。不要写「一个美丽的场景」，要写「黄昏的威尼斯运河，金色水面倒映着圣马可大教堂的圆顶」。\n\n反词（Negative Prompt）：只列出确实要排除的缺陷，不要写太多项避免干扰模型。"},
		{Category: "execution", Title: "视频生成参数指南", Keywords: "视频 参数 分辨率 时长 运动幅度 首尾帧 生成", Content: "分辨率选择：\n- 540p：快速测试用，5-10 秒验证构图和动作\n- 720p：发布质量，大多数场景足够\n- 1080p：关键镜头和最终输出\n\n时长策略：\n- 单镜头 4-5 秒：快节奏剪辑\n- 单镜头 8 秒：叙事段落\n- 避免用满 16 秒除非是大全景或长镜头\n\n运动幅度（movement_amplitude）：\n- auto：让模型自己决定\n- small：对话、静物、特写\n- medium：走路、动作、一般镜头\n- large：追逐、舞蹈、大幅度运动\n\n首尾帧：适合做转场、变化过程。尾帧画面要与首帧有明显的视觉逻辑关联。"},
		{Category: "execution", Title: "角色一致性 Prompt 技巧", Keywords: "角色 一致性 外貌 锚点 穿着 参考图 连续 镜头 prompt", Content: "想要多段视频中角色长相一致，prompt 中必须包含「角色锚定描述」：\n\n1. 外貌锚点：年龄 + 性别 + 脸型 + 发型/发色 + 标志特征\n   例：「30 岁亚洲女性，鹅蛋脸，黑色长直发齐腰，左眉尾有一颗小痣」\n2. 穿着锚点：在同一个场景序列中保持服装描述一致\n3. 避免模糊词：不要写「漂亮」「英俊」，写成「皮肤白皙」「轮廓分明」\n4. 参考图冗余：上传 3-5 张不同角度高清照片，覆盖正/侧/45°\n5. 连续镜头 prompt 接力：上一段视频的最终画面描述作为下一段的起始画面描述\n\n如果 API 支持 @subject 语法（如 Vidu），优先使用实体引用而非文字描述。"},
		{Category: "execution", Title: "Seedance 2.0 参数速查", Keywords: "seedance 火山 参数 比例 元素列表 多镜头 参考图", Content: "模型选择：\n- Pro：高质量，1080p，4-8s，生成慢\n- Fast：快速，720p，4-16s，性价比高\n\n比例：1:1（方形，适合社交媒体），16:9（横屏，标准视频），9:16（竖屏，短视频）\n\n参考图上限：9 张图片 + 3 段视频 + 3 段音频\n\n元素列表（element_list）：将多张参考图拆分为独立元素，模型会分别理解每个元素并在画面中保留。适合角色+道具+场景的组合输入。\n\n多镜头（multi_shot）：Kling V3 专属，一次生成多个连续镜头，适合短剧段落。"},
		{Category: "execution", Title: "常见模型对比选择", Keywords: "模型 对比 选择 seedance kling vidu wan 推荐", Content: "Seedance 2.0：场景叙事强，适合有环境/动作的镜头。参考图多时效果好。\nKling V3：角色一致性较 Seedance 稍好，多镜头功能适合短剧。支持运镜控制（intelligence 模式）。\nVidu Q3：角色一致性目前最强，支持 reference2video + @subject 实体引用。适合需要严格锁定角色形象的场景。\nWan 2.1/2.2（如通过 ComfyUI 调用）：开源方案中综合最优，图生视频能力强。需要自建 GPU 环境。\n\n选择建议：\n- 角色对话/面部特写 → Kling/Vidu\n- 大场景/动作戏 → Seedance\n- 预算有限 → 720p + off-peak 模式"},
		{Category: "execution", Title: "模型级角色锁定方案", Keywords: "角色 锁定 一致性 模型 seedance kling vidu 方案 选型", Content: "不同 AI 视频模型对角色一致性的支持程度不同，选对方案比写好 prompt 更重要：\n\nSeedance 2.0：通过多张参考图（最多 9 张）+ 元素列表（element_list）分别标注角色和场景。优势是多图输入让模型同时看到角色的正面/侧面/背面，场景叙事时角色更稳定。适合动作戏和大场景。\n\nKling V3：支持 element_list 分镜，每个元素独立描述，多镜头（multi_shot）功能可一次生成多个连续镜头。角色一致性比 Seedance 稍好。适合短剧段落。\n\nVidu Q3：当前角色一致性最强的方案。支持 @subject 实体引用语法（例如 @subject:角色名），模型会锁定该实体在不同镜头中的面部特征。适合需要严格角色统一的特写和对话场景。\n\n对比总结：角色特写 → Vidu > Kling > Seedance；大场景动作 → Seedance > Kling > Vidu。如果角色一致性是最高优先级，优先选择 Vidu Q3 + @subject 引用。\n\n通用技巧：无论哪个模型，上传 3-5 张不同角度高清参考图，在前端开启人物库角色锚定注入，会显著提升一致性。"},
	}

	for _, entry := range seeds {
		entry.ID = newID("knowledge")
		entry.UpdatedAt = now()
		entry.CreatedAt = entry.UpdatedAt
		if _, err := repository.SaveKnowledgeEntry(entry); err != nil {
			logger.Errorf("seed knowledge failed: title=%s err=%v", entry.Title, err)
			continue
		}
		if err := repository.UpsertKnowledgeVector(entry.ID, entry.Title+" "+entry.Content); err != nil {
			logger.Errorf("seed knowledge vector failed: title=%s err=%v", entry.Title, err)
		}
	}
	log.Printf("seeded %d knowledge entries", len(seeds))
}

// 提示词模板库 — 使用 {{variable}} 占位符语法
// 生图工作台和视频创作台共用

export type PromptTemplate = {
    id: string;
    name: string;
    category: string;
    template: string;
    variables: string[];
    mode: "image" | "video" | "both";
};

export const PROMPT_TEMPLATES: PromptTemplate[] = [
    // ===== 电商海报 =====
    {
        id: "ecommerce-product",
        name: "电商产品图",
        category: "电商",
        template: "{{产品名称}}，摆放在{{场景}}上，{{光线}}光线，{{风格}}风格，商业摄影，超高清，8K，产品摄影",
        variables: ["产品名称", "场景", "光线", "风格"],
        mode: "image",
    },
    {
        id: "ecommerce-model",
        name: "电商模特图",
        category: "电商",
        template: "一位{{性别}}模特穿着{{服装描述}}，站在{{背景}}前，{{光线}}自然光，时尚摄影，杂志风格",
        variables: ["性别", "服装描述", "背景", "光线"],
        mode: "image",
    },

    // ===== 人物写真 =====
    {
        id: "portrait-studio",
        name: "影楼写真",
        category: "人物",
        template: "{{人物描述}}的半身肖像照，{{背景}}背景，{{光线}}打光，{{风格}}风格，专业人像摄影，柔焦，85mm镜头",
        variables: ["人物描述", "背景", "光线", "风格"],
        mode: "image",
    },
    {
        id: "portrait-outdoor",
        name: "户外写真",
        category: "人物",
        template: "{{人物描述}}在{{地点}}，{{时间}}，{{光线}}自然光，电影感，浅景深",
        variables: ["人物描述", "地点", "时间", "光线"],
        mode: "image",
    },

    // ===== 风景壁纸 =====
    {
        id: "landscape-sunset",
        name: "日落风景",
        category: "风景",
        template: "{{地点}}的日落时分，{{元素}}，暖色调，{{光线}}光线，电影级画面，8K超清，壁纸",
        variables: ["地点", "元素", "光线"],
        mode: "image",
    },
    {
        id: "landscape-fantasy",
        name: "梦幻仙境",
        category: "风景",
        template: "梦幻的{{场景类型}}，{{主色调}}色调，{{元素}}点缀，魔法光效，粒子飘散，概念艺术",
        variables: ["场景类型", "主色调", "元素"],
        mode: "image",
    },

    // ===== 二次元 =====
    {
        id: "anime-character",
        name: "二次元角色",
        category: "二次元",
        template: "{{角色名}}，{{发色}}头发，{{瞳色}}眼睛，穿着{{服装}}，{{场景}}背景，日式动漫风格，精美立绘",
        variables: ["角色名", "发色", "瞳色", "服装", "场景"],
        mode: "image",
    },
    {
        id: "anime-scene",
        name: "动漫场景",
        category: "二次元",
        template: "{{场景描述}}，新海诚风格，{{光线}}光线，天空细节丰富，日式动画电影画风",
        variables: ["场景描述", "光线"],
        mode: "image",
    },

    // ===== 视频模板 =====
    {
        id: "video-cinemagraph",
        name: "微动画面",
        category: "视频",
        template: "{{主体描述}}在{{场景}}中，{{动作}}，微动，电影感，{{光线}}光线，4K",
        variables: ["主体描述", "场景", "动作", "光线"],
        mode: "video",
    },
    {
        id: "video-dynamic",
        name: "动态镜头",
        category: "视频",
        template: "{{主体}}的{{动作}}，{{运镜方式}}镜头运动，{{风格}}风格，{{光线}}，流畅60fps",
        variables: ["主体", "动作", "运镜方式", "风格", "光线"],
        mode: "video",
    },

    // ===== 短视频模板 =====
    {
        id: "short-talk",
        name: "口播视频",
        category: "短视频",
        template: "单人正面半身，{{人物描述}}，面对镜头自然说话，{{背景}}背景，{{光线}}柔和布光，口播风格，主播感",
        variables: ["人物描述", "背景", "光线"],
        mode: "video",
    },
    {
        id: "short-product",
        name: "产品展示",
        category: "短视频",
        template: "{{产品名称}}特写展示，{{运镜}}镜头缓慢推进，{{背景}}简洁背景，产品光泽，商业短视频，4K",
        variables: ["产品名称", "运镜", "背景"],
        mode: "video",
    },
    {
        id: "short-vlog",
        name: "生活 Vlog",
        category: "短视频",
        template: "{{场景}}日常记录，{{主体动作}}，{{风格}}色调，手持拍摄感，自然光，生活化，Vlog",
        variables: ["场景", "主体动作", "风格"],
        mode: "video",
    },
    {
        id: "short-knowledge",
        name: "知识科普",
        category: "短视频",
        template: "{{主题}}科普解说，{{视觉元素}}可视化呈现，干净明亮的{{风格}}风格，信息图表动画感，知识类短视频",
        variables: ["主题", "视觉元素", "风格"],
        mode: "video",
    },
    {
        id: "short-unbox",
        name: "开箱测评",
        category: "短视频",
        template: "{{产品}}开箱，近距离特写，{{光线}}顶光+侧光，产品质感突出，桌面俯拍，测评风格",
        variables: ["产品", "光线"],
        mode: "video",
    },
    {
        id: "short-food",
        name: "美食制作",
        category: "短视频",
        template: "{{菜品}}制作过程，{{角度}}机位，暖色灯光，蒸汽升腾，食材新鲜质感，慢动作，美食短视频",
        variables: ["菜品", "角度"],
        mode: "video",
    },
];

export function fillTemplate(template: string, values: Record<string, string>): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_, key) => values[key] || values[key.trim()] || `{{${key}}}`);
}

export function getTemplatesByMode(mode: "image" | "video"): PromptTemplate[] {
    return PROMPT_TEMPLATES.filter((t) => t.mode === mode || t.mode === "both");
}

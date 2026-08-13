"use client";

import { App, Button, Empty, Input, Modal, Segmented, Tag, Tooltip } from "antd";
import { Camera, Clapperboard, Copy, FileText, GitBranch, ImageIcon, PenTool, Search, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { useCopyText } from "@/hooks/use-copy-text";
import { draftDirectorAdvice, draftStoryboard, generateExecutionScript } from "@/services/api/user-config";
import { localChannelForActiveModel, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type StoryboardMode = "draft" | "analyze" | "graph" | "adapt" | "review";

const modeOptions = [
    { value: "draft" as const, label: "分镜脚本", icon: <Clapperboard className="size-3.5" /> },
    { value: "analyze" as const, label: "故事解析", icon: <Search className="size-3.5" /> },
    { value: "graph" as const, label: "关系图谱", icon: <GitBranch className="size-3.5" /> },
    { value: "adapt" as const, label: "改编/直译", icon: <PenTool className="size-3.5" /> },
    { value: "review" as const, label: "审校修复", icon: <Sparkles className="size-3.5" /> },
];

const storyPresets = [
    { label: "武侠短剧", prompt: "一个被师门驱逐的少年剑客，在雨夜的破庙中救下一位神秘老者。老者临终前将一枚刻着龙纹的令牌塞进他手中——这是武林盟主的信物。从此他一边躲避追杀，一边追查二十年前师门灭门的真相。请生成3分钟短剧的5个关键场景。" },
    { label: "悬疑短片", prompt: "深夜的图书馆，管理员发现一本被撕毁的日记。日记最后一页写着：「如果有人在读这些字，说明我已经不在了。别相信镜子里的自己。」她抬头，发现墙壁上的镜子里映出的却不是她的脸。请生成3分钟悬疑短片的5个关键场景。" },
    { label: "都市爱情", prompt: "两个陌生人在暴雨中的公交站偶遇。他是刚被开除的程序员，她是刚分手的插画师。一辆末班公交驶过，溅起的水花打湿了她的画本——从此两条平行线开始交织。请生成3分钟都市爱情短片的5个关键场景。" },
    { label: "科幻冒险", prompt: "2087年，地球资源枯竭。一支由AI指挥的勘探队在火星峡谷中发现了一座被废弃的外星城市。城市中央的黑色方尖碑上刻着一串地球坐标——那是他们家的地址。请生成3分钟科幻冒险短片的5个关键场景。" },
    { label: "治愈日常", prompt: "一只流浪橘猫每天下午三点准时出现在小区的长椅上。退休的老教师、放学的小女孩、加班到深夜的上班族——三个人的生活因为这只看似普通的猫悄然交织。请生成2分钟治愈短片的4个关键场景。" },
    { label: "恐怖短片", prompt: "搬家后的第一个夜晚，她发现卧室角落的衣柜里有一扇不属于任何房间的暗门。每天早上醒来，门上刻的数字都会减少1——从30开始。今天是第29天。请生成2分钟恐怖短片的4个关键场景。" },
];

type StoryboardShot = {
    shot: number; type?: string; description?: string; camera?: string; lighting?: string; continuity?: string; duration?: number; prompt?: string;
};
type StoryboardScene = {
    scene: number; location?: string; time?: string; atmosphere?: string; summary?: string; shots?: StoryboardShot[];
};
type Storyboard = {
    title?: string; theme?: string; emotionalArc?: string; scenes?: StoryboardScene[];
    analysis?: any; characters?: any[]; plotPoints?: any[];
    graph?: any;
    adaptation?: any;
    scores?: any; issues?: any[]; summary?: string;
};

export function StoryboardAgentModal({ open, onClose, onApplyScenes }: { open: boolean; onClose: () => void; onApplyScenes?: (scenes: { scene: number; location?: string; shots: { shot: number; prompt: string }[] }[]) => void }) {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const copyText = useCopyText();
    const [prompt, setPrompt] = useState("");
    const [mode, setMode] = useState<StoryboardMode>("draft");
    const [loading, setLoading] = useState(false);
    const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [directingScenes, setDirectingScenes] = useState<Set<number>>(new Set());
    const [execLoading, setExecLoading] = useState(false);
    const [automating, setAutomating] = useState(false);
    const [execResult, setExecResult] = useState<{ title?: string; overview?: string; script?: string; steps?: any[]; tips?: string[] } | null>(null);
    const directorCache = useRef(new Map<number, any[]>());

    const runStoryboard = async () => {
        const text = prompt.trim();
        if (!text) { message.error("请输入内容"); return; }
        if (!token) { message.warning("请先登录后使用编剧 Agent"); return; }
        const textModel = effectiveConfig.textModel || effectiveConfig.model;
        const textChannelId = effectiveConfig.textChannelId;
        const textConfig = { ...effectiveConfig, model: textModel, textModel, textChannelId, activeChannelId: textChannelId };
        if (!isAiConfigReady(textConfig, textModel)) { openConfigDialog(true); return; }
        setLoading(true);
        try {
            const localChannel = effectiveConfig.channelMode === "local" ? localChannelForActiveModel(textConfig) : null;
            const result = await draftStoryboard<Storyboard>(token, {
                prompt: text, mode, model: textModel, channelId: textChannelId,
                channelMode: effectiveConfig.channelMode, baseUrl: localChannel?.baseUrl, apiKey: localChannel?.apiKey,
            });
            setStoryboard(result.storyboard);
            setWarnings(result.warnings || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "编剧 Agent 生成失败");
        } finally { setLoading(false); }
    };

    const runDirectorOnScene = async (sceneIndex: number) => {
        const scene = storyboard?.scenes?.[sceneIndex];
        if (!scene || !token) return;
        const textModel = effectiveConfig.textModel || effectiveConfig.model;
        const textChannelId = effectiveConfig.textChannelId;
        const textConfig = { ...effectiveConfig, model: textModel, textModel, textChannelId, activeChannelId: textChannelId };
        if (!isAiConfigReady(textConfig, textModel)) { openConfigDialog(true); return; }

        setDirectingScenes((prev) => new Set(prev).add(sceneIndex));
        try {
            const shotLines = (scene.shots || []).map((s) => `${s.shot}. ${s.type || ""} ${s.description || ""}`).join("\n");
            const scenePrompt = `场景${scene.scene}: ${scene.location || ""} ${scene.time || ""} ${scene.atmosphere || ""}\n概要: ${scene.summary || ""}\n已有镜头:\n${shotLines}\n请为每镜补充 camera, lighting, continuity 建议，保持镜号对应。`;
            const localChannel = effectiveConfig.channelMode === "local" ? localChannelForActiveModel(textConfig) : null;
            const result = await draftDirectorAdvice<{ shots?: { shot: number; camera?: string; lighting?: string; continuity?: string }[] }>(token, {
                prompt: scenePrompt, model: textModel, channelId: textChannelId,
                channelMode: effectiveConfig.channelMode, baseUrl: localChannel?.baseUrl, apiKey: localChannel?.apiKey,
            });
            const directorShots = result.advice?.shots || [];
            if (directorShots.length && storyboard?.scenes) {
                directorCache.current.set(sceneIndex, directorShots);
                setStoryboard((prev) => {
                    if (!prev) return prev;
                    const updatedScenes = [...prev.scenes!];
                    const updatedScene = { ...updatedScenes[sceneIndex], shots: [...(updatedScenes[sceneIndex].shots || [])] };
                    const shotMap = new Map(directorShots.map((ds: any) => [ds.shot, ds]));
                    updatedScene.shots = updatedScene.shots.map((s: StoryboardShot) => {
                        const ds = shotMap.get(s.shot);
                        if (!ds) return s;
                        return { ...s, camera: ds.camera || s.camera, lighting: ds.lighting || s.lighting, continuity: ds.continuity || s.continuity };
                    });
                    updatedScenes[sceneIndex] = updatedScene;
                    return { ...prev, scenes: updatedScenes };
                });
            }
        } catch (error) {
            message.error(error instanceof Error ? error.message : "导演细化失败");
        } finally {
            setDirectingScenes((prev) => { const next = new Set(prev); next.delete(sceneIndex); return next; });
        }
    };

    const runDirectorOnAll = async () => {
        if (!storyboard?.scenes) return;
        for (let i = 0; i < storyboard.scenes.length; i++) {
            await runDirectorOnScene(i);
        }
    };

    const runExecutionScript = async () => {
        if (!storyboard?.scenes || !token) return;
        const textModel = effectiveConfig.textModel || effectiveConfig.model;
        const textChannelId = effectiveConfig.textChannelId;
        const textConfig = { ...effectiveConfig, model: textModel, textModel, textChannelId, activeChannelId: textChannelId };
        if (!isAiConfigReady(textConfig, textModel)) { openConfigDialog(true); return; }
        setExecLoading(true);
        try {
            const localChannel = effectiveConfig.channelMode === "local" ? localChannelForActiveModel(textConfig) : null;
            const payload = await generateExecutionScript<{ title?: string; overview?: string; script?: string; steps?: any[]; tips?: string[] }>(token, {
                name: storyboard.title || "分镜工作流",
                category: "storyboard",
                description: storyboard.theme || "",
                data: { scenes: storyboard.scenes },
                model: textModel,
                channelId: textChannelId,
                channelMode: effectiveConfig.channelMode,
                baseUrl: localChannel?.baseUrl,
                apiKey: localChannel?.apiKey,
            });
            setExecResult(payload.jsonExport || { script: payload.script, steps: [] });
        } catch (error) {
            message.error(error instanceof Error ? error.message : "执行词生成失败");
        } finally {
            setExecLoading(false);
        }
    };

    const runAutoPipeline = async () => {
        if (!storyboard?.scenes || !token) return;
        setAutomating(true);
        await Promise.all(storyboard.scenes.map((_, i) => runDirectorOnScene(i)));
        await runExecutionScript();
        setAutomating(false);
    };

    return (
        <Modal
            title={
                <span className="flex items-center gap-2">
                    <Clapperboard className="size-4" />
                    编剧 Agent
                </span>
            }
            open={open}
            onCancel={onClose}
            width={860}
            footer={null}
            destroyOnClose={false}
        >
            <div className="space-y-4">
                <Segmented block options={modeOptions} value={mode} onChange={(v) => setMode(v as StoryboardMode)} />
                {mode === "draft" && !storyboard ? (
                    <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                        输入创作主题 → 生成分镜脚本 → 导演细化运镜光线 → Director Cut 全自动生成执行词 → 一键铺到画布
                    </div>
                ) : null}
                {mode === "draft" ? (
                    <div className="flex flex-wrap gap-1.5">
                        {storyPresets.map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500 transition hover:border-stone-400 hover:text-stone-700 dark:border-stone-800 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-200"
                                onClick={() => setPrompt(p.prompt)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                ) : null}
                <Input.TextArea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder={mode === "review" ? "粘贴需要审校的剧本章节内容..." : mode === "analyze" ? "粘贴或输入故事全文..." : "输入创作主题，例如：一个武侠少年在雨夜追查失窃的藏宝图，最终发现幕后主使是自己的师兄"}
                    autoSize={{ minRows: 2, maxRows: 5 }}
                />
                <Button block type="primary" loading={loading} icon={<Sparkles className="size-4" />} onClick={() => void runStoryboard()}>
                    {mode === "draft" ? "生成分镜脚本" : mode === "analyze" ? "开始解析" : mode === "graph" ? "生成图谱" : mode === "adapt" ? "生成改编" : "开始审校"}
                </Button>

                {warnings.length ? (
                    <div className="space-y-1 text-xs text-amber-600 dark:text-amber-300">
                        {warnings.map((item) => (
                            <div key={item}>{item}</div>
                        ))}
                    </div>
                ) : null}

                {storyboard ? (
                    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                        {mode === "draft" && storyboard.scenes?.length ? (
                            <div className="flex gap-2">
                                <Tooltip title="逐场景调用导演 Agent，为每镜补充运镜、光线和衔接描述">
                                    <Button size="small" icon={<Camera className="size-3.5" />} loading={directingScenes.size > 0} onClick={() => void runDirectorOnAll()}>
                                        导演细化{directingScenes.size > 0 ? ` (${directingScenes.size})` : ""}
                                    </Button>
                                </Tooltip>
                                {onApplyScenes ? (
                                    <Button size="small" type="primary" icon={<ImageIcon className="size-3.5" />} onClick={() => {
                                        const validScenes = (storyboard.scenes || []).filter((s) => (s.shots || []).some((sh) => sh.prompt?.trim()));
                                        if (!validScenes.length) { message.warning("没有可用的分镜 prompt"); return; }
                                        onApplyScenes(validScenes.map((s) => ({
                                            scene: s.scene,
                                            location: s.location,
                                            shots: (s.shots || []).filter((sh) => sh.prompt?.trim()).map((sh) => ({ shot: sh.shot, prompt: sh.prompt! })),
                                        })));
                                        onClose();
                                    }}>
                                        生成画布分镜
                                    </Button>
                                ) : null}
                                <Button size="small" icon={<FileText className="size-3.5" />} loading={execLoading} onClick={() => void runExecutionScript()}>
                                    生成执行词
                                </Button>
                                <Button size="small" type="primary" icon={<Sparkles className="size-3.5" />} loading={automating} onClick={() => void runAutoPipeline()}>
                                    Director Cut
                                </Button>
                            </div>
                        ) : null}
                        {storyboard.analysis ? (
                            <div className="space-y-3">
                                <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-1 text-sm font-medium">故事解析</div>
                                    <div className="text-xs text-stone-500 space-y-1">
                                        <div>主题：{storyboard.analysis.theme || "-"}</div>
                                        <div>类型：{storyboard.analysis.genre || "-"} · 结构：{storyboard.analysis.structure || "-"} · 基调：{storyboard.analysis.tone || "-"}</div>
                                    </div>
                                </div>
                                {storyboard.characters?.length ? (
                                    <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                        <div className="mb-2 text-sm font-medium">角色关系</div>
                                        <div className="grid gap-2">
                                            {storyboard.characters.map((c: any, i: number) => (
                                                <div key={i} className="rounded bg-stone-100 p-2 text-xs dark:bg-stone-950">
                                                    <span className="font-medium">{c.name}</span> · {c.role}
                                                    {c.personality ? <Tag className="m-0 ml-1">{c.personality}</Tag> : null}
                                                    {c.relationships?.length ? <div className="mt-1 text-stone-500">{c.relationships.map((r: any) => `${r.target}(${r.type})`).join(" · ")}</div> : null}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {storyboard.graph ? (
                            <div className="space-y-3">
                                <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-2 text-sm font-medium">人物节点</div>
                                    <div className="flex flex-wrap gap-1">
                                        {(storyboard.graph.nodes || []).map((n: any, i: number) => (
                                            <Tag key={i}>{n.label}({n.group})</Tag>
                                        ))}
                                    </div>
                                </div>
                                {(storyboard.graph.edges || []).length ? (
                                    <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                        <div className="mb-2 text-sm font-medium">关系连线</div>
                                        <div className="grid gap-1 text-xs text-stone-500">
                                            {(storyboard.graph.edges || []).map((e: any, i: number) => (
                                                <div key={i}>{e.source} → {e.target}：{e.label}</div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {storyboard.scores ? (
                            <div className="space-y-3">
                                <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-2 text-sm font-medium">评分</div>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(storyboard.scores).filter(([k]) => k !== "overall").map(([k, v]: [string, any]) => (
                                            <span key={k} className="rounded bg-stone-100 px-2 py-1 text-xs dark:bg-stone-950">{k}：{v}/10</span>
                                        ))}
                                        <span className="rounded bg-stone-200 px-2 py-1 text-xs font-medium dark:bg-stone-800">综合：{storyboard.scores.overall}/10</span>
                                    </div>
                                </div>
                                {(storyboard.issues || []).map((iss: any, i: number) => (
                                    <div key={i} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800 text-xs">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Tag className="m-0">{iss.type}</Tag>
                                            <span className={iss.severity === "严重" ? "text-red-500" : iss.severity === "一般" ? "text-amber-500" : "text-stone-500"}>{iss.severity}</span>
                                        </div>
                                        <div className="text-stone-600 dark:text-stone-300">{iss.description}</div>
                                        {iss.fix ? <div className="mt-1 text-green-600 dark:text-green-400">修复：{iss.fix}</div> : null}
                                    </div>
                                ))}
                                {storyboard.summary ? <div className="rounded-lg border border-stone-200 p-3 text-xs dark:border-stone-800">{storyboard.summary}</div> : null}
                            </div>
                        ) : null}
                        {storyboard.adaptation ? (
                            <div className="rounded-lg border border-stone-200 p-3 dark:border-stone-800 text-xs">
                                <div className="font-medium">改编方式：{storyboard.adaptation.approach || "-"}</div>
                                {(storyboard.adaptation.changes || []).map((c: string, i: number) => <div key={i} className="mt-1 text-stone-500">· {c}</div>)}
                            </div>
                        ) : null}
                        {storyboard.title || storyboard.theme ? (
                            <div>
                                <div className="text-base font-semibold">{storyboard.title || "未命名作品"}</div>
                                {storyboard.theme ? <div className="mt-1 text-sm text-stone-500 dark:text-stone-400">{storyboard.theme}</div> : null}
                                {storyboard.emotionalArc ? <div className="mt-1 text-xs text-stone-400 dark:text-stone-500">情绪：{storyboard.emotionalArc}</div> : null}
                            </div>
                        ) : null}
                        {(storyboard.scenes || []).map((scene, sceneIndex) => (
                            <div key={scene.scene} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
                                    <span>第 {scene.scene} 场</span>
                                    {scene.location ? <Tag className="m-0">{scene.location}</Tag> : null}
                                    {scene.time ? <Tag className="m-0">{scene.time}</Tag> : null}
                                    {scene.atmosphere ? <Tag className="m-0">{scene.atmosphere}</Tag> : null}
                                    {mode === "draft" ? (
                                        <Tooltip title="导演 Agent 细化本场景运镜光线">
                                            <Button size="small" icon={<Camera className="size-3" />} loading={directingScenes.has(sceneIndex)} onClick={() => void runDirectorOnScene(sceneIndex)} />
                                        </Tooltip>
                                    ) : null}
                                </div>
                                {scene.summary ? <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{scene.summary}</p> : null}
                                <div className="space-y-2">
                                    {(scene.shots || []).map((shot) => (
                                        <div key={shot.shot} className="rounded-md bg-stone-100 p-2 dark:bg-stone-950">
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                                                <span className="font-medium text-stone-700 dark:text-stone-300">镜头 {shot.shot}</span>
                                                {shot.type ? <Tag className="m-0">{shot.type}</Tag> : null}
                                                {shot.camera ? <span>{shot.camera}</span> : null}
                                                {shot.duration ? <span>{shot.duration} 秒</span> : null}
                                            </div>
                                            {shot.lighting ? <div className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">光线：{shot.lighting}</div> : null}
                                            {shot.continuity && shot.continuity !== "开场" ? <div className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">↳ {shot.continuity}</div> : null}
                                            {shot.description ? <p className="mt-1 text-sm">{shot.description}</p> : null}
                                            {shot.prompt ? (
                                                <div className="mt-1 flex items-start gap-2">
                                                    <div className="flex-1 whitespace-pre-wrap rounded bg-white p-2 text-xs dark:bg-stone-900">{shot.prompt}</div>
                                                    <Button size="small" icon={<Copy className="size-3" />} onClick={() => copyText(shot.prompt || "", "提示词已复制")} />
                                                </div>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="生成后在这里预览分镜脚本" />
                )}
                {execResult ? (
                    <div className="rounded-lg border border-blue-200 p-4 dark:border-blue-900 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                            <FileText className="size-4" /> 执行词
                        </div>
                        {execResult.title ? <div className="text-base font-semibold">{execResult.title}</div> : null}
                        {execResult.overview ? <div className="text-sm text-stone-500 dark:text-stone-400">{execResult.overview}</div> : null}
                        {execResult.script ? (
                            <div>
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="text-xs font-medium text-stone-500">执行词正文</span>
                                    <Button size="small" icon={<Copy className="size-3" />} onClick={() => copyText(execResult.script || "", "执行词已复制")}>复制</Button>
                                </div>
                                <div className="whitespace-pre-wrap rounded-lg bg-stone-100 p-3 text-sm leading-relaxed dark:bg-stone-950">{execResult.script}</div>
                            </div>
                        ) : null}
                        {Array.isArray(execResult.steps) && execResult.steps.length ? (
                            <div className="space-y-2">
                                <div className="text-xs font-medium text-stone-500">执行步骤</div>
                                {execResult.steps.map((step: any) => (
                                    <div key={step.step} className="rounded-lg border border-stone-200 p-2 dark:border-stone-800 text-xs">
                                        <span className="font-medium">步骤 {step.step}</span>
                                        {step.action ? <Tag className="m-0 ml-2">{step.action}</Tag> : null}
                                        {step.parameters ? <div className="mt-1 text-stone-500">{step.parameters}</div> : null}
                                        {step.prompt ? <div className="mt-1 whitespace-pre-wrap rounded bg-stone-100 p-2 dark:bg-stone-950">{step.prompt}</div> : null}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {Array.isArray(execResult.tips) && execResult.tips.length ? (
                            <div className="space-y-1">
                                <div className="text-xs font-medium text-stone-500">建议</div>
                                {execResult.tips.map((tip: string, i: number) => (
                                    <div key={i} className="rounded bg-blue-50 px-3 py-1.5 text-xs dark:bg-blue-950">· {tip}</div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </Modal>
    );
}

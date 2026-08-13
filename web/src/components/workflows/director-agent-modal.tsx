"use client";

import { App, Button, Empty, Input, Modal, Select, Tag, Tooltip, Upload } from "antd";
import { Camera, Copy, Image as ImageIcon, Sparkles } from "lucide-react";
import { useRef, useState } from "react";

import { useCopyText } from "@/hooks/use-copy-text";
import { draftDirectorAdvice } from "@/services/api/user-config";
import { localChannelForActiveModel, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";
import { uploadImage } from "@/services/image-storage";
import type { UploadFile } from "antd";

type DirectorShot = {
    shot: number;
    type?: string;
    angle?: string;
    lens?: string;
    aperture?: string;
    movement?: string;
    composition?: string;
    lighting?: string;
    continuity?: string;
    reason?: string;
    prompt?: string;
};

type DirectorAdvice = {
    analysis?: string;
    shots?: DirectorShot[];
};

const directorPresets = [
    { value: "portrait", label: "人像特写", prompt: "单人中景特写，柔光，面部表情细腻，浅景深 f/1.8" },
    { value: "action", label: "动作场景", prompt: "动感追随镜头，主体快速移动，背景动态模糊，低角度仰拍" },
    { value: "dialogue", label: "对话场景", prompt: "双人中景正反打，过肩镜头，自然室内光线，中焦 50mm" },
    { value: "landscape", label: "风景大全景", prompt: "广角大全景，黄金时刻暖光，深景深 f/11，三分法构图" },
    { value: "night", label: "夜景氛围", prompt: "城市夜景，霓虹灯光，赛博朋克色调，手持微晃感，大光圈 f/1.4" },
    { value: "product", label: "产品展示", prompt: "产品静物拍摄，环形柔光箱，纯色背景，微距镜头 100mm，f/5.6" },
];

export function DirectorAgentModal({ open, onClose, onApplyShots }: { open: boolean; onClose: () => void; onApplyShots?: (shots: { prompt: string; shot: number }[]) => void }) {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const copyText = useCopyText();
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [advice, setAdvice] = useState<DirectorAdvice | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [refFiles, setRefFiles] = useState<UploadFile[]>([]);

    const runDirector = async () => {
        const text = prompt.trim();
        if (!text) {
            message.error("请输入剧本段落或场景描述");
            return;
        }
        if (!token) {
            message.warning("请先登录后使用导演 Agent");
            return;
        }
        const textModel = effectiveConfig.textModel || effectiveConfig.model;
        const textChannelId = effectiveConfig.textChannelId;
        const textConfig = { ...effectiveConfig, model: textModel, textModel, textChannelId, activeChannelId: textChannelId };
        if (!isAiConfigReady(textConfig, textModel)) {
            openConfigDialog(true);
            return;
        }
        setLoading(true);
        try {
            let referenceUrls: string[] | undefined;
            const newRefFile = refFiles[0]?.originFileObj as File | undefined;
            if (newRefFile) {
                const uploaded = await uploadImage(newRefFile, { localOnly: true });
                referenceUrls = [uploaded.url];
            }
            const localChannel = effectiveConfig.channelMode === "local" ? localChannelForActiveModel(textConfig) : null;
            const result = await draftDirectorAdvice<DirectorAdvice>(token, {
                prompt: text,
                model: textModel,
                channelId: textChannelId,
                channelMode: effectiveConfig.channelMode,
                baseUrl: localChannel?.baseUrl,
                apiKey: localChannel?.apiKey,
                references: referenceUrls,
            });
            setAdvice(result.advice);
            setWarnings(result.warnings || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "导演 Agent 生成失败");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <span className="flex items-center gap-2">
                    <Camera className="size-4" />
                    导演 Agent
                </span>
            }
            open={open}
            onCancel={onClose}
            width={860}
            footer={null}
            destroyOnHidden
        >
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Select
                        className="w-36 shrink-0"
                        size="small"
                        placeholder="场景预设"
                        allowClear
                        options={directorPresets}
                        onChange={(value) => {
                            const preset = directorPresets.find((p) => p.value === value);
                            if (preset) setPrompt(preset.prompt);
                        }}
                    />
                    <Upload
                        maxCount={1}
                        fileList={refFiles}
                        onChange={({ fileList }) => setRefFiles(fileList)}
                        beforeUpload={() => false}
                        showUploadList={{ showPreviewIcon: false }}
                    >
                        <Button size="small" icon={<ImageIcon className="size-3.5" />}>参考图反推</Button>
                    </Upload>
                </div>
                <Input.TextArea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="输入剧本段落或场景描述，例如：雨夜，少年在长安城的巷道中疾奔，身后灯火忽明忽暗，他猛然停步，回望来路"
                    autoSize={{ minRows: 2, maxRows: 5 }}
                />
                <Button block type="primary" loading={loading} icon={<Sparkles className="size-4" />} onClick={() => void runDirector()}>
                    生成导演建议
                </Button>

                {warnings.length ? (
                    <div className="space-y-1 text-xs text-amber-600 dark:text-amber-300">
                        {warnings.map((item) => (
                            <div key={item}>{item}</div>
                        ))}
                    </div>
                ) : null}

                {advice ? (
                    <div className="space-y-3">
                        {onApplyShots && advice.shots?.length ? (
                            <div className="flex items-center gap-2">
                                <Tooltip title="将每个分镜创建为一个图片节点，自动连线到导演节点。编辑 prompt 后直接生成。">
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<ImageIcon className="size-3.5" />}
                                        onClick={() => {
                                            const validShots = (advice.shots || []).filter((s) => s.prompt?.trim());
                                            if (!validShots.length) { message.warning("没有可用的 prompt"); return; }
                                            onApplyShots(validShots.map((s) => ({ prompt: s.prompt!, shot: s.shot })));
                                            onClose();
                                        }}
                                    >
                                        一键生成 {advice.shots?.length || 0} 个分镜图
                                    </Button>
                                </Tooltip>
                                <Button
                                    size="small"
                                    icon={<Copy className="size-3" />}
                                    onClick={() => {
                                        const allPrompts = (advice.shots || []).map((s, i) => `${i + 1}. ${s.prompt || ""}`).join("\n\n");
                                        if (allPrompts) copyText(allPrompts, `已复制 ${advice.shots?.length} 段 prompt`);
                                    }}
                                >
                                    复制全部 prompt
                                </Button>
                            </div>
                        ) : null}
                        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                        {advice.analysis ? (
                            <div className="rounded-lg border border-stone-200 p-3 text-sm leading-relaxed dark:border-stone-800">{advice.analysis}</div>
                        ) : null}
                        {(advice.shots || []).map((shot) => (
                            <div key={shot.shot} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm font-medium">
                                    <span>镜头 {shot.shot}</span>
                                    {shot.type ? <Tag className="m-0">{shot.type}</Tag> : null}
                                    {shot.angle ? <Tag className="m-0">{shot.angle}</Tag> : null}
                                </div>
                                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                                    {shot.lens ? <span>焦距 {shot.lens}</span> : null}
                                    {shot.aperture ? <span>光圈 {shot.aperture}</span> : null}
                                    {shot.movement ? <span>运镜 {shot.movement}</span> : null}
                                    {shot.composition ? <span>构图 {shot.composition}</span> : null}
                                    {shot.lighting ? <span>光线 {shot.lighting}</span> : null}
                                </div>
                                {shot.continuity && shot.continuity !== "开场" ? <p className="mb-2 text-xs text-stone-400 dark:text-stone-500">↳ {shot.continuity}</p> : null}
                                {shot.reason ? <p className="mb-2 text-xs text-stone-500 dark:text-stone-400">{shot.reason}</p> : null}
                                {shot.prompt ? (
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 whitespace-pre-wrap rounded bg-stone-100 p-2 text-xs dark:bg-stone-950">{shot.prompt}</div>
                                        <Button size="small" icon={<Copy className="size-3" />} onClick={() => copyText(shot.prompt || "", "提示词已复制")} />
                                    </div>
                                ) : null}
                            </div>
                        ))}
                        </div>
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="生成后在这里预览导演建议" />
                )}
            </div>
        </Modal>
    );
}

"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ImageIcon, LoaderCircle, UserRound } from "lucide-react";
import { Button, Tag, Tooltip } from "antd";
import { useQuery } from "@tanstack/react-query";

import { ModelPicker } from "@/components/model-picker";
import { defaultConfig, useConfigStore, useEffectiveConfig, type AiConfig } from "@/stores/use-config-store";
import { CreditSymbol, requestCreditCost } from "@/constant/credits";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasImageSettingsPopover } from "./canvas-image-settings-popover";
import { CanvasCameraControl } from "./canvas-camera-control";
import { CanvasPromptLibrary } from "./canvas-prompt-library";
import { CanvasPromptTemplateSelector } from "./canvas-prompt-template-selector";
import { CanvasPromptQuickPanel } from "./canvas-prompt-quick-panel";
import { CanvasPromptFavContextMenu } from "./canvas-prompt-fav-context-menu";
import { CanvasAudioSettingsPopover, type CanvasAudioSettingKey } from "./canvas-audio-settings-popover";
import { CanvasVideoSettingsPopover, type CanvasVideoFrameOption, type CanvasVideoResourceOption } from "./canvas-video-settings-popover";
import { CharacterPickerModal } from "./character-picker-modal";
import { fetchCharacters } from "@/services/api/character";
import type { Character } from "@/types/character";
import { CanvasNodeType, type CanvasGenerationMode, type CanvasNodeData } from "../types";
import { PANORAMA_IMAGE_SIZE, isCanvasImageNodeType, isPanoramaNodeType } from "../utils/canvas-panorama";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";

export type { CanvasVideoFrameOption };

export type CanvasNodeGenerationMode = CanvasGenerationMode;

type CanvasNodePromptPanelProps = {
    node: CanvasNodeData;
    isRunning: boolean;
    onPromptChange: (nodeId: string, prompt: string) => void;
    onConfigChange: (nodeId: string, patch: Partial<CanvasNodeData["metadata"]>) => void;
    onGenerate: (nodeId: string, mode: CanvasNodeGenerationMode, prompt: string) => void;
    mentionReferences?: CanvasResourceReference[];
    videoFrameOptions?: CanvasVideoFrameOption[];
    videoResourceOptions?: CanvasVideoResourceOption[];
    onImageSettingsOpenChange?: (open: boolean) => void;
};

export function CanvasNodePromptPanel({ node, isRunning, onPromptChange, onConfigChange, onGenerate, mentionReferences = [], videoFrameOptions = [], videoResourceOptions = [], onImageSettingsOpenChange }: CanvasNodePromptPanelProps) {
    const globalConfig = useEffectiveConfig();
    const modelCosts = useConfigStore((state) => state.publicSettings?.modelChannel.modelCosts);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const mode = defaultMode(node.type);
    const config = buildNodeConfig(globalConfig, node, mode);
    const isPanorama = isPanoramaNodeType(node.type);
    const hasTextContent = node.type === CanvasNodeType.Text && Boolean(node.metadata?.content?.trim());
    const hasImageContent = isCanvasImageNodeType(node.type) && Boolean(node.metadata?.content);
    const sourcePrompt = isPanorama ? node.metadata?.panoramaSourcePrompt || "" : node.metadata?.prompt || "";
    const [prompt, setPrompt] = useState(sourcePrompt);
    const [characterPickerOpen, setCharacterPickerOpen] = useState(false);
    const characterIds = node.metadata?.characterIds || [];
    const { data: allCharacters } = useQuery({ queryKey: ["characters"], queryFn: fetchCharacters, staleTime: 60000 });
    const characterNames = new Map((allCharacters || []).map((c) => [c.id, c.name]));
    const credits = requestCreditCost({ channelMode: config.channelMode, modelCosts, model: config.model, count: mode === "image" ? config.count : 1 });

    useEffect(() => {
        setPrompt(sourcePrompt);
    }, [node.id, sourcePrompt]);

    const updatePrompt = (value: string) => {
        setPrompt(value);
        onPromptChange(node.id, value);
    };

    const canSubmit = Boolean(prompt.trim()) || (isPanorama && (hasImageContent || mentionReferences.length > 0));

    const handleSelectCharacter = (character: Character) => {
        const ids = [...characterIds];
        if (!ids.includes(character.id)) {
            ids.push(character.id);
        }
        onConfigChange(node.id, { characterIds: ids });
        setCharacterPickerOpen(false);
    };

    const handleRemoveCharacter = (id: string) => {
        onConfigChange(node.id, { characterIds: characterIds.filter((cid) => cid !== id) });
    };

    const submit = () => {
        const text = prompt.trim();
        if (!canSubmit || isRunning) return;
        onGenerate(node.id, mode, text);
        if (!isPanorama) setPrompt("");
    };

    return (
        <div
            data-canvas-no-zoom
            className="rounded-2xl border p-3 shadow-2xl backdrop-blur"
            style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border, color: theme.node.text }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
        >
            <CanvasPromptFavContextMenu prompt={prompt}>
                <textarea
                    value={prompt}
                    onChange={(e) => updatePrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    className="thin-scrollbar h-40 w-full resize-none rounded-xl px-3 py-2 text-sm leading-5 outline-none"
                    style={{ background: "transparent", color: theme.node.text, border: "none" }}
                    placeholder={isPanorama ? "描述想生成的全景，或上传/连接图片作为参考" : promptPlaceholder(mode, hasImageContent, hasTextContent)}
                />
            </CanvasPromptFavContextMenu>

            <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Tooltip title="绑定角色，生成时自动注入角色外貌描述和参考图">
                        <Button className="!h-10 shrink-0 !rounded-full !px-3" onClick={() => setCharacterPickerOpen(true)} aria-label="绑定角色">
                            <span className="flex items-center gap-1.5 text-xs font-medium"><UserRound className="size-4" />角色{characterIds.length > 0 ? `(${characterIds.length})` : ""}</span>
                        </Button>
                    </Tooltip>
                    {characterIds.length > 0 && characterIds.map((id) => <Tag key={id} closable onClose={() => handleRemoveCharacter(id)} className="text-xs">{characterNames.get(id) || id.slice(0, 8)}</Tag>)}
                    <CanvasPromptLibrary onSelect={updatePrompt} />
                    <CanvasPromptTemplateSelector mode={mode} onSelect={updatePrompt} />
                    <CanvasPromptQuickPanel onSelect={updatePrompt} currentPrompt={prompt} />
                    {mode === "image" ? (
                        <>
                            <ModelPicker className="!w-[180px] !min-w-0 !shrink-0" config={config} value={config.model} channelId={config.imageChannelId} onChange={(model, channelId) => onConfigChange(node.id, { model, channelId })} capability="image" onMissingConfig={() => openConfigDialog(true)} />
                            <CanvasImageSettingsPopover
                                config={config}
                                placement="topLeft"
                                buttonClassName="!h-10 !w-[148px] !shrink-0 !justify-start !rounded-full !px-3"
                                onConfigChange={(key, value) => onConfigChange(node.id, key === "count" ? { count: Number(value) || 1 } : { [key]: value })}
                                onMissingConfig={() => openConfigDialog(true)}
                                onOpenChange={onImageSettingsOpenChange}
                                showSize={!isPanorama}
                            />
                        </>
                    ) : mode === "video" ? (
                        <>
                            <ModelPicker className="!w-[180px] !min-w-0 !shrink-0" config={config} value={config.model} channelId={config.videoChannelId} onChange={(model, channelId) => onConfigChange(node.id, { model, channelId })} capability="video" onMissingConfig={() => openConfigDialog(true)} />
                            <CanvasVideoSettingsPopover config={config} buttonClassName="!h-10 !w-[148px] !shrink-0 !justify-start !rounded-full !px-3" frameOptions={videoFrameOptions} resourceOptions={videoResourceOptions} metadata={node.metadata} firstFrameNodeId={node.metadata?.firstFrameNodeId} lastFrameNodeId={node.metadata?.lastFrameNodeId} onFrameChange={(patch) => onConfigChange(node.id, patch)} onMetadataChange={(patch) => onConfigChange(node.id, patch)} onConfigChange={(key, value) => onConfigChange(node.id, videoConfigPatch(key, value))} />
                        </>
                    ) : mode === "audio" ? (
                        <>
                            <ModelPicker config={config} value={config.model} channelId={config.audioChannelId || config.activeChannelId} onChange={(model, channelId) => onConfigChange(node.id, { model, channelId })} capability="audio" onMissingConfig={() => openConfigDialog(true)} />
                            <CanvasAudioSettingsPopover config={config} buttonClassName="!h-10 !max-w-[170px] !justify-start !rounded-full !px-3" onConfigChange={(key, value) => onConfigChange(node.id, audioConfigPatch(key, value))} />
                        </>
                    ) : (
                        <ModelPicker config={config} value={config.model} channelId={config.textChannelId} onChange={(model, channelId) => onConfigChange(node.id, { model, channelId })} capability="text" onMissingConfig={() => openConfigDialog(true)} />
                    )}
                    {mode === "video" || (mode === "image" && !isPanorama) ? (
                        <CanvasCameraControl value={node.metadata?.cameraControl} onChange={(cameraControl) => onConfigChange(node.id, { cameraControl })} buttonClassName="!h-10 !min-w-[92px] !justify-start !rounded-full !px-3" />
                    ) : null}
                </div>
                {mode === "text" ? (
                    <Tooltip title="直接用当前文本作为图片提示词生成图片，无需手动连线配置节点">
                        <Button
                            className="!h-10 shrink-0 !rounded-full !px-3"
                            disabled={isRunning || !canSubmit}
                            onClick={() => { const text = prompt.trim(); if (text) { onGenerate(node.id, "image", text); setPrompt(""); } }}
                            aria-label="生图"
                        >
                            <span className="flex items-center gap-1.5 text-xs font-medium"><ImageIcon className="size-4" />生图</span>
                        </Button>
                    </Tooltip>
                ) : null}
                <Button
                    type="primary"
                    className="!h-10 !min-w-16 shrink-0 !rounded-full !px-3"
                    disabled={isRunning || !canSubmit}
                    onClick={submit}
                    aria-label="生成"
                >
                    <span className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-medium tabular-nums">
                            <CreditSymbol />
                            {credits.toLocaleString()}
                        </span>
                        {isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                    </span>
                </Button>
            </div>
            <CharacterPickerModal open={characterPickerOpen} onClose={() => setCharacterPickerOpen(false)} onSelect={handleSelectCharacter} selectedIds={characterIds} />
        </div>
    );
}

function defaultMode(type: CanvasNodeData["type"]): CanvasNodeGenerationMode {
    return type === CanvasNodeType.Text ? "text" : type === CanvasNodeType.Video ? "video" : type === CanvasNodeType.Audio ? "audio" : "image";
}

function buildNodeConfig(globalConfig: AiConfig, node: CanvasNodeData, mode: CanvasNodeGenerationMode): AiConfig {
    const defaultModel = mode === "image" ? globalConfig.imageModel : mode === "video" ? globalConfig.videoModel : mode === "audio" ? globalConfig.audioModel : globalConfig.textModel;
    const channelId = node.metadata?.channelId || "";
    const imageChannelId = mode === "image" ? channelId || globalConfig.imageChannelId : globalConfig.imageChannelId;
    const videoChannelId = mode === "video" ? channelId || globalConfig.videoChannelId : globalConfig.videoChannelId;
    const textChannelId = mode === "text" ? channelId || globalConfig.textChannelId : globalConfig.textChannelId;
    const audioChannelId = mode === "audio" ? channelId || globalConfig.audioChannelId : globalConfig.audioChannelId;
    const activeChannelId = mode === "image" ? imageChannelId : mode === "video" ? videoChannelId : mode === "text" ? textChannelId : mode === "audio" ? audioChannelId || globalConfig.activeChannelId : globalConfig.activeChannelId;
    return {
        ...globalConfig,
        model: node.metadata?.model || defaultModel || (mode === "audio" ? defaultConfig.audioModel : globalConfig.model || defaultConfig.model),
        activeChannelId,
        imageChannelId,
        videoChannelId,
        textChannelId,
        audioChannelId,
        quality: node.metadata?.quality || globalConfig.quality || defaultConfig.quality,
        size: isPanoramaNodeType(node.type) ? PANORAMA_IMAGE_SIZE : node.metadata?.size || (mode === "video" ? "1280x720" : globalConfig.size || defaultConfig.size),
        videoSeconds: node.metadata?.seconds || globalConfig.videoSeconds || defaultConfig.videoSeconds,
        vquality: node.metadata?.vquality || globalConfig.vquality || defaultConfig.vquality,
        videoMode: node.metadata?.mode || globalConfig.videoMode || defaultConfig.videoMode,
        videoNegativePrompt: node.metadata?.negativePrompt || globalConfig.videoNegativePrompt || defaultConfig.videoNegativePrompt,
        videoMultiShot: node.metadata?.multiShot || globalConfig.videoMultiShot || defaultConfig.videoMultiShot,
        videoShotType: node.metadata?.shotType || globalConfig.videoShotType || defaultConfig.videoShotType,
        videoGenerateAudio: node.metadata?.generateAudio || globalConfig.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoCharacterOrientation: node.metadata?.characterOrientation || globalConfig.videoCharacterOrientation || defaultConfig.videoCharacterOrientation,
        videoWatermark: node.metadata?.watermark || globalConfig.videoWatermark || defaultConfig.videoWatermark,
        audioVoice: node.metadata?.audioVoice || globalConfig.audioVoice || defaultConfig.audioVoice,
        audioFormat: node.metadata?.audioFormat || globalConfig.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node.metadata?.audioSpeed || globalConfig.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node.metadata?.audioInstructions || globalConfig.audioInstructions || defaultConfig.audioInstructions,
        count: String(node.metadata?.count || (mode === "image" ? globalConfig.canvasImageCount || globalConfig.count : globalConfig.count) || defaultConfig.count),
    };
}

function promptPlaceholder(mode: CanvasNodeGenerationMode, hasImageContent: boolean, hasTextContent: boolean) {
    if (mode === "video") return "描述要生成的视频内容";
    if (mode === "audio") return "描述要生成的音频内容";
    if (mode === "image") return hasImageContent ? "请输入你想要把这张图修改成什么" : "描述要生成的图片内容";
    return hasTextContent ? "请输入你想要将本段文本修改成什么" : "请输入你想要生成的文本内容";
}

function videoConfigPatch(key: keyof AiConfig, value: string) {
    if (key === "videoSeconds") return { seconds: value };
    if (key === "videoMode") return { mode: value };
    if (key === "videoNegativePrompt") return { negativePrompt: value };
    if (key === "videoMultiShot") return { multiShot: value };
    if (key === "videoShotType") return { shotType: value };
    if (key === "videoGenerateAudio") return { generateAudio: value };
    if (key === "videoCharacterOrientation") return { characterOrientation: value };
    if (key === "videoWatermark") return { watermark: value };
    return { [key]: value };
}

function audioConfigPatch(key: CanvasAudioSettingKey, value: string) {
    if (key === "audioVoice") return { audioVoice: value };
    if (key === "audioFormat") return { audioFormat: value };
    if (key === "audioSpeed") return { audioSpeed: value };
    return { audioInstructions: value };
}

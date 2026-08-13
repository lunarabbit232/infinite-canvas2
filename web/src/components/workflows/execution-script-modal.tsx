"use client";

import { App, Button, Empty, Modal, Tag } from "antd";
import { Copy, FileText, Sparkles } from "lucide-react";
import { useState } from "react";

import { useCopyText } from "@/hooks/use-copy-text";
import { generateExecutionScript } from "@/services/api/user-config";
import { localChannelForActiveModel, useConfigStore, useEffectiveConfig } from "@/stores/use-config-store";
import { useUserStore } from "@/stores/use-user-store";

type ScriptStep = {
    step: number;
    action?: string;
    prompt?: string;
    parameters?: string;
};

type ScriptExport = {
    title?: string;
    overview?: string;
    script?: string;
    steps?: ScriptStep[];
    tips?: string[];
};

export function ExecutionScriptModal({ open, workflow, onClose }: { open: boolean; workflow: unknown; onClose: () => void }) {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const effectiveConfig = useEffectiveConfig();
    const isAiConfigReady = useConfigStore((state) => state.isAiConfigReady);
    const openConfigDialog = useConfigStore((state) => state.openConfigDialog);
    const copyText = useCopyText();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ScriptExport | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);

    const runScript = async () => {
        if (!workflow) return;
        if (!token) {
            message.warning("请先登录后生成执行词");
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
            const localChannel = effectiveConfig.channelMode === "local" ? localChannelForActiveModel(textConfig) : null;
            const named = workflow as { name?: string; category?: string; description?: string };
            const payload = await generateExecutionScript<ScriptExport>(token, {
                name: named.name,
                category: named.category,
                description: named.description,
                data: workflow,
                model: textModel,
                channelId: textChannelId,
                channelMode: effectiveConfig.channelMode,
                baseUrl: localChannel?.baseUrl,
                apiKey: localChannel?.apiKey,
            });
            setResult(payload.jsonExport || { script: payload.script });
            setWarnings(payload.warnings || []);
        } catch (error) {
            message.error(error instanceof Error ? error.message : "执行词生成失败");
        } finally {
            setLoading(false);
        }
    };

    const scriptText = typeof result?.script === "string" && result.script.trim() ? result.script : "";

    return (
        <Modal
            title={
                <span className="flex items-center gap-2">
                    <FileText className="size-4" />
                    生成执行词
                </span>
            }
            open={open}
            onCancel={onClose}
            width={760}
            footer={null}
            destroyOnHidden
        >
            <div className="space-y-4">
                <p className="text-sm text-stone-500 dark:text-stone-400">把当前工作流提炼成一份可完整复刻的执行词，供他人或 AI 照此执行。</p>
                <Button block type="primary" loading={loading} icon={<Sparkles className="size-4" />} onClick={() => void runScript()}>
                    生成执行词
                </Button>

                {warnings.length ? (
                    <div className="space-y-1 text-xs text-amber-600 dark:text-amber-300">
                        {warnings.map((item) => (
                            <div key={item}>{item}</div>
                        ))}
                    </div>
                ) : null}

                {result ? (
                    <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
                        {result.title ? <div className="text-base font-semibold">{result.title}</div> : null}
                        {result.overview ? <div className="text-sm text-stone-500 dark:text-stone-400">{result.overview}</div> : null}
                        {scriptText ? (
                            <div>
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="text-sm font-medium">执行词正文</span>
                                    <Button size="small" icon={<Copy className="size-3" />} onClick={() => copyText(scriptText, "执行词已复制")}>
                                        复制
                                    </Button>
                                </div>
                                <div className="whitespace-pre-wrap rounded-lg bg-stone-100 p-3 text-sm leading-relaxed dark:bg-stone-950">{scriptText}</div>
                            </div>
                        ) : null}
                        {Array.isArray(result.steps) && result.steps.length ? (
                            <div className="space-y-2">
                                <div className="text-sm font-medium">执行步骤</div>
                                {result.steps.map((step) => (
                                    <div key={step.step} className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                        <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                            <span>步骤 {step.step}</span>
                                            {step.action ? <Tag className="m-0">{step.action}</Tag> : null}
                                        </div>
                                        {step.parameters ? <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">{step.parameters}</div> : null}
                                        {step.prompt ? <div className="mt-1 whitespace-pre-wrap rounded bg-stone-100 p-2 text-xs dark:bg-stone-950">{step.prompt}</div> : null}
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {Array.isArray(result.tips) && result.tips.length ? (
                            <div className="space-y-1">
                                <div className="text-sm font-medium">实用建议</div>
                                {result.tips.map((tip, i) => (
                                    <div key={i} className="rounded bg-stone-100 px-3 py-1.5 text-xs dark:bg-stone-950">· {tip}</div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="生成后在这里预览执行词" />
                )}
            </div>
        </Modal>
    );
}

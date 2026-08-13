"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button, Input, Tooltip } from "antd";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import { fillTemplate, getTemplatesByMode, type PromptTemplate } from "@/lib/prompt-templates";

type Props = {
    mode: "image" | "video" | "audio" | "text";
    onSelect: (prompt: string) => void;
};

export function CanvasPromptTemplateSelector({ mode, onSelect }: Props) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [open, setOpen] = useState(false);
    const [template, setTemplate] = useState<PromptTemplate | null>(null);
    const [values, setValues] = useState<Record<string, string>>({});

    const filterMode = mode === "image" || mode === "text" ? "image" : "video";
    const templates = getTemplatesByMode(filterMode);

    const selectTemplate = (t: PromptTemplate) => {
        const defaults: Record<string, string> = {};
        t.variables.forEach((v) => (defaults[v] = ""));
        setValues(defaults);
        setTemplate(t);
    };

    const applyTemplate = () => {
        if (!template) return;
        onSelect(fillTemplate(template.template, values));
        setTemplate(null);
        setOpen(false);
    };

    const grouped = new Map<string, PromptTemplate[]>();
    templates.forEach((t) => {
        const list = grouped.get(t.category) || [];
        list.push(t);
        grouped.set(t.category, list);
    });

    const panelStyle = {
        background: theme.toolbar.panel,
        borderColor: theme.toolbar.border,
        color: theme.node.text,
        boxShadow: "0 18px 54px rgba(28,25,23,.18)",
    };

    return (
        <div className="relative shrink-0" data-canvas-no-zoom>
            <Tooltip title="提示词模板">
                <Button
                    type="text"
                    className="!h-9 !shrink-0 !rounded-full !px-3 !text-xs"
                    style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text, border: "1px solid " + theme.node.stroke }}
                    icon={<FileText className="size-3.5" />}
                    onClick={() => setOpen(true)}
                >
                    模板
                </Button>
            </Tooltip>
            {open ? (
                <>
                    <div className="fixed inset-0 z-[200]" onClick={() => { setTemplate(null); setOpen(false); }} />
                    <div
                        className="fixed left-1/2 top-1/2 z-[210] w-[460px] max-h-[80vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border p-5"
                        style={panelStyle}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {!template ? (
                            <>
                                <div className="mb-4 text-lg font-semibold">选择提示词模板</div>
                                {Array.from(grouped.entries()).map(([category, items]) => (
                                    <div key={category} className="mb-3">
                                        <div className="mb-1.5 text-xs font-medium opacity-50">{category}</div>
                                        <div className="grid gap-1">
                                            {items.map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    className="w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:opacity-80"
                                                    style={{ borderColor: theme.node.stroke, color: theme.node.text, background: theme.node.fill }}
                                                    onClick={() => selectTemplate(t)}
                                                >
                                                    <div className="font-medium">{t.name}</div>
                                                    <div className="mt-0.5 truncate text-xs opacity-50">{t.template.slice(0, 70)}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {templates.length === 0 ? <div className="py-6 text-center text-sm opacity-50">暂无{filterMode === "image" ? "生图" : "视频"}模板</div> : null}
                            </>
                        ) : (
                            <>
                                <div className="mb-4 flex items-center gap-2">
                                    <button type="button" className="text-sm opacity-50 hover:opacity-100" onClick={() => setTemplate(null)}>← 返回</button>
                                    <span className="text-lg font-semibold">{template.name}</span>
                                </div>
                                <div className="mb-4 rounded-lg border p-3 text-xs leading-relaxed opacity-70" style={{ borderColor: theme.node.stroke }}>
                                    {template.template}
                                </div>
                                {template.variables.map((v) => (
                                    <div key={v} className="mb-3 grid gap-1">
                                        <label className="text-xs font-medium opacity-50">{v}</label>
                                        <Input
                                            value={values[v] || ""}
                                            placeholder={`输入${v}`}
                                            onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                                            onKeyDown={(e) => { if (e.key === "Enter") applyTemplate(); }}
                                            style={{ background: theme.node.fill, borderColor: theme.node.stroke, color: theme.node.text }}
                                        />
                                    </div>
                                ))}
                                <div className="flex justify-end">
                                    <Button type="primary" onClick={applyTemplate}>填入提示词</Button>
                                </div>
                            </>
                        )}
                    </div>
                </>
            ) : null}
        </div>
    );
}

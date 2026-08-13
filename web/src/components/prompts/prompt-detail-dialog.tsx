"use client";

import { Copy, FolderPlus, Sparkles } from "lucide-react";
import Image from "next/image";
import { Button, Modal, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";

import { formatPromptDate, searchSemanticPrompts, type Prompt } from "@/services/api/prompts";

export function PromptDetailDialog({ prompt, onClose, onCopy, onSaveAsset }: { prompt: Prompt | null; onClose: () => void; onCopy: (prompt: string) => void; onSaveAsset?: (prompt: Prompt) => void }) {
    const [related, setRelated] = useState<Prompt[]>([]);
    const preview = prompt?.preview.replace(/!\[[^\]]*]\([^)]+\)/g, "").trim() || "";

    useEffect(() => {
        if (!prompt) { setRelated([]); return; }
        searchSemanticPrompts(prompt.prompt.slice(0, 200), 5).then(r => {
            setRelated(r.items.filter(p => p.id !== prompt.id).slice(0, 3));
        }).catch(() => setRelated([]));
    }, [prompt]);

    return (
        <>
            <Modal title={prompt?.title} open={Boolean(prompt)} onCancel={onClose} footer={null} width={860}>
                {prompt ? (
                    <>
                        <div className="grid gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
                            <div className="space-y-3">
                                {prompt.coverUrl ? (
                                    <Image src={prompt.coverUrl} alt={prompt.title} width={400} height={300} unoptimized className="aspect-[4/3] w-full rounded-lg object-cover" />
                                ) : (
                                    <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-stone-100 text-sm text-stone-400 dark:bg-stone-800">{prompt.title.slice(0, 8)}</div>
                                )}
                                {preview ? <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-stone-100 p-3 text-xs leading-5 text-stone-600 dark:bg-stone-900 dark:text-stone-300">{preview}</pre> : null}
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap gap-1.5">
                                    {prompt.tags.map((tag) => (
                                        <Tag key={tag} className="m-0">{tag}</Tag>
                                    ))}
                                </div>
                                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-800 dark:text-stone-300">{prompt.prompt}</p>
                                <div className="mt-4 text-xs text-stone-500 dark:text-stone-400">
                                    创建：{formatPromptDate(prompt.createdAt)} · 更新：{formatPromptDate(prompt.updatedAt)}
                                </div>
                                <Space wrap className="mt-5">
                                    <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(prompt.prompt)}>复制提示词</Button>
                                    {onSaveAsset ? (
                                        <Button icon={<FolderPlus className="size-4" />} onClick={() => onSaveAsset(prompt)}>加入我的素材</Button>
                                    ) : null}
                                </Space>
                            </div>
                        </div>
                        {related.length > 0 ? (
                            <div className="mt-6 border-t pt-4">
                                <Typography.Text type="secondary" className="flex items-center gap-1 text-xs"><Sparkles className="size-3" />AI 相关推荐</Typography.Text>
                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                    {related.map(r => (
                                        <button key={r.id} type="button" className="rounded-lg border p-2 text-left text-xs transition hover:border-violet-300" onClick={() => { onCopy(prompt.prompt + "\n\n" + r.prompt); }}>
                                            <div className="font-medium truncate">{r.title}</div>
                                            <div className="mt-1 line-clamp-2 text-stone-500">{r.prompt.slice(0, 80)}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </Modal>
        </>
    );
}

"use client";

import { FolderPlus, Search, Sparkles } from "lucide-react";
import { type UIEvent, useEffect, useState } from "react";
import { App, Button, Collapse, Empty, Input, Spin, Tag } from "antd";

import { PromptCard } from "@/components/prompts/prompt-card";
import { PromptDetailDialog } from "@/components/prompts/prompt-detail-dialog";
import { usePromptList } from "@/components/prompts/use-prompt-list";
import { useCopyText } from "@/hooks/use-copy-text";
import { cn } from "@/lib/utils";
import { useAssetStore } from "@/stores/use-asset-store";
import { ALL_PROMPTS_OPTION, fetchTagTree, searchSemanticPrompts, type Prompt, type TagTreeItem } from "@/services/api/prompts";

export default function PromptsPage() {
    const { message } = App.useApp();
    const [titleInput, setTitleInput] = useState("");
    const [titleKeyword, setTitleKeyword] = useState("");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState(ALL_PROMPTS_OPTION);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
    const [semanticMode, setSemanticMode] = useState(false);
    const [semanticResults, setSemanticResults] = useState<Prompt[]>([]);
    const [semanticLoading, setSemanticLoading] = useState(false);
    const [tagTree, setTagTree] = useState<TagTreeItem[]>([]);
    const [expandedCats, setExpandedCats] = useState<string[]>([]);
    const addAsset = useAssetStore((state) => state.addAsset);
    const copyText = useCopyText();
    const { query, items: promptItems, tags: promptTags, categories: promptCategoryOptions, total: totalPrompts } = usePromptList({ keyword: titleKeyword, tags: selectedTags, category: selectedCategory });

    useEffect(() => { fetchTagTree().then(setTagTree).catch(() => {}); }, []);
    useEffect(() => {
        if (query.isError) {
            message.error(query.error instanceof Error ? query.error.message : "获取提示词失败");
        }
    }, [message, query.error, query.isError]);

    const toggleTag = (tag: string) => {
        if (tag === ALL_PROMPTS_OPTION) return setSelectedTags([]);
        setSelectedTags((items) => (items.includes(tag) ? items.filter((item) => item !== tag) : [...items, tag]));
    };

    const savePromptAsset = (item: Prompt) => {
        addAsset({ kind: "text", title: item.title, coverUrl: item.coverUrl, tags: item.tags, source: item.category, data: { content: item.prompt }, metadata: { source: "prompt-library", promptId: item.id, githubUrl: item.githubUrl } });
        message.success("已加入我的素材");
    };

    const searchByTitleInput = () => {
        setTitleKeyword(titleInput);
    };

    const handleSemanticSearch = async (q: string) => {
        if (!q.trim()) { setSemanticResults([]); return; }
        setSemanticLoading(true);
        try {
            const result = await searchSemanticPrompts(q, 20);
            setSemanticResults(result.items);
        } catch {
            message.error("语义搜索失败，请确认 AI 服务已启动");
            setSemanticResults([]);
        } finally { setSemanticLoading(false); }
    };

    const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
        const target = event.currentTarget;
        if (query.hasNextPage && !query.isFetchingNextPage && target.scrollTop + target.clientHeight >= target.scrollHeight - 160) {
            void query.fetchNextPage();
        }
    };

    const displayItems = semanticMode ? semanticResults : promptItems;
    const displayTotal = semanticMode ? semanticResults.length : totalPrompts;

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-800 dark:text-stone-100">
            <main
                className="min-h-0 flex-1 overflow-y-auto bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-8 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.16)_1px,transparent_1px)]"
                onScroll={handleListScroll}
            >
                <div className="pb-8">
                    <div className="mx-auto max-w-5xl text-center">
                        <h1 className="text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">提示词中心</h1>
                        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">共 {displayTotal} 条提示词，按标题、标签与分类快速查找灵感。</p>
                    </div>
                    {query.isLoading && !semanticMode ? (
                        <div className="flex h-60 items-center justify-center"><Spin /></div>
                    ) : null}
                    {(!query.isLoading || semanticMode) ? (
                        <>
                            <div className="mx-auto mt-8 w-full max-w-2xl">
                                <div className="flex gap-2">
                                    <Input.Search
                                        className="flex-1"
                                        size="large"
                                        allowClear
                                        prefix={semanticMode ? <Sparkles className="size-4 text-violet-400" /> : <Search className="size-4 text-stone-400" />}
                                        value={titleInput}
                                        placeholder={semanticMode ? "用自然语言描述想找的提示词…" : "按标题查询，按 Enter 搜索"}
                                        loading={semanticLoading}
                                        onChange={(event) => {
                                            setTitleInput(event.target.value);
                                            if (semanticMode) handleSemanticSearch(event.target.value);
                                        }}
                                        onSearch={(value) => {
                                            setTitleInput(value);
                                            if (semanticMode) handleSemanticSearch(value); else searchByTitleInput();
                                        }}
                                    />
                                    <Button
                                        size="large"
                                        type={semanticMode ? "primary" : "default"}
                                        icon={<Sparkles className="size-4" />}
                                        onClick={() => { setSemanticMode(!semanticMode); setSemanticResults([]); setTitleInput(""); }}
                                    >AI</Button>
                                </div>
                            </div>
                            {!semanticMode ? (
                            <div className="mx-auto mt-6 grid max-w-6xl gap-3 text-left">
                                <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                                    <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">分类</div>
                                    <div className="flex flex-wrap gap-2">
                                        {promptCategoryOptions.map((category) => (
                                            <Tag.CheckableTag key={category} checked={selectedCategory === category} className={cn("prompt-filter-tag", selectedCategory === category && "is-active")} onChange={() => setSelectedCategory(category)}>
                                                {category}
                                            </Tag.CheckableTag>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start">
                                    <div className="pt-2 text-xs font-medium text-stone-500 dark:text-stone-400">标签</div>
                                    <div>
                                        {tagTree.length > 0 ? (
                                            <Collapse ghost size="small" activeKey={expandedCats} onChange={(keys) => setExpandedCats(keys as string[])} items={tagTree.map(cat => ({
                                                key: cat.tag.name,
                                                label: <span className="text-xs font-medium">{cat.tag.category}</span>,
                                                children: <div className="flex flex-wrap gap-1.5">
                                                    {(cat.children || []).map(ch => {
                                                        const chName = ch.nameZh || ch.name;
                                                        return <Tag.CheckableTag key={ch.name} checked={selectedTags.includes(chName)} className={cn("prompt-filter-tag", selectedTags.includes(chName) && "is-active")} onChange={() => toggleTag(chName)}>{chName}</Tag.CheckableTag>;
                                                    })}
                                                </div>
                                            }))} />) : (
                                            <div className="flex flex-wrap gap-2">
                                                {promptTags.map((tag) => (
                                                    <Tag.CheckableTag key={tag} checked={tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)} className={cn("prompt-filter-tag", (tag === ALL_PROMPTS_OPTION ? selectedTags.length === 0 : selectedTags.includes(tag)) && "is-active")} onChange={() => toggleTag(tag)}>{tag}</Tag.CheckableTag>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            ) : null}
                        </>
                    ) : null}
                </div>

                {(!query.isLoading || semanticMode) ? (
                    <div>
                        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            {displayItems.map((item) => (
                                <PromptCard
                                    key={item.id}
                                    item={item}
                                    onOpen={() => setSelectedPrompt(item)}
                                    onCopy={() => copyText(item.prompt, "提示词已复制")}
                                    extraAction={
                                        <Button size="small" icon={<FolderPlus className="size-3.5" />} onClick={() => savePromptAsset(item)}>加入我的素材</Button>
                                    }
                                />
                            ))}
                        </div>
                        {displayItems.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={semanticLoading ? "搜索中…" : "没有找到匹配的提示词"} className="py-16" /> : null}
                        {!semanticMode ? (
                        <div className="mx-auto mt-6 max-w-7xl text-center text-xs text-stone-500 dark:text-stone-400">
                            {query.isFetchingNextPage ? "加载中..." : query.hasNextPage ? "继续向下滚动加载更多" : promptItems.length > 0 ? "已经到底了" : null}
                        </div>
                        ) : null}
                    </div>
                ) : null}
            </main>

            <PromptDetailDialog prompt={selectedPrompt} onClose={() => setSelectedPrompt(null)} onCopy={(prompt) => copyText(prompt, "提示词已复制")} onSaveAsset={savePromptAsset} />
        </div>
    );
}

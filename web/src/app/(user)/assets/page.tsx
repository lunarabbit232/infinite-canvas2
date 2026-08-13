"use client";

import { Copy, Download, Music2, PencilLine, Search, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Card, Drawer, Empty, Image, Input, Modal, Pagination, Select, Space, Tag, Typography } from "antd";
import { saveAs } from "file-saver";

import { useCopyText } from "@/hooks/use-copy-text";
import { formatBytes } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { useAssetStore, type Asset, type AssetKind } from "@/stores/use-asset-store";
import { exportAssets, readAssetPackage } from "./asset-transfer";
import { AssetFormModal } from "@/components/assets/asset-form-modal";
import { searchSemanticAssets, fetchAssetLibrary, type AssetLibraryItem } from "@/services/api/assets";
import { CloudDownload } from "lucide-react";

const kindOptions = [
    { label: "全部", value: "all" },
    { label: "文本", value: "text" },
    { label: "图片", value: "image" },
    { label: "视频", value: "video" },
    { label: "音频", value: "audio" },
];

export default function AssetsPage() {
    const { message } = App.useApp();
    const copyText = useCopyText();
    const assetInputRef = useRef<HTMLInputElement>(null);
    const assets = useAssetStore((state) => state.assets);
    const addAsset = useAssetStore((state) => state.addAsset);
    const removeAsset = useAssetStore((state) => state.removeAsset);
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState<AssetKind | "all">("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [isAssetOpen, setIsAssetOpen] = useState(false);
    const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
    const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
    const [semanticMode, setSemanticMode] = useState(false);
    const [semanticResults, setSemanticResults] = useState<AssetLibraryItem[]>([]);
    const [semanticLoading, setSemanticLoading] = useState(false);
    const validAssets = useMemo(() => assets.filter((asset) => asset.kind === "text" || asset.kind === "image" || asset.kind === "video" || asset.kind === "audio"), [assets]);

    const filteredAssets = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return validAssets.filter((asset) => {
            if (kindFilter !== "all" && asset.kind !== kindFilter) return false;
            if (!query) return true;
            return assetSearchText(asset).includes(query);
        });
    }, [validAssets, keyword, kindFilter]);

    const visibleAssets = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredAssets.slice(start, start + pageSize);
    }, [filteredAssets, page, pageSize]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
        setPage((value) => Math.min(value, maxPage));
    }, [filteredAssets.length, pageSize]);

    const openCreate = () => {
        setEditingAsset(null);
        setIsAssetOpen(true);
    };

    const openEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setIsAssetOpen(true);
    };

    const copyAssetText = async (asset: Asset) => {
        if (asset.kind !== "text") return;
        copyText(asset.data.content, "文本已复制");
    };

    const downloadAsset = (asset: Asset) => {
        if (asset.kind !== "image" && asset.kind !== "video" && asset.kind !== "audio") return;
        const url = asset.kind === "image" ? asset.data.dataUrl : asset.data.url;
        saveAs(url, `${asset.title || "asset"}.${asset.data.mimeType.split("/")[1] || "png"}`);
    };

    const exportAllAssets = async () => {
        if (!validAssets.length) {
            message.warning("暂无素材可导出");
            return;
        }
        await exportAssets(validAssets);
    };

    const importAssetZip = async (file?: File) => {
        if (!file) return;
        // 如果是图片/视频/音频/文本，直接导入
        if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/") || file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
            importSingleFile(file);
            return;
        }
        // zip 压缩包导入
        try {
            const importedAssets = await readAssetPackage(file);
            importedAssets.forEach((asset) => {
                const payload = { ...asset } as Record<string, unknown>;
                delete payload.id;
                delete payload.createdAt;
                delete payload.updatedAt;
                addAsset(payload as Parameters<typeof addAsset>[0]);
            });
            message.success(`已导入 ${importedAssets.length} 个素材`);
        } catch {
            message.error("导入失败，请选择有效的素材压缩包");
        }
    };

    const importSingleFile = (file: File) => {
        const isText = file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md");
        const kind: AssetKind = isText ? "text" : file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "audio";
        const url = URL.createObjectURL(file);
        const title = file.name.replace(/\.[^.]+$/, "");
        if (kind === "text") {
            const reader = new FileReader();
            reader.onload = () => {
                addAsset({
                    kind: "text", title, coverUrl: "",
                    tags: [], source: "自上传",
                    data: { content: String(reader.result || "") },
                } as Parameters<typeof addAsset>[0]);
                message.success(`已导入 ${title}`);
            };
            reader.readAsText(file);
        } else if (kind === "image") {
            const img = document.createElement("img");
            img.onload = () => {
                addAsset({
                    kind: "image", title, coverUrl: url,
                    tags: [], source: "自上传",
                    data: { dataUrl: url, width: img.width, height: img.height, bytes: file.size, mimeType: file.type },
                    metadata: {},
                } as Parameters<typeof addAsset>[0]);
                message.success(`已导入 ${title}`);
            };
            img.src = url;
        } else if (kind === "video") {
            addAsset({
                kind: "video", title, coverUrl: "",
                tags: [], source: "自上传",
                data: { url, width: 0, height: 0, bytes: file.size, mimeType: file.type },
            } as Parameters<typeof addAsset>[0]);
            message.success(`已导入 ${title}`);
        } else {
            addAsset({
                kind: "audio", title, coverUrl: "",
                tags: [], source: "自上传",
                data: { url, mimeType: file.type },
            } as Parameters<typeof addAsset>[0]);
            message.success(`已导入 ${title}`);
        }
    };

    const confirmDelete = () => {
        if (!deletingAsset) return;
        removeAsset(deletingAsset.id);
        message.success("素材已删除");
        setDeletingAsset(null);
    };

    const syncCloudAssets = async () => {
        try {
            const data = await fetchAssetLibrary({ pageSize: 200 });
            for (const item of data.items) {
                addAsset({
                    kind: (item.type === "video" ? "video" : item.type === "audio" ? "audio" : item.type === "image" ? "image" : "text") as AssetKind,
                    title: item.title,
                    coverUrl: item.coverUrl || "",
                    tags: (item.tags || []).map(t => typeof t === "string" ? t : t.name),
                    source: item.source || "云端",
                    data: item.type === "image" ? { dataUrl: item.url || "", width: item.width || 0, height: item.height || 0, bytes: item.fileSize || 0, mimeType: item.mimeType || "" }
                        : item.type === "video" || item.type === "audio" ? { url: item.url || "", mimeType: item.mimeType || "" }
                        : { content: item.content || "" },
                } as Parameters<typeof addAsset>[0]);
            }
            if (data.items.length > 0) message.success(`已同步 ${data.items.length} 个云端素材`);
        } catch { /* 静默失败 */ }
    };

    useEffect(() => { syncCloudAssets(); }, [syncCloudAssets]);

    const handleSemanticSearch = async (query: string) => {
        if (!query.trim()) {
            setSemanticResults([]);
            return;
        }
        setSemanticLoading(true);
        try {
            const result = await searchSemanticAssets(query, 20);
            setSemanticResults(result.items);
        } catch {
            message.error("语义搜索失败，请确认 AI 服务已启动");
            setSemanticResults([]);
        } finally {
            setSemanticLoading(false);
        }
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-900 dark:text-stone-100">
            <main className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] px-6 py-8 [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.14)_1px,transparent_1px)]">
                <div className="pb-8">
                    <div className="mx-auto max-w-5xl text-center">
                        <h1 className="text-4xl font-semibold tracking-tight text-stone-950 dark:text-stone-100">我的素材</h1>
                        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">收藏常用文本和图片，按类型、标题和标签快速查找。</p>
                    </div>

                    <div className="mx-auto mt-8 w-full max-w-2xl">
                        <div className="flex gap-2">
                            <Input.Search
                                className="flex-1"
                                size="large"
                                allowClear
                                prefix={semanticMode ? <Sparkles className="size-4 text-violet-400" /> : <Search className="size-4 text-stone-400" />}
                                value={keyword}
                                placeholder={semanticMode ? "用自然语言描述想找的素材…" : "搜索标题、内容、标签或来源"}
                                loading={semanticLoading}
                                onChange={(event) => {
                                    setPage(1);
                                    setKeyword(event.target.value);
                                    if (semanticMode) handleSemanticSearch(event.target.value);
                                }}
                                onSearch={(value) => {
                                    setPage(1);
                                    setKeyword(value);
                                    if (semanticMode) handleSemanticSearch(value);
                                }}
                            />
                            <Button
                                size="large"
                                type={semanticMode ? "primary" : "default"}
                                icon={<Sparkles className="size-4" />}
                                onClick={() => {
                                    setSemanticMode(!semanticMode);
                                    setSemanticResults([]);
                                    setKeyword("");
                                }}
                            >
                                {semanticMode ? "AI" : "AI"}
                            </Button>
                        </div>
                    </div>

                    <div className="mx-auto mt-6 grid max-w-6xl gap-3 text-left">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="grid gap-2 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                                <div className="text-xs font-medium text-stone-500 dark:text-stone-400">类型</div>
                                <div className="flex flex-wrap gap-2">
                                    {kindOptions.map((option) => (
                                        <Tag.CheckableTag
                                            key={option.value}
                                            checked={kindFilter === option.value}
                                            className={cn("prompt-filter-tag", kindFilter === option.value && "is-active")}
                                            onChange={() => {
                                                setPage(1);
                                                setKindFilter(option.value as AssetKind | "all");
                                            }}
                                        >
                                            {option.label}
                                        </Tag.CheckableTag>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                <button
                                    type="button"
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline dark:text-stone-300"
                                    onClick={() => void syncCloudAssets()}
                                >
                                    <CloudDownload className="mr-1 inline size-3.5" />同步云端
                                </button>
                                <button
                                    type="button"
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline dark:text-stone-300"
                                    onClick={() => void exportAllAssets()}
                                >
                                    导出素材
                                </button>
                                <button
                                    type="button"
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline dark:text-stone-300"
                                    onClick={() => assetInputRef.current?.click()}
                                >
                                    导入素材
                                </button>
                                <button
                                    type="button"
                                    className="cursor-pointer text-sm font-medium text-stone-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline dark:text-stone-300"
                                    onClick={openCreate}
                                >
                                    新增素材
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {semanticMode
                            ? semanticResults.map((item) => (
                                <SemanticAssetCard key={item.id} item={item} />
                            ))
                            : visibleAssets.map((asset) => (
                                <AssetCard key={asset.id} asset={asset} onOpen={() => setPreviewAsset(asset)} onEdit={() => openEdit(asset)} onCopy={copyAssetText} onDownload={downloadAsset} onDelete={() => setDeletingAsset(asset)} />
                            ))
                        }
                    </div>

                    {semanticMode
                        ? (!semanticResults.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={semanticLoading ? "搜索中…" : "没有找到匹配的素材"} className="py-20" /> : null)
                        : (!visibleAssets.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有找到素材" className="py-20" /> : null)
                    }

                    {!semanticMode ? (
                    <div className="flex justify-center">
                        <Pagination
                            current={page}
                            pageSize={pageSize}
                            total={filteredAssets.length}
                            showSizeChanger
                            pageSizeOptions={[10, 20, 50, 100]}
                            onChange={(nextPage, nextPageSize) => {
                                setPage(nextPage);
                                setPageSize(nextPageSize);
                            }}
                        />
                    </div>
                    ) : null}
                </div>
            </main>

            <AssetFormModal open={isAssetOpen} asset={editingAsset} onClose={() => setIsAssetOpen(false)} />

            <AssetDrawer asset={previewAsset} onClose={() => setPreviewAsset(null)} onCopy={copyAssetText} onDownload={downloadAsset} />

            <input ref={assetInputRef} type="file" multiple accept="image/*,video/*,audio/*,text/*,.txt,.md,application/zip,.zip" className="hidden" onChange={(event) => { const files = event.target.files; if (files) { const list = Array.from(files); Promise.all(list.map((f) => importAssetZip(f))).finally(() => { if (assetInputRef.current) assetInputRef.current.value = ""; }); } }} />

            <Modal title="删除素材" open={Boolean(deletingAsset)} onCancel={() => setDeletingAsset(null)} onOk={confirmDelete} okText="删除" okButtonProps={{ danger: true }} cancelText="取消">
                确定删除「{deletingAsset?.title}」吗？删除后会从我的素材中移除。
            </Modal>
        </div>
    );
}

function AssetCard({ asset, onOpen, onEdit, onCopy, onDownload, onDelete }: { asset: Asset; onOpen: () => void; onEdit: () => void; onCopy: (asset: Asset) => void; onDownload: (asset: Asset) => void; onDelete: () => void }) {
    const cover = asset.coverUrl || (asset.kind === "image" ? asset.data.dataUrl : "");
    return (
        <Card
            hoverable
            className="overflow-hidden"
            styles={{ body: { padding: 0 } }}
            cover={
                <button type="button" className="block w-full text-left" onClick={onOpen}>
                    {asset.kind === "image" && cover ? (
                        <img src={cover} alt={asset.title} className="aspect-[4/3] w-full object-cover" />
                    ) : asset.kind === "video" ? (
                        <video src={asset.data.url + "#t=0.1"} muted playsInline preload="metadata" className="aspect-[4/3] w-full bg-black object-cover" />
                    ) : asset.kind === "audio" ? (
                        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-stone-100 p-5 dark:bg-stone-900">
                            <Music2 className="size-10 opacity-30" />
                            <span className="text-xs text-stone-500 dark:text-stone-400">{asset.title}</span>
                        </div>
                    ) : (
                        <div className="flex aspect-[4/3] items-start bg-stone-100 p-5 text-sm leading-6 text-stone-600 dark:bg-stone-900 dark:text-stone-300 overflow-hidden whitespace-pre-wrap">{(asset as any).data?.content?.slice(0, 200) || "暂无内容"}</div>
                    )}
                </button>
            }
        >
            <button type="button" className="block w-full text-left" onClick={onOpen}>
                <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="line-clamp-1 text-sm font-semibold text-stone-950 dark:text-stone-100">{asset.title}</h2>
                            <Typography.Text type="secondary" className="mt-1 block text-xs">
                                {asset.source || "未标注来源"}
                            </Typography.Text>
                        </div>
                        <Tag className="m-0 shrink-0 text-[11px]">{assetKindLabel(asset.kind)}</Tag>
                    </div>
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }} className="!mb-0 !mt-2 !text-xs !leading-5">
                        {assetSummary(asset)}
                    </Typography.Paragraph>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {(asset.tags || []).slice(0, 3).map((tag) => (
                            <Tag key={tag} className="m-0 text-[11px]">
                                {tag}
                            </Tag>
                        ))}
                        {!asset.tags?.length ? <Tag className="m-0 text-[11px]">无标签</Tag> : null}
                    </div>
                </div>
            </button>
            <div className="flex items-center gap-2 px-4 pb-4">
                <Button size="small" onClick={onOpen}>
                    查看
                </Button>
                <Button size="small" icon={<PencilLine className="size-3.5" />} onClick={onEdit}>
                    编辑
                </Button>
                {asset.kind === "text" ? (
                    <Button size="small" icon={<Copy className="size-3.5" />} onClick={() => void onCopy(asset)}>
                        复制
                    </Button>
                ) : null}
                {asset.kind === "image" || asset.kind === "video" || asset.kind === "audio" ? (
                    <Button size="small" icon={<Download className="size-3.5" />} onClick={() => onDownload(asset)}>
                        下载
                    </Button>
                ) : null}
                <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={onDelete}>
                    删除
                </Button>
            </div>
        </Card>
    );
}

function AssetDrawer({ asset, onClose, onCopy, onDownload }: { asset: Asset | null; onClose: () => void; onCopy: (asset: Asset) => void; onDownload: (asset: Asset) => void }) {
    const cover = asset ? asset.coverUrl || (asset.kind === "image" ? asset.data.dataUrl : "") : "";
    return (
        <Drawer title="素材详情" open={Boolean(asset)} size="large" onClose={onClose}>
            {asset ? (
                <div className="space-y-5">
                    {cover ? (
                        <Image src={cover} alt={asset.title} className="rounded-lg" />
                    ) : (
                        <div className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm leading-6 text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">{asset.kind === "text" ? asset.data.content : "暂无封面"}</div>
                    )}
                    <div>
                        <Typography.Title level={4} className="!mb-2">
                            {asset.title}
                        </Typography.Title>
                        <Space size={[4, 4]} wrap>
                            <Tag>{assetKindLabel(asset.kind)}</Tag>
                            {(asset.tags || []).map((tag) => (
                                <Tag key={tag}>{tag}</Tag>
                            ))}
                        </Space>
                    </div>
                    <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                        <Typography.Text type="secondary" className="block text-xs">
                            内容
                        </Typography.Text>
                        {asset.kind === "text" ? (
                            <Typography.Paragraph className="mt-2 whitespace-pre-wrap">{asset.data.content}</Typography.Paragraph>
                        ) : asset.kind === "video" ? (
                            <video src={asset.data.url} controls className="mt-2 aspect-video w-full rounded-lg bg-black" />
                        ) : asset.kind === "audio" ? (
                            <audio src={asset.data.url} controls className="mt-2 w-full" />
                        ) : (
                            <Typography.Text className="mt-2 block">
                                {asset.data.width}x{asset.data.height} · {formatBytes(asset.data.bytes)} · {asset.data.mimeType}
                            </Typography.Text>
                        )}
                    </div>
                    {asset.note ? (
                        <div>
                            <Typography.Text type="secondary">备注</Typography.Text>
                            <Typography.Paragraph className="mt-1">{asset.note}</Typography.Paragraph>
                        </div>
                    ) : null}
                    <Space>
                        {asset.kind === "text" ? (
                            <Button type="primary" icon={<Copy className="size-4" />} onClick={() => onCopy(asset)}>
                                复制文本
                            </Button>
                        ) : null}
                        {asset.kind === "image" || asset.kind === "video" || asset.kind === "audio" ? (
                            <Button type="primary" icon={<Download className="size-4" />} onClick={() => onDownload(asset)}>
                                {asset.kind === "video" ? "下载视频" : asset.kind === "audio" ? "下载音频" : "下载图片"}
                            </Button>
                        ) : null}
                    </Space>
                </div>
            ) : null}
        </Drawer>
    );
}

function assetSummary(asset: Asset) {
    if (asset.kind === "text") return asset.data.content;
    if (asset.kind === "audio") return `${formatBytes(asset.data.bytes || 0)} · ${asset.data.mimeType}`;
    return `${asset.data.width}x${asset.data.height} · ${formatBytes(asset.data.bytes)} · ${asset.data.mimeType}`;
}

function assetSearchText(asset: Asset) {
    return [asset.title, asset.source || "", asset.note || "", (asset.tags || []).join(" "), asset.kind === "text" ? asset.data.content : asset.data.mimeType].join(" ").toLowerCase();
}

function assetKindLabel(kind: AssetKind) {
    if (kind === "image") return "图片";
    if (kind === "video") return "视频";
    if (kind === "audio") return "音频";
    return "文本";
}

function SemanticAssetCard({ item }: { item: AssetLibraryItem }) {
    return (
        <Card hoverable className="overflow-hidden" styles={{ body: { padding: 0 } }}>
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="line-clamp-1 text-sm font-semibold text-stone-950 dark:text-stone-100">{item.title}</h2>
                        <Typography.Text type="secondary" className="mt-1 block text-xs">
                            {item.source || item.usage || "未标注来源"}
                        </Typography.Text>
                    </div>
                    <Tag className="m-0 shrink-0 text-[11px]">{item.type === "text" ? "文本" : item.type === "image" ? "图片" : item.type === "video" ? "视频" : "音频"}</Tag>
                </div>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} className="!mb-0 !mt-2 !text-xs !leading-5">
                    {item.description || item.content || "暂无描述"}
                </Typography.Paragraph>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {(item.tags || []).slice(0, 4).map((tag) => (
                        <Tag key={tag.name} className="m-0 text-[11px]" color={tag.color}>{tag.name}</Tag>
                    ))}
                    {!item.tags?.length ? <Tag className="m-0 text-[11px]">无标签</Tag> : null}
                </div>
            </div>
        </Card>
    );
}

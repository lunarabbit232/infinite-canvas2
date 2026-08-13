"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Image as ImageIcon, Maximize2, Play, Video } from "lucide-react";
import { App, Button, Card, Empty, Image, Tag, Typography } from "antd";
import localforage from "localforage";
import { saveAs } from "file-saver";

import { useCanvasStore } from "@/app/(user)/canvas/stores/use-canvas-store";
import { formatBytes, formatDuration } from "@/lib/image-utils";
import { resolveImageUrl } from "@/services/image-storage";
import { resolveMediaUrl } from "@/services/file-storage";

type WorkItem = {
    id: string;
    type: "canvas" | "image" | "video";
    title: string;
    url: string;
    coverUrl: string;
    width: number;
    height: number;
    bytes: number;
    durationMs: number;
    createdAt: number;
};

const imageLogStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });
const videoLogStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });

export default function WorksPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const [works, setWorks] = useState<WorkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const canvasProjects = useCanvasStore((s) => s.projects);
    const canvasHydrated = useCanvasStore((s) => s.hydrated);

    useEffect(() => {
        if (!canvasHydrated) return;
        (async () => {
            try {
                setLoading(true);
                const draftItems = collectCanvasWorks(canvasProjects);
                setWorks((prev) => [...prev, ...draftItems]);

                const [imageItems, videoItems] = await Promise.all([
                    loadImageLogs(),
                    loadVideoLogs(),
                ]);
                setWorks((prev) => [...prev, ...imageItems, ...videoItems].sort((a, b) => b.createdAt - a.createdAt));
            } catch (err) {
                message.error("加载作品失败");
            } finally {
                setLoading(false);
            }
        })();
    }, [canvasHydrated, canvasProjects, message]);

    if (loading) return <WorksSkeleton />;

    const drafts = canvasProjects.filter((p) => p.nodes.length > 0);
    const images = works.filter((w) => w.type === "image");
    const videos = works.filter((w) => w.type === "video");

    return (
        <div className="h-full overflow-y-auto px-6 py-6">
            <Typography.Title level={4} className="!mb-6">我的作品</Typography.Title>

            {drafts.length > 0 ? (
                <section className="mb-8">
                    <div className="mb-3 flex items-center gap-2 text-base font-medium">
                        <Maximize2 className="size-4" />
                        草稿
                        <Tag className="m-0">{drafts.length}</Tag>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {drafts.map((proj) => (
                            <Card
                                key={proj.id}
                                hoverable
                                size="small"
                                onClick={() => router.push(`/canvas/${proj.id}`)}
                                cover={
                                    <div className="flex aspect-video items-center justify-center bg-stone-100 dark:bg-stone-800">
                                        <Maximize2 className="size-10 text-stone-300" />
                                    </div>
                                }
                            >
                                <Card.Meta title={proj.title || "未命名"} description={`${proj.nodes.length} 个节点 · ${proj.connections.length} 条连线`} />
                            </Card>
                        ))}
                    </div>
                </section>
            ) : null}

            <section className="mb-8">
                <div className="mb-3 flex items-center gap-2 text-base font-medium">
                    <ImageIcon className="size-4" />
                    已生成
                    <Tag className="m-0">{images.length + videos.length}</Tag>
                </div>
                {works.length ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {works.map((item) => (
                            <div key={item.id} className="group overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
                                {item.type === "video" ? (
                                    <video src={item.url} className="aspect-[4/3] w-full bg-black object-contain" controls preload="metadata" />
                                ) : (
                                    <Image src={item.url} alt={item.title} className="aspect-[4/3] object-cover" />
                                )}
                                <div className="p-2 text-xs">
                                    <div className="line-clamp-1 font-medium">{item.title}</div>
                                    <div className="mt-1 flex items-center justify-between text-stone-500">
                                        <span>{item.width}x{item.height} · {formatBytes(item.bytes)}</span>
                                        <Button
                                            size="small"
                                            type="text"
                                            icon={<Download className="size-3" />}
                                            onClick={(e) => { e.stopPropagation(); saveAs(item.url, `${item.type === "video" ? "video" : "image"}.${item.type === "video" ? "mp4" : "png"}`); }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty description="还没有作品，开始创作吧" />
                )}
            </section>
        </div>
    );
}

function collectCanvasWorks(projects: ReturnType<typeof useCanvasStore.getState>["projects"]): WorkItem[] {
    const items: WorkItem[] = [];
    for (const proj of projects) {
        for (const node of proj.nodes) {
            const content = node.metadata?.content as string | undefined;
            if (!content) continue;
            const isImage = (node.type as string) === "image" || (node.type as string) === "panorama";
            const isVideo = (node.type as string) === "video";
            if (!isImage && !isVideo) continue;
            items.push({
                id: node.id,
                type: isVideo ? "video" : "image",
                title: node.title || proj.title || proj.id,
                url: content,
                coverUrl: content,
                width: (node.metadata?.naturalWidth as number) || node.width,
                height: (node.metadata?.naturalHeight as number) || node.height,
                bytes: (node.metadata?.bytes as number) || 0,
                durationMs: (node.metadata?.durationMs as number) || 0,
                createdAt: Date.parse(proj.updatedAt) || Date.now(),
            });
        }
    }
    return items;
}

async function loadImageLogs(): Promise<WorkItem[]> {
    const keys = await imageLogStore.keys();
    const logs = await Promise.all(keys.map((k) => imageLogStore.getItem<any>(k)));
    return logs.filter(Boolean).flatMap((log) =>
        (log.images || []).flatMap((img: any) => {
            if (!img.dataUrl || img.dataUrl.startsWith("data:")) return [];
            return [{
                id: img.id,
                type: "image" as const,
                title: log.title || log.prompt?.slice(0, 40) || "生成图片",
                url: img.dataUrl,
                coverUrl: img.dataUrl,
                width: img.width || 0,
                height: img.height || 0,
                bytes: img.bytes || 0,
                durationMs: img.durationMs || log.durationMs || 0,
                createdAt: log.createdAt || Date.now(),
            }];
        }),
    );
}

async function loadVideoLogs(): Promise<WorkItem[]> {
    const keys = await videoLogStore.keys();
    const logs = await Promise.all(keys.map((k) => videoLogStore.getItem<any>(k)));
    return logs.filter(Boolean).flatMap((log) => {
        const video = log.video;
        if (!video?.url) return [];
        return [{
            id: video.id || log.id,
            type: "video" as const,
            title: log.title || log.prompt?.slice(0, 40) || "生成视频",
            url: video.url,
            coverUrl: video.url,
            width: video.width || 0,
            height: video.height || 0,
            bytes: video.bytes || 0,
            durationMs: video.durationMs || log.durationMs || 0,
            createdAt: log.createdAt || Date.now(),
        }];
    });
}

function WorksSkeleton() {
    return (
        <div className="h-full overflow-y-auto px-6 py-6">
            <div className="mb-6 h-8 w-28 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
            <div className="mb-8">
                <div className="mb-3 h-5 w-16 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800">
                            <div className="aspect-video animate-pulse bg-stone-100 dark:bg-stone-800" />
                            <div className="space-y-2 p-3">
                                <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200 dark:bg-stone-700" />
                                <div className="h-3 w-1/2 animate-pulse rounded bg-stone-100 dark:bg-stone-800" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

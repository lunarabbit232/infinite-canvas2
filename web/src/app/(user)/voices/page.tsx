"use client";

import { useEffect, useState } from "react";
import { App, Card, List, Spin, Tag, Typography } from "antd";
import { Mic } from "lucide-react";

import { fetchTTSVoices, type TTSVoice } from "@/services/api/tts";
import { useUserStore } from "@/stores/use-user-store";

export default function VoicesPage() {
    const { message } = App.useApp();
    const token = useUserStore((s) => s.token);
    const [voices, setVoices] = useState<TTSVoice[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) { setLoading(false); return; }
        fetchTTSVoices(token).then(setVoices).catch(() => message.error("获取声线列表失败")).finally(() => setLoading(false));
    }, [token, message]);

    return (
        <div className="h-full overflow-y-auto px-6 py-6">
            <Typography.Title level={4} className="!mb-2">声线库</Typography.Title>
            <Typography.Paragraph type="secondary">AI 配音可选声线，用于视频旁白和短剧对白。</Typography.Paragraph>

            {loading ? (
                <div className="flex justify-center py-16"><Spin /></div>
            ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {voices.map((v) => (
                        <Card key={v.id} size="small" hoverable>
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                                    <Mic className="size-5 text-stone-500" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium text-sm">{v.name}</div>
                                    <div className="text-xs text-stone-500 truncate">{v.id}</div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

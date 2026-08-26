"use client";

import { useEffect, useState } from "react";
import { App, Button, Card, Input, Typography } from "antd";
import { Mic, Play } from "lucide-react";

import { listTTSVoices, synthesizeTTS, ttsVoiceShortName, type TTSVoice } from "@/services/api/tts";
import { useUserStore } from "@/stores/use-user-store";

const SAMPLE_TEXT = "今日风和日丽，正宜泛舟湖上，闲话古今。";

export default function VoicesPage() {
    const { message } = App.useApp();
    const token = useUserStore((s) => s.token);
    const voices = listTTSVoices();
    const [sampleText, setSampleText] = useState(SAMPLE_TEXT);
    const [tryingId, setTryingId] = useState("");
    const [audioUrl, setAudioUrl] = useState("");

    useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

    const handleTry = async (voice: TTSVoice) => {
        if (!token) { message.warning("请先登录"); return; }
        if (!sampleText.trim()) { message.error("请输入试听文本"); return; }
        setTryingId(voice.id);
        try {
            const blob = await synthesizeTTS(sampleText, voice.id, token);
            setAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        } catch (err) {
            message.error(err instanceof Error ? err.message : "试听失败");
        } finally {
            setTryingId("");
        }
    };

    return (
        <div className="h-full overflow-y-auto px-6 py-6">
            <Typography.Title level={4} className="!mb-2">声线库</Typography.Title>
            <Typography.Paragraph type="secondary">AI 配音可选声线，用于视频旁白和短剧对白。点击「试听」即时合成一段样音。</Typography.Paragraph>

            <div className="mb-4 flex items-center gap-2">
                <Input value={sampleText} onChange={(e) => setSampleText(e.target.value)} placeholder="试听文本" className="max-w-md" />
                {audioUrl ? <audio controls src={audioUrl} autoPlay className="h-8" /> : null}
            </div>

            {voices.length ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {voices.map((v) => (
                        <Card key={v.id} size="small" hoverable>
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                                    <Mic className="size-5 text-stone-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm">{v.name}</div>
                                    <div className="text-xs text-stone-500 truncate">{ttsVoiceShortName(v.id)}</div>
                                </div>
                                <Button size="small" icon={<Play className="size-3.5" />} loading={tryingId === v.id} onClick={() => handleTry(v)}>
                                    试听
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

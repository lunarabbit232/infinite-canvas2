"use client";

import { useEffect, useState } from "react";
import { App, Button, Input, InputNumber, Modal, Select, Space, Tabs, Typography } from "antd";
import { useCopyText } from "@/hooks/use-copy-text";
import { clipVideoByUrl, concatVideoByUrls, transitionVideoByUrls } from "@/services/api/video";

const TRANSITION_OPTIONS = [
    { label: "淡入淡出 (fade)", value: "fade" },
    { label: "向左擦除 (wipeleft)", value: "wipeleft" },
    { label: "向右擦除 (wiperight)", value: "wiperight" },
    { label: "向左滑动 (slideleft)", value: "slideleft" },
    { label: "向右滑动 (slideright)", value: "slideright" },
    { label: "圆形展开 (circleopen)", value: "circleopen" },
];

export function CanvasVideoClipDialog({ open, videoUrl, onClose, onAddToCanvas }: { open: boolean; videoUrl: string; onClose: () => void; onAddToCanvas?: (videoUrl: string) => void }) {
    const { message } = App.useApp();
    const copyText = useCopyText();
    const [tab, setTab] = useState("clip");
    const [url, setUrl] = useState(videoUrl);
    const [start, setStart] = useState<number>(0);
    const [end, setEnd] = useState<number>(3);
    const [concatUrls, setConcatUrls] = useState(videoUrl);
    const [transUrl1, setTransUrl1] = useState(videoUrl);
    const [transUrl2, setTransUrl2] = useState("");
    const [transition, setTransition] = useState("fade");
    const [duration, setDuration] = useState<number>(1);
    const [processing, setProcessing] = useState(false);
    const [resultUrl, setResultUrl] = useState("");

    useEffect(() => {
        if (open) {
            setTab("clip");
            setUrl(videoUrl);
            setStart(0);
            setEnd(3);
            setConcatUrls(videoUrl);
            setTransUrl1(videoUrl);
            setTransUrl2("");
            setTransition("fade");
            setDuration(1);
            setResultUrl("");
        }
    }, [open, videoUrl]);

    const runClip = async () => {
        if (!url.trim()) {
            message.warning("请先填写视频地址");
            return;
        }
        if (end <= start) {
            message.warning("结束时间必须大于开始时间");
            return;
        }
        setProcessing(true);
        setResultUrl("");
        try {
            const result = await clipVideoByUrl(url.trim(), start, end);
            setResultUrl(result.url);
            message.success("截取完成");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "截取失败");
        } finally {
            setProcessing(false);
        }
    };

    const runConcat = async () => {
        const urls = concatUrls.split("\n").map((s) => s.trim()).filter(Boolean);
        if (urls.length < 2) {
            message.warning("至少需要两个视频地址（每行一个）");
            return;
        }
        setProcessing(true);
        setResultUrl("");
        try {
            const result = await concatVideoByUrls(urls);
            setResultUrl(result.url);
            message.success("拼接完成");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "拼接失败");
        } finally {
            setProcessing(false);
        }
    };

    const runTransition = async () => {
        if (!transUrl1.trim() || !transUrl2.trim()) {
            message.warning("请填写两个视频地址");
            return;
        }
        setProcessing(true);
        setResultUrl("");
        try {
            const result = await transitionVideoByUrls([transUrl1.trim(), transUrl2.trim()], transition, duration);
            setResultUrl(result.url);
            message.success("转场完成");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "转场失败");
        } finally {
            setProcessing(false);
        }
    };

    const copyFullUrl = () => {
        const full = resultUrl.startsWith("http") ? resultUrl : (typeof window !== "undefined" ? window.location.origin + resultUrl : resultUrl);
        copyText(full, "链接已复制");
    };

    const renderResult = () =>
        resultUrl ? (
            <div className="rounded-lg border p-3">
                <Typography.Text type="secondary">处理结果：</Typography.Text>
                <div className="mt-1 flex items-center gap-2">
                    <Typography.Text className="min-w-0 break-all">{resultUrl}</Typography.Text>
                    <Button size="small" onClick={copyFullUrl}>复制</Button>
                </div>
                <video src={resultUrl} controls className="mt-2 w-full rounded" />
                {onAddToCanvas ? <Button type="primary" block className="mt-3" onClick={() => onAddToCanvas(resultUrl)}>加入画布</Button> : null}
            </div>
        ) : null;

    return (
        <Modal title="视频编辑" open={open} onCancel={onClose} footer={null} width={560} destroyOnHidden>
            <Tabs
                activeKey={tab}
                onChange={setTab}
                items={[
                    {
                        key: "clip",
                        label: "截取",
                        children: (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Typography.Text type="secondary">视频地址</Typography.Text>
                                    <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://... 视频地址" />
                                </div>
                                <Space size={16}>
                                    <div className="space-y-1">
                                        <Typography.Text type="secondary">开始（秒）</Typography.Text>
                                        <InputNumber min={0} step={0.5} value={start} onChange={(v) => setStart(Number(v) || 0)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Typography.Text type="secondary">结束（秒）</Typography.Text>
                                        <InputNumber min={0.1} step={0.5} value={end} onChange={(v) => setEnd(Number(v) || 0)} />
                                    </div>
                                </Space>
                                <Button type="primary" block loading={processing} onClick={runClip}>开始截取</Button>
                            </div>
                        ),
                    },
                    {
                        key: "concat",
                        label: "拼接",
                        children: (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Typography.Text type="secondary">视频地址（每行一个，按顺序拼接）</Typography.Text>
                                    <Input.TextArea rows={5} value={concatUrls} onChange={(e) => setConcatUrls(e.target.value)} placeholder={"https://... 视频1\nhttps://... 视频2"} />
                                </div>
                                <Button type="primary" block loading={processing} onClick={runConcat}>开始拼接</Button>
                            </div>
                        ),
                    },
                    {
                        key: "transition",
                        label: "转场",
                        children: (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Typography.Text type="secondary">视频 1（前段）</Typography.Text>
                                    <Input value={transUrl1} onChange={(e) => setTransUrl1(e.target.value)} placeholder="https://... 视频1" />
                                </div>
                                <div className="space-y-1">
                                    <Typography.Text type="secondary">视频 2（后段）</Typography.Text>
                                    <Input value={transUrl2} onChange={(e) => setTransUrl2(e.target.value)} placeholder="https://... 视频2" />
                                </div>
                                <Space size={16}>
                                    <div className="space-y-1">
                                        <Typography.Text type="secondary">转场效果</Typography.Text>
                                        <Select style={{ width: 220 }} value={transition} onChange={setTransition} options={TRANSITION_OPTIONS} />
                                    </div>
                                    <div className="space-y-1">
                                        <Typography.Text type="secondary">时长（秒）</Typography.Text>
                                        <InputNumber min={0.5} max={2} step={0.5} value={duration} onChange={(v) => setDuration(Number(v) || 1)} />
                                    </div>
                                </Space>
                                <Button type="primary" block loading={processing} onClick={runTransition}>开始转场</Button>
                            </div>
                        ),
                    },
                ]}
            />
            {renderResult()}
        </Modal>
    );
}

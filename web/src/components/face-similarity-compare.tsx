"use client";

import { useState } from "react";
import { Button, Progress, Spin, Typography } from "antd";
import { CheckCircle, LoaderCircle, XCircle } from "lucide-react";

import { useFaceSimilarity } from "@/hooks/use-face-similarity";

export function FaceSimilarityCompare({ imageA, imageB, label }: { imageA: string; imageB: string; label?: string }) {
    const { ready, loading, compare } = useFaceSimilarity();
    const [result, setResult] = useState<{ score: number; error?: string } | null>(null);

    const handleCompare = async () => {
        setResult(null);
        const res = await compare(imageA, imageB);
        setResult(res);
    };

    return (
        <div className="space-y-2">
            {label ? <div className="text-xs font-medium text-stone-500">{label}</div> : null}
            <div className="flex items-center gap-2">
                <Button size="small" disabled={!ready || loading} onClick={handleCompare} icon={loading ? <LoaderCircle className="size-3.5 animate-spin" /> : null}>
                    {ready ? "比对人像" : "模型加载中..."}
                </Button>
                {result ? (
                    result.error ? (
                        <span className="flex items-center gap-1 text-xs text-stone-400"><XCircle className="size-3.5" />{result.error}</span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs">
                            <CheckCircle className="size-3.5 text-green-500" />
                            <Progress percent={result.score} size="small" style={{ width: 80 }} strokeColor={result.score > 60 ? "#22c55e" : result.score > 30 ? "#f59e0b" : "#ef4444"} />
                        </span>
                    )
                ) : null}
            </div>
        </div>
    );
}

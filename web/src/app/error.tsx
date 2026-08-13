"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Unhandled error:", error);
    }, [error]);

    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
            <AlertTriangle className="size-10 text-amber-500" />
            <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">页面出错了</h1>
            <p className="max-w-md text-sm text-stone-500">
                {error.message || "发生了意外错误，请刷新页面重试。"}
            </p>
            <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-4 py-2 text-sm text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-200"
            >
                <RefreshCw className="size-4" />
                重试
            </button>
        </div>
    );
}

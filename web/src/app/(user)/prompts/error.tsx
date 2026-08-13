"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function PageError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => { console.error(error); }, [error]);

    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertTriangle className="size-8 text-amber-500" />
            <p className="text-sm text-stone-500">这个模块出了点问题</p>
            <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs transition hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-900">
                <RefreshCw className="size-3.5" /> 重试
            </button>
        </div>
    );
}

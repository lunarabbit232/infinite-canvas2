"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "antd";

export default function IndexPage() {
    const [visible, setVisible] = useState(false);

    useEffect(() => { setVisible(true); }, []);

    return (
        <main className="relative flex h-full items-center justify-center overflow-hidden bg-background">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(rgba(245,245,244,.12)_1px,transparent_1px)]" />

            <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
                <div
                    className={`flex items-center gap-3 transition-all duration-1000 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
                >
                    <span
                        className="size-10 bg-stone-950 dark:bg-stone-100"
                        style={{
                            mask: "url(/logo.svg) center / contain no-repeat",
                            WebkitMask: "url(/logo.svg) center / contain no-repeat",
                            transitionDelay: "200ms",
                        }}
                    />
                    <span
                        className="text-5xl font-bold tracking-tight text-stone-950 dark:text-stone-100 sm:text-6xl"
                        style={{ transitionDelay: "400ms" }}
                    >
                        无限画布
                    </span>
                </div>

                <p
                    className={`max-w-md text-balance text-base leading-7 text-stone-500 transition-all duration-1000 ease-out dark:text-stone-400 ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                    style={{ transitionDelay: "600ms" }}
                >
                    AI 驱动的创作平台——生图·做视频·搭工作流，一切从画布开始
                </p>

                <div
                    className={`transition-all duration-1000 ease-out ${visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95"}`}
                    style={{ transitionDelay: "800ms" }}
                >
                    <Button
                        type="primary"
                        size="large"
                        href="/canvas"
                        icon={<Sparkles className="size-4" />}
                        iconPlacement="end"
                        className="!h-12 !rounded-xl !px-8 !text-base"
                    >
                        开始创作
                    </Button>
                </div>
            </div>
        </main>
    );
}

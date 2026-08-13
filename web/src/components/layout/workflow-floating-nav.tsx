"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Footprints } from "lucide-react";

const workflowSteps = [
    { slug: "workflows", label: "工作流" },
    { slug: "image", label: "生图" },
    { slug: "video", label: "视频" },
];

export function WorkflowFloatingNav() {
    const pathname = usePathname();
    const [hovered, setHovered] = useState(false);
    const currentSlug = pathname.split("/").filter(Boolean)[0];
    const currentIndex = workflowSteps.findIndex((s) => s.slug === currentSlug);
    if (currentIndex < 0) return null;

    return (
        <div
            className="pointer-events-auto fixed right-3 top-1/2 z-40 -translate-y-1/2"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div className="flex items-center gap-2">
                <div
                    className={`overflow-hidden rounded-2xl border bg-background/95 shadow-lg backdrop-blur transition-all duration-300 ${hovered ? "w-28 px-3 py-2" : "w-0 px-0"}`}
                    style={{ borderColor: "var(--stone-200, #e5e7eb)" }}
                >
                    <div className="grid gap-1">
                        {workflowSteps.map((step, i) => {
                            const isCurrent = i === currentIndex;
                            const isPast = i < currentIndex;
                            const isFuture = i > currentIndex;
                            return (
                                <Link
                                    key={step.slug}
                                    href={`/${step.slug}`}
                                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs transition ${isCurrent ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100" : isPast ? "text-stone-400 hover:text-stone-600" : "text-stone-300 hover:text-stone-500"}`}
                                >
                                    <span
                                        className={`flex size-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${isCurrent ? "bg-stone-950 text-white dark:bg-white dark:text-stone-950" : isPast ? "bg-stone-300 text-white dark:bg-stone-600" : "border border-stone-200 dark:border-stone-700"}`}
                                    >
                                        {isPast ? "✓" : i + 1}
                                    </span>
                                    <span>{step.label}</span>
                                    {i < workflowSteps.length - 1 ? <ArrowRight className="size-2.5 shrink-0 text-stone-300" /> : null}
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <button
                    type="button"
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full border shadow-lg backdrop-blur transition ${hovered ? "bg-stone-100 dark:bg-stone-800" : "bg-background/95"}`}
                    style={{ borderColor: "var(--stone-200, #e5e7eb)" }}
                >
                    <Footprints className="size-4 text-stone-500" />
                </button>
            </div>
        </div>
    );
}

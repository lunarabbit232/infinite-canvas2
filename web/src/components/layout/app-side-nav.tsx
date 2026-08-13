"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FolderOpen, Image as ImageIcon, Mic, Music, Package, UserRound } from "lucide-react";

import { navigationTools, assetLibraryItems, type NavigationToolSlug } from "@/constant/navigation-tools";
import { UserStatusActions } from "@/components/layout/user-status-actions";
import { cn } from "@/lib/utils";

const assetIcons: Record<string, React.ReactNode> = {
    user: <UserRound className="size-4 shrink-0" />,
    file: <FileText className="size-4 shrink-0" />,
    music: <Mic className="size-4 shrink-0" />,
    image: <ImageIcon className="size-4 shrink-0" />,
    box: <Package className="size-4 shrink-0" />,
};

export function AppSideNav() {
    const pathname = usePathname();
    const slug = pathname.split("/").filter(Boolean)[0];
    const activeToolSlug = navigationTools.some((tool) => tool.slug === slug) ? (slug as NavigationToolSlug) : undefined;

    return (
        <aside className="flex h-dvh w-52 shrink-0 flex-col border-r border-stone-200 bg-background dark:border-stone-800">
            <Link href="/" className="flex shrink-0 items-center gap-2 px-4 py-3.5">
                <span
                    className="size-6 shrink-0 bg-stone-950 dark:bg-stone-100"
                    style={{ mask: "url(/logo.svg) center / contain no-repeat", WebkitMask: "url(/logo.svg) center / contain no-repeat" }}
                />
                <span className="text-sm font-semibold tracking-tight text-stone-950 dark:text-stone-100">无限画布</span>
            </Link>

            <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-1">
                <div className="grid gap-0.5">
                    {navigationTools.map((tool) => {
                        const Icon = tool.icon;
                        const active = tool.slug === activeToolSlug;
                        return (
                            <Link
                                key={tool.slug}
                                href={`/${tool.slug}`}
                                className={cn(
                                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                                    active
                                        ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100"
                                        : "text-stone-500 hover:bg-stone-50 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100",
                                )}
                            >
                                <Icon className="size-4 shrink-0" />
                                <span className="truncate">{tool.label}</span>
                            </Link>
                        );
                    })}
                </div>

                <div className="mt-3 border-t border-stone-200 pt-2 dark:border-stone-800">
                    <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-stone-400">
                        资产库
                    </div>
                    <div className="grid gap-0.5">
                        {assetLibraryItems.map((item) => {
                            const active = slug === item.slug;
                            return (
                                <Link
                                    key={item.slug}
                                    href={`/${item.slug}`}
                                    className={cn(
                                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                                        active
                                            ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100"
                                            : "text-stone-500 hover:bg-stone-50 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100",
                                    )}
                                >
                                    {assetIcons[item.icon]}
                                    <span className="truncate">{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-2 border-t border-stone-200 pt-2 dark:border-stone-800">
                    <Link
                        href="/works"
                        className={cn(
                            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                            slug === "works"
                                ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100"
                                : "text-stone-500 hover:bg-stone-50 hover:text-stone-950 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100",
                        )}
                    >
                        <FolderOpen className="size-4 shrink-0" />
                        <span>我的作品</span>
                    </Link>
                </div>
            </nav>

            <div className="shrink-0 border-t border-stone-200 px-3 py-2 dark:border-stone-800">
                <UserStatusActions />
            </div>
        </aside>
    );
}

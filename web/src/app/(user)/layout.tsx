"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AppSideNav } from "@/components/layout/app-side-nav";
import { WorkflowFloatingNav } from "@/components/layout/workflow-floating-nav";
import { AppConfigModal } from "@/components/layout/app-config-modal";
import { fetchUserConfig } from "@/services/api/user-config";
import { useUserStore } from "@/stores/use-user-store";

const protectedPrefixes = ["/asset-library"];

export default function UserLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const user = useUserStore((state) => state.user);
    const isReady = useUserStore((state) => state.isReady);
    const wasLoggedOutRef = useRef(false);
    const isProtectedPage = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    const isLanding = pathname === "/";
    const isCanvasEditor = /^\/canvas\/[^/]+/.test(pathname);

    useEffect(() => {
        if (!isReady || !isProtectedPage || user) return;
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }, [isProtectedPage, isReady, pathname, router, user]);

    useEffect(() => {
        if (!isReady) return;
        if (!user) { wasLoggedOutRef.current = true; return; }
        const syncCanvasAfterLogin = wasLoggedOutRef.current;
        const token = useUserStore.getState().token;
        if (!token) return;
        wasLoggedOutRef.current = false;
        fetchUserConfig(token).then(async (config) => {
            const syncEnabled = config.syncCapabilities?.userData === true;
            const { useCanvasStore } = await import("@/app/(user)/canvas/stores/use-canvas-store");
            const canvasStore = useCanvasStore.getState();
            canvasStore.setSyncEnabled(syncEnabled);
            if (syncCanvasAfterLogin && syncEnabled && canvasStore.hydrated) {
                void canvasStore.syncWithRemote(token, true);
            }
            const { useAssetStore } = await import("@/stores/use-asset-store");
            void useAssetStore.getState().hydrateAccountAssets(token, syncEnabled);
        }).catch(() => {});
    }, [isReady, user]);

    if (isLanding || isCanvasEditor) {
        return (
            <>
                <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
                    <div className="min-h-0 flex-1 overflow-hidden">{isProtectedPage && (!isReady || !user) ? null : children}</div>
                </div>
                <AppConfigModal />
            </>
        );
    }

    return (
        <>
            <div className="flex h-dvh overflow-hidden bg-background text-foreground">
                <AppSideNav />
                <div className="min-w-0 flex-1 overflow-hidden">
                    <WorkflowFloatingNav />
                    {isProtectedPage && (!isReady || !user) ? null : children}
                </div>
            </div>
            <AppConfigModal />
        </>
    );
}

import localforage from "localforage";
import { uploadImage } from "./image-storage";
import { uploadMediaBlob } from "./file-storage";
import { useCanvasStore } from "@/app/(user)/canvas/stores/use-canvas-store";
import { useAssetStore, mergeAssets } from "@/stores/use-asset-store";
import { useUserStore } from "@/stores/use-user-store";
import { fetchUserConfig, syncUserAssetData, syncUserImageHistory } from "./api/user-config";
import { saveVideoGenerationLogs } from "./api/generation-logs";

export async function checkLocalAssetsExist(): Promise<boolean> {
    const imageStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_files" });
    const mediaStore = localforage.createInstance({ name: "infinite-canvas", storeName: "media_files" });

    let found = false;
    try {
        await imageStore.iterate((_val, key) => {
            if (key.startsWith("image:")) {
                found = true;
                return true; // Stop iteration early
            }
        });
        if (found) return true;

        await mediaStore.iterate((_val, key) => {
            if (key.startsWith("file:") || key.startsWith("video:") || key.startsWith("asset-video:") || key.startsWith("asset-audio:")) {
                found = true;
                return true; // Stop iteration early
            }
        });
    } catch (e) {
        console.error("checkLocalAssetsExist error", e);
    }
    return found;
}

export async function migrateLocalAssetsToCloud(
    onProgress: (current: number, total: number) => void
): Promise<void> {
    const token = useUserStore.getState().token;
    if (!token) throw new Error("请先登录");

    // 先拉取云端已存的数据
    const userConfig = await fetchUserConfig(token).catch(() => null);
    const remoteAssets = userConfig?.assetData as { assets?: any[] } | undefined;

    const imageStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_files" });
    const mediaStore = localforage.createInstance({ name: "infinite-canvas", storeName: "media_files" });

    // 1. Gather all local keys and their blobs
    const imagesToUpload: { key: string; blob: Blob }[] = [];
    await imageStore.iterate((blob, key) => {
        if (key.startsWith("image:") && blob instanceof Blob) {
            imagesToUpload.push({ key, blob });
        }
    });

    const mediaToUpload: { key: string; blob: Blob }[] = [];
    await mediaStore.iterate((blob, key) => {
        if ((key.startsWith("file:") || key.startsWith("video:") || key.startsWith("asset-video:") || key.startsWith("asset-audio:")) && blob instanceof Blob) {
            mediaToUpload.push({ key, blob });
        }
    });

    const total = imagesToUpload.length + mediaToUpload.length;
    if (total === 0) return;

    let current = 0;
    const keyMapping = new Map<string, { serverKey: string; url: string }>();

    // 2. Upload images to S3
    for (const item of imagesToUpload) {
        try {
            const result = await uploadImage(item.blob);
            if (result.storageKey && result.storageKey.startsWith("server:")) {
                keyMapping.set(item.key, { serverKey: result.storageKey, url: result.url });
            }
        } catch (e) {
            console.error(`Failed to migrate image ${item.key}`, e);
        }
        current++;
        onProgress(current, total);
    }

    // 3. Upload media to S3
    for (const item of mediaToUpload) {
        try {
            const ext = item.blob.type.split("/")[1] || "mp4";
            const filename = `media-${item.key.replace(":", "-")}.${ext}`;
            const result = await uploadMediaBlob(item.blob, filename);
            if (result.storageKey && result.storageKey.startsWith("server:")) {
                keyMapping.set(item.key, { serverKey: result.storageKey, url: result.url });
            }
        } catch (e) {
            console.error(`Failed to migrate media ${item.key}`, e);
        }
        current++;
        onProgress(current, total);
    }

    if (keyMapping.size === 0) return;

    // Helper to replace keys and blob URLs in any text/json
    const replaceKeysInString = async (jsonStr: string): Promise<string> => {
        let resultStr = jsonStr;
        const { resolveImageUrl } = await import("./image-storage");
        const { resolveMediaUrl } = await import("./file-storage");

        for (const [localKey, value] of keyMapping.entries()) {
            resultStr = resultStr.replaceAll(`"${localKey}"`, `"${value.serverKey}"`);
            resultStr = resultStr.replaceAll(`:${localKey}`, `:${value.serverKey}`);
            resultStr = resultStr.replaceAll(localKey, value.serverKey);

            if (localKey.startsWith("image:")) {
                const localBlobUrl = await resolveImageUrl(localKey);
                if (localBlobUrl && localBlobUrl.startsWith("blob:")) {
                    resultStr = resultStr.replaceAll(localBlobUrl, value.url);
                }
            } else if (localKey.startsWith("file:") || localKey.startsWith("video:") || localKey.startsWith("asset-video:") || localKey.startsWith("asset-audio:")) {
                const localBlobUrl = await resolveMediaUrl(localKey);
                if (localBlobUrl && localBlobUrl.startsWith("blob:")) {
                    resultStr = resultStr.replaceAll(localBlobUrl, value.url);
                }
            }
        }
        return resultStr;
    };

    // 4. Update Canvas projects
    const canvasProjects = useCanvasStore.getState().projects;
    if (canvasProjects.length > 0) {
        try {
            const canvasStr = JSON.stringify({
                projects: canvasProjects,
            });
            const replacedCanvasStr =
                await replaceKeysInString(canvasStr);
            const nextCanvas = JSON.parse(replacedCanvasStr);
            const finalCanvas = {
                projects: nextCanvas.projects || [],
            };
            await localforage
                .createInstance({
                    name: "infinite-canvas",
                    storeName: "app_state",
                })
                .setItem(
                    "infinite-canvas:canvas_store",
                    JSON.stringify({
                        state: finalCanvas,
                        version: 0,
                    }),
                );
            useCanvasStore.setState(finalCanvas);
            await useCanvasStore.getState().syncWithRemote(
                token,
                true,
            );
        } catch (error) {
            console.error(
                "Failed to migrate canvas projects",
                error,
            );
        }
    }

    // 5. Update Asset store
    const assets = useAssetStore.getState().assets;
    if (assets.length > 0) {
        try {
            const assetsStr = JSON.stringify({ assets });
            const replacedAssetsStr = await replaceKeysInString(assetsStr);
            const nextAssets = JSON.parse(replacedAssetsStr);
            // 与云端已存的资产执行智能合并，防止覆盖云端其它设备的数据
            const mergedAssets = mergeAssets(remoteAssets?.assets || [], nextAssets.assets);
            const finalAssets = { assets: mergedAssets };
            // Save locally
            await localforage.createInstance({ name: "infinite-canvas", storeName: "app_state" })
                .setItem("infinite-canvas:asset_store", JSON.stringify({ state: finalAssets }));
            // Set in Zustand store
            useAssetStore.setState(finalAssets);
            // Sync to server
            await syncUserAssetData(token, finalAssets);
        } catch (e) {
            console.error("Failed to migrate assets", e);
        }
    }

    // 6. Update Image Generation Logs
    const imageLogStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });
    const imageCategoryStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_categories" });
    const localLogs: any[] = [];
    await imageLogStore.iterate((value) => {
        localLogs.push(value);
    });
    const localCategories = (await imageCategoryStore.getItem<any[]>("infinite-canvas:image_generation_categories")) || [];

    if (localLogs.length > 0 || localCategories.length > 0) {
        try {
            const logsStr = JSON.stringify({ logs: localLogs, categories: localCategories });
            const replacedLogsStr = await replaceKeysInString(logsStr);
            const nextLogsData = JSON.parse(replacedLogsStr);

            // Save locally
            await imageLogStore.clear();
            await Promise.all(
                nextLogsData.logs.map((log: any) => imageLogStore.setItem(log.id, log))
            );
            await imageCategoryStore.setItem("infinite-canvas:image_generation_categories", nextLogsData.categories);

            // Sync to server
            await syncUserImageHistory(token, { logs: nextLogsData.logs, categories: nextLogsData.categories });
        } catch (e) {
            console.error("Failed to migrate image logs", e);
        }
    }

    // 7. Update Video Generation Logs
    const videoLogStore = localforage.createInstance({ name: "infinite-canvas", storeName: "video_generation_logs" });
    const localVideoLogs: any[] = [];
    await videoLogStore.iterate((value) => {
        localVideoLogs.push(value);
    });

    if (localVideoLogs.length > 0) {
        try {
            const videoLogsStr = JSON.stringify({ logs: localVideoLogs });
            const replacedVideoLogsStr = await replaceKeysInString(videoLogsStr);
            const nextVideoLogsData = JSON.parse(replacedVideoLogsStr);

            // Save locally
            await videoLogStore.clear();
            await Promise.all(
                nextVideoLogsData.logs.map((log: any) => videoLogStore.setItem(log.id, log))
            );

            // Sync to server
            await saveVideoGenerationLogs(token, nextVideoLogsData.logs);
        } catch (e) {
            console.error("Failed to migrate video logs", e);
        }
    }

    // 8. Cache old local files under the new server keys
    for (const [localKey, value] of keyMapping.entries()) {
        if (localKey.startsWith("image:")) {
            const blob = await imageStore.getItem<Blob>(localKey);
            if (blob) {
                await imageStore.setItem(value.serverKey, blob);
                await imageStore.removeItem(localKey);
            }
        } else if (localKey.startsWith("file:") || localKey.startsWith("video:") || localKey.startsWith("asset-video:") || localKey.startsWith("asset-audio:")) {
            const blob = await mediaStore.getItem<Blob>(localKey);
            if (blob) {
                await mediaStore.setItem(value.serverKey, blob);
                await mediaStore.removeItem(localKey);
            }
        }
    }
}

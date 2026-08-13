"use client";

import { useEffect, useRef, useState } from "react";

type FaceSimilarityResult = { score: number; error?: string };

let faceApiModule: typeof import("@vladmandic/face-api") | null = null;
let faceApiLoading: Promise<typeof import("@vladmandic/face-api") | null> | null = null;
const subscribers = new Set<(ready: boolean) => void>();

function notifyReady() {
    subscribers.forEach((fn) => fn(!!faceApiModule));
}

async function loadFaceApi() {
    if (faceApiModule) return faceApiModule;
    if (faceApiLoading) return faceApiLoading;
    faceApiLoading = (async () => {
        try {
            const faceapi = await import("@vladmandic/face-api");
                await faceapi.nets.ssdMobilenetv1.loadFromUri("/assets/face-models");
                await faceapi.nets.faceLandmark68Net.loadFromUri("/assets/face-models");
                await faceapi.nets.faceRecognitionNet.loadFromUri("/assets/face-models");
            faceApiModule = faceapi;
            notifyReady();
            return faceapi;
        } catch {
            faceApiModule = null;
            notifyReady();
            return null;
        }
    })();
    return faceApiLoading;
}

export function useFaceSimilarity() {
    const [ready, setReady] = useState(!!faceApiModule);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const cb = (r: boolean) => setReady(r);
        subscribers.add(cb);
        if (!faceApiModule && !faceApiLoading) loadFaceApi();
        else if (faceApiModule) setReady(true);
        return () => { subscribers.delete(cb); };
    }, []);

    const compare = async (imageUrl1: string, imageUrl2: string): Promise<FaceSimilarityResult> => {
        if (!faceApiModule) return { score: 0, error: "模型未就绪" };
        setLoading(true);
        try {
            const [img1, img2] = await Promise.all([loadImage(imageUrl1), loadImage(imageUrl2)]);
            if (!img1 || !img2) return { score: 0, error: "图片加载失败" };

            const desc1 = await extractDescriptor(faceApiModule, img1);
            if (!desc1) return { score: 0, error: "未在参考图中检测到人脸" };

            const desc2 = await extractDescriptor(faceApiModule, img2);
            if (!desc2) return { score: 0, error: "未在生成图中检测到人脸" };

            const distance = faceApiModule.euclideanDistance(desc1, desc2);
            const score = Math.max(0, Math.round((1 - distance) * 100));
            return { score };
        } catch (e) {
            return { score: 0, error: e instanceof Error ? e.message : "比对失败" };
        } finally {
            setLoading(false);
        }
    };

    return { ready, loading, compare };
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function extractDescriptor(
    faceapi: typeof import("@vladmandic/face-api"),
    img: HTMLImageElement,
): Promise<Float32Array | null> {
    const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    return detections?.descriptor || null;
}

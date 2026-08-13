"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CanvasPanoramaViewer = dynamic(() => import("../../components/canvas-panorama-viewer"), { ssr: false, loading: () => null });

export function FullscreenPreview({ src, alt, isPanorama, onClose, hasPrev, hasNext, onPrev, onNext }: { src: string; alt: string; isPanorama?: boolean; onClose: () => void; hasPrev?: boolean; hasNext?: boolean; onPrev?: () => void; onNext?: () => void }) {
    const [zoom, setZoom] = useState<number>(1);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        const el = imgRef.current;
        if (!el) return;
        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    });

    const handleWheel = (e: WheelEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setZoom((z) => {
            const next = Math.max(0.2, Math.min(8, z - e.deltaY * 0.001));
            if (next <= 1) setPanOffset({ x: 0, y: 0 });
            return next;
        });
    };

    const handlePointerDown = (e: ReactPointerEvent) => {
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY, panX: panOffset.x, panY: panOffset.y };
    };

    const handlePointerMove = (e: ReactPointerEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setPanOffset({
            x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
            y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
        });
    };

    const handlePointerUp = (e: ReactPointerEvent) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm" data-canvas-no-zoom={isPanorama ? "" : undefined} onClick={onClose}>
            {hasPrev || hasNext ? (
                <>
                    <button
                        type="button"
                        disabled={!hasPrev}
                        onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute left-4 top-1/2 z-[2010] -translate-y-1/2 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="size-6" />
                    </button>
                    <button
                        type="button"
                        disabled={!hasNext}
                        onClick={(e) => { e.stopPropagation(); onNext?.(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute right-4 top-1/2 z-[2010] -translate-y-1/2 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-all hover:bg-white/10 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="size-6" />
                    </button>
                </>
            ) : null}
            {isPanorama ? (
                <div className="h-[85vh] w-[85vw] supports-[height:round(1px,1px)]:h-[round(85vh,1px)] supports-[height:round(1px,1px)]:w-[round(85vw,1px)] overflow-hidden rounded-2xl shadow-[0_24px_72px_rgba(0,0,0,0.4)]" onClick={(event) => event.stopPropagation()}>
                    <CanvasPanoramaViewer src={src} alt={alt} immersive />
                </div>
            ) : (
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt}
                    draggable={false}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className={`max-h-[85vh] max-w-[85vw] object-contain rounded-2xl shadow-[0_24px_72px_rgba(0,0,0,0.4)] ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
                    onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transition: isDragging ? "none" : "transform 0.12s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                    }}
                />
            )}
        </div>
    );
}

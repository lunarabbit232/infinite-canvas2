"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button, InputNumber, Modal } from "antd";
import { Grid2x2, ListRestart, PanelTop, Rows3, Trash2 } from "lucide-react";

import { readImageMeta } from "@/lib/image-utils";
import type { ImageSplitParams } from "../utils/canvas-image-data";

export type CanvasImageSplitParams = ImageSplitParams;

const defaultParams: CanvasImageSplitParams = { horizontalLines: [0.5], verticalLines: [0.5] };
const maxGridSize = 12;
type SplitAxis = "horizontal" | "vertical";
type ActiveLine = { axis: SplitAxis; index: number } | null;

export function CanvasNodeSplitDialog({ dataUrl, open, onClose, onConfirm }: { dataUrl: string; open: boolean; onClose: () => void; onConfirm: (params: CanvasImageSplitParams) => void }) {
    const [params, setParams] = useState(defaultParams);
    const [image, setImage] = useState<{ width: number; height: number } | null>(null);
    const [active, setActive] = useState<ActiveLine>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; box: DOMRect } | null>(null);
    const horizontalLines = params.horizontalLines;
    const verticalLines = params.verticalLines;
    const rows = horizontalLines.length + 1;
    const columns = verticalLines.length + 1;
    const total = rows * columns;
    const pieceSize = image ? { width: Math.max(1, Math.floor(image.width / columns)), height: Math.max(1, Math.floor(image.height / rows)) } : null;

    useEffect(() => {
        if (!open) return;

        let cancelled = false;

        setParams(defaultParams);
        setActive(null);
        setImage(null);
        dragRef.current = null;

        void readImageMeta(dataUrl).then((metadata) => {
            if (!cancelled) setImage(metadata);
        });

        return () => {
            cancelled = true;
            dragRef.current = null;
        };
    }, [dataUrl, open]);

    const updateCount = (axis: SplitAxis, value: string | number | null) => {
        const currentCount = axis === "horizontal" ? rows : columns;
        const count = clampGrid(value ?? currentCount);
        const key = axis === "horizontal" ? "horizontalLines" : "verticalLines";

        setActive(null);
        setParams((current) => ({ ...current, [key]: buildGridLines(count) }));
    };

    const addLine = (axis: SplitAxis) => {
        const key = axis === "horizontal" ? "horizontalLines" : "verticalLines";

        setActive(null);
        setParams((current) => {
            const lines = current[key];
            if (lines.length >= maxGridSize - 1) return current;
            return { ...current, [key]: [...lines, findLineSpot(lines)].sort((a, b) => a - b) };
        });
    };

    const deleteLine = () => {
        if (!active) return;
        const key = active.axis === "horizontal" ? "horizontalLines" : "verticalLines";
        setParams((current) => ({ ...current, [key]: current[key].filter((_, index) => index !== active.index) }));
        setActive(null);
    };

    const setLine = (axis: SplitAxis, index: number, value: number) => {
        const key = axis === "horizontal" ? "horizontalLines" : "verticalLines";
        setParams((current) => {
            const lines = [...current[key]];
            lines[index] = clampLine(value, lines[index - 1] ?? 0, lines[index + 1] ?? 1);
            return { ...current, [key]: lines };
        });
    };

    const startDrag = (axis: SplitAxis, index: number, event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current) return;
        const box = previewRef.current?.getBoundingClientRect();
        if (!box || box.width <= 0 || box.height <= 0) return;

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { pointerId: event.pointerId, box };
        setActive({ axis, index });
    };

    const moveLine = (axis: SplitAxis, index: number, event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const value = axis === "horizontal" ? (event.clientY - drag.box.top) / drag.box.height : (event.clientX - drag.box.left) / drag.box.width;
        setLine(axis, index, value);
    };

    const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };

    const resetLines = () => {
        setActive(null);
        setParams((current) => ({
            horizontalLines: buildGridLines(current.horizontalLines.length + 1),
            verticalLines: buildGridLines(current.verticalLines.length + 1),
        }));
    };

    return (
        <Modal title={null} open={open && Boolean(dataUrl)} onCancel={onClose} footer={null} width={780} centered destroyOnHidden>
            <div className="space-y-5">
                <div>
                    <h2 className="text-xl font-semibold">切分图片</h2>
                    <p className="mt-1 text-sm opacity-60">生成 {total} 个图片子节点，并按原图网格排列到画布右侧</p>
                </div>
                <div className="grid gap-6 md:grid-cols-[minmax(260px,1fr)_280px]">
                    <div className="rounded-xl border p-4">
                        <div className="grid min-h-[300px] place-items-center rounded-lg bg-black/5">
                            <div ref={previewRef} className="relative inline-block max-w-full overflow-hidden rounded-lg bg-black shadow-xl">
                                <img src={dataUrl} alt="" className="block max-h-[340px] max-w-full object-contain opacity-95" draggable={false} />
                                <SplitGrid horizontalLines={horizontalLines} verticalLines={verticalLines} active={active} onPointerDown={startDrag} onPointerMove={moveLine} onPointerEnd={endDrag} />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="opacity-60">原图</span>
                            <span className="font-semibold">{image ? `${image.width} x ${image.height} px` : "读取中"}</span>
                        </div>
                    </div>
                    <div className="space-y-5 py-2">
                        <NumberField label="行数" value={rows} onChange={(value) => updateCount("horizontal", value)} />
                        <NumberField label="列数" value={columns} onChange={(value) => updateCount("vertical", value)} />
                        <div className="grid grid-cols-2 gap-2">
                            <Button icon={<Rows3 className="size-4" />} disabled={rows >= maxGridSize} onClick={() => addLine("horizontal")}>横向线</Button>
                            <Button icon={<PanelTop className="size-4 rotate-90" />} disabled={columns >= maxGridSize} onClick={() => addLine("vertical")}>纵向线</Button>
                            <Button icon={<Trash2 className="size-4" />} disabled={!active} onClick={deleteLine}>删除线</Button>
                            <Button icon={<ListRestart className="size-4" />} onClick={resetLines}>重置线</Button>
                        </div>
                        <div className="rounded-xl border px-4 py-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="opacity-60">切片数量</span>
                                <span className="font-semibold">{total} 个</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span className="opacity-60">平均约</span>
                                <span className="font-semibold">{pieceSize ? `${pieceSize.width} x ${pieceSize.height}` : "未知"}</span>
                            </div>
                        </div>
                        <Button type="primary" size="large" className="w-full" icon={<Grid2x2 className="size-4" />} onClick={() => onConfirm(params)}>
                            生成子节点
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: string | number | null) => void }) {
    return (
        <label className="block space-y-2">
            <span className="font-medium opacity-75">{label}</span>
            <InputNumber className="w-full" min={1} max={maxGridSize} precision={0} value={value} onChange={onChange} />
        </label>
    );
}

function SplitGrid({ horizontalLines, verticalLines, active, onPointerDown, onPointerMove, onPointerEnd }: { horizontalLines: number[]; verticalLines: number[]; active: ActiveLine; onPointerDown: (axis: SplitAxis, index: number, event: ReactPointerEvent<HTMLDivElement>) => void; onPointerMove: (axis: SplitAxis, index: number, event: ReactPointerEvent<HTMLDivElement>) => void; onPointerEnd: (event: ReactPointerEvent<HTMLDivElement>) => void }) {
    return (
        <div className="pointer-events-none absolute inset-0">
            {verticalLines.map((line, index) => (
                <div key={`column-${index}`} className="pointer-events-auto absolute inset-y-0 -ml-2 w-4 touch-none cursor-ew-resize select-none" style={{ left: `${line * 100}%` }} onPointerDown={(event) => onPointerDown("vertical", index, event)} onPointerMove={(event) => onPointerMove("vertical", index, event)} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onLostPointerCapture={onPointerEnd}>
                    <div className={`absolute left-1/2 top-0 h-full border-l shadow-[0_0_0_1px_rgba(0,0,0,.35)] ${active?.axis === "vertical" && active.index === index ? "border-amber-300" : "border-white/90"}`} />
                </div>
            ))}
            {horizontalLines.map((line, index) => (
                <div key={`row-${index}`} className="pointer-events-auto absolute inset-x-0 -mt-2 h-4 touch-none cursor-ns-resize select-none" style={{ top: `${line * 100}%` }} onPointerDown={(event) => onPointerDown("horizontal", index, event)} onPointerMove={(event) => onPointerMove("horizontal", index, event)} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onLostPointerCapture={onPointerEnd}>
                    <div className={`absolute left-0 top-1/2 w-full border-t shadow-[0_0_0_1px_rgba(0,0,0,.35)] ${active?.axis === "horizontal" && active.index === index ? "border-amber-300" : "border-white/90"}`} />
                </div>
            ))}
        </div>
    );
}

function buildGridLines(count: number) {
    return Array.from({ length: Math.max(1, count) - 1 }, (_, index) => (index + 1) / count);
}

function findLineSpot(lines: number[]) {
    const cuts = [0, ...lines, 1].sort((a, b) => a - b);
    let spot = 0.5;
    let max = 0;
    for (let index = 0; index < cuts.length - 1; index += 1) {
        const gap = cuts[index + 1] - cuts[index];
        if (gap > max) {
            max = gap;
            spot = cuts[index] + gap / 2;
        }
    }
    return spot;
}

function clampLine(value: number, min: number, max: number) {
    return Math.min(max - 0.01, Math.max(min + 0.01, value));
}

function clampGrid(value: string | number) {
    const numberValue = Number(value);
    return Math.min(maxGridSize, Math.max(1, Math.round(Number.isFinite(numberValue) ? numberValue : 1)));
}

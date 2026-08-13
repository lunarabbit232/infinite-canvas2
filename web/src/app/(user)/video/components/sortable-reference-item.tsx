"use client";

// 可拖拽参考图组件 — 用于视频创作台替换 prev/next 翻页按钮
// 基于 @dnd-kit/core + @dnd-kit/sortable

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import Image from "next/image";
import type { ReferenceImage } from "@/types/image";

type SortableReferenceImageItemProps = {
    item: ReferenceImage;
    index: number;
    total: number;
    compact: boolean;
    onRemove: (id: string) => void;
    labelFn?: (index: number) => string;
};

export function SortableReferenceImageItem({
    item,
    index,
    total,
    compact,
    onRemove,
    labelFn,
}: SortableReferenceImageItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : undefined,
        position: "relative" as const,
    };

    const label = labelFn ? labelFn(index) : `参考 ${index + 1}`;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative ${compact ? "size-12" : "size-20"} group shrink-0 overflow-hidden rounded-md border border-stone-200 dark:border-stone-800`}
        >
            <Image src={item.dataUrl} alt={item.name} fill unoptimized className="object-cover" />
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {label}
            </span>

            {/* 拖拽手柄 */}
            <span
                {...attributes}
                {...listeners}
                className="absolute inset-x-0 bottom-0 flex h-6 cursor-grab items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
                title="拖拽排序"
            >
                <GripVertical className="size-3.5 text-white" />
            </span>

            {/* 删除按钮 */}
            <button
                type="button"
                className="absolute right-1 top-1 hidden size-6 items-center justify-center rounded bg-black/60 text-white group-hover:flex"
                onClick={() => onRemove(item.id)}
                aria-label="移除参考图"
            >
                <Trash2 className="size-3.5" />
            </button>
        </div>
    );
}

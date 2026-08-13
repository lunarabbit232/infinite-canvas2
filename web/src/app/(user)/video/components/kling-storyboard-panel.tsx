"use client";

import { ArrowLeft, ArrowRight, Clock, GripHorizontal, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button, Input } from "antd";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { VideoMultiPromptItem } from "@/stores/use-config-store";

type Props = {
    items: VideoMultiPromptItem[];
    selectedIndex: number;
    onSelectIndex: (index: number) => void;
    onChange: (items: VideoMultiPromptItem[]) => void;
    onAdd: () => void;
    onRemove: (index: number) => void;
};

export function KlingStoryboardPanel({ items, selectedIndex, onSelectIndex, onChange, onAdd, onRemove }: Props) {
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const handleDragEnd = (event: import("@dnd-kit/core").DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex((_, i) => String(i) === active.id);
        const newIndex = items.findIndex((_, i) => String(i) === over.id);
        if (oldIndex === -1 || newIndex === -1) return;
        const next = [...items];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        onChange(next);
        onSelectIndex(Math.min(newIndex, next.length - 1));
    };

    const selected = items[selectedIndex] || items[0];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">分镜编辑器</span>
                <Button size="small" icon={<Plus className="size-3.5" />} onClick={onAdd}>
                    新增分镜
                </Button>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((_, i) => String(i))} strategy={horizontalListSortingStrategy}>
                    <div className="hover-scrollbar flex w-full gap-2 overflow-x-auto rounded-lg border border-stone-200 p-2 dark:border-stone-800">
                        {items.map((item, index) => (
                            <ShotCard
                                key={index}
                                id={String(index)}
                                index={index}
                                item={item}
                                isSelected={selectedIndex === index}
                                total={items.length}
                                onSelect={() => onSelectIndex(index)}
                                onRemove={() => onRemove(index)}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {selected ? (
                <div className="space-y-3 rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <MessageSquare className="size-4" />
                            分镜 {selectedIndex + 1}
                        </div>
                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} disabled={items.length <= 1} onClick={() => onRemove(selectedIndex)}>
                            删除
                        </Button>
                    </div>
                    <div className="grid gap-3">
                        <label className="grid gap-1 text-xs text-stone-500 dark:text-stone-400">
                            时长（秒）
                            <input
                                type="number"
                                min={1}
                                max={15}
                                className="h-9 rounded-lg border border-stone-200 bg-background px-3 text-sm text-stone-900 outline-none dark:border-stone-800 dark:text-stone-100"
                                value={selected.duration || "1"}
                                onChange={(e) => {
                                    const next = [...items];
                                    next[selectedIndex] = { ...selected, duration: e.target.value };
                                    onChange(next);
                                }}
                            />
                        </label>
                        <label className="grid gap-1 text-xs text-stone-500 dark:text-stone-400">
                            提示词
                            <Input.TextArea
                                value={selected.prompt}
                                rows={3}
                                placeholder={`描述第${selectedIndex + 1}段的镜头运动、主体动作和场景氛围`}
                                onChange={(e) => {
                                    const next = [...items];
                                    next[selectedIndex] = { ...selected, prompt: e.target.value };
                                    onChange(next);
                                }}
                            />
                        </label>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function ShotCard({ id, index, item, isSelected, total, onSelect, onRemove }: {
    id: string;
    index: number;
    item: VideoMultiPromptItem;
    isSelected: boolean;
    total: number;
    onSelect: () => void;
    onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={{ ...style, width: 160 }}
            className={`group relative shrink-0 cursor-pointer rounded-xl border p-3 transition ${isSelected ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-950" : "border-stone-200 bg-white hover:border-stone-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700"}`}
            onClick={onSelect}
        >
            <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-semibold ${isSelected ? "text-sky-600 dark:text-sky-400" : "text-stone-500"}`}>
                    帧{index + 1}
                </span>
                <div className="flex items-center gap-1">
                    <span className="flex items-center gap-0.5 text-[10px] text-stone-400">
                        <Clock className="size-3" />
                        {item.duration || "1"}s
                    </span>
                    <button
                        type="button"
                        disabled={total <= 1}
                        className="grid size-5 place-items-center rounded text-stone-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100 disabled:hidden"
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    >
                        <Trash2 className="size-3" />
                    </button>
                </div>
            </div>
            {item.prompt ? (
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-stone-600 dark:text-stone-400">
                    {item.prompt}
                </p>
            ) : (
                <p className="mt-1 text-[11px] italic text-stone-400">未填写提示词</p>
            )}
            <div className="absolute bottom-1 right-2 flex items-center gap-1 text-[10px] text-stone-300">
                <button {...attributes} {...listeners} className="grid size-5 place-items-center rounded hover:text-stone-500" onClick={(e) => e.stopPropagation()}>
                    <GripHorizontal className="size-3" />
                </button>
            </div>
        </div>
    );
}

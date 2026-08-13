"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Empty, Image, Modal, Spin, Tag } from "antd";
import { Check, UserRound } from "lucide-react";
import { fetchCharacters } from "@/services/api/character";
import type { Character } from "@/types/character";

type Props = {
    open: boolean;
    onClose: () => void;
    onSelect: (character: Character) => void;
    selectedIds?: string[];
};

export function CharacterPickerModal({ open, onClose, onSelect, selectedIds = [] }: Props) {
    const query = useQuery({ queryKey: ["characters"], queryFn: fetchCharacters, retry: false, enabled: open });
    const items = query.data || [];

    return (
        <Modal title="选择角色" open={open} onCancel={onClose} footer={null} width={640} destroyOnHidden>
            {query.isLoading ? <div className="flex justify-center py-12"><Spin /></div> : !items.length ? <Empty description="还没有角色，请先去人物库创建" /> : (
                <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto p-1">
                    {items.map((char) => {
                        const isSelected = selectedIds.includes(char.id);
                        return (
                        <Card key={char.id} hoverable size="small" onClick={() => !isSelected && onSelect(char)} className={isSelected ? "opacity-60" : ""}>
                            <div className="flex gap-3">
                                {char.coverUrl ? <Image src={char.coverUrl} alt={char.name} width={64} height={64} className="shrink-0 rounded-lg object-cover" preview={false} /> : <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800"><UserRound className="size-8 text-stone-300" /></div>}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1 font-medium">{isSelected && <Check className="size-3.5 text-green-500" />}{char.name}</div>
                                    {char.personalityKeywords?.length > 0 && <div className="mt-1 flex flex-wrap gap-0.5">{char.personalityKeywords.map((kw) => <Tag key={kw} color="blue" className="text-[10px]">{kw}</Tag>)}</div>}
                                    {char.description && <div className="mt-1 text-xs text-stone-500 line-clamp-2">{char.description}</div>}
                                </div>
                            </div>
                        </Card>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}

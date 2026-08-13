"use client";

import { Save, FolderOpen } from "lucide-react";
import { App, Button, Empty, List, Modal, Typography } from "antd";
import { useEffect, useState } from "react";

type Template = { id: string; title: string; description: string; tags: string[]; updatedAt: string };

export function CanvasTemplateModal({ open, onClose, onLoad }: { open: boolean; onClose: () => void; onLoad: (id: string, data: string) => void }) {
    const { message } = App.useApp();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        fetch("/api/canvas/templates")
            .then(r => r.json())
            .then(d => setTemplates(d.data?.items || []))
            .catch(() => message.error("加载模板失败"))
            .finally(() => setLoading(false));
    }, [open, message]);

    const handleLoad = async (id: string) => {
        try {
            const r = await fetch("/api/canvas/templates/instantiate", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
            });
            const d = await r.json();
            if (d.code === 0) onLoad(id, d.data.templateData);
            else message.error(d.msg || "加载失败");
        } catch { message.error("加载失败"); }
    };

    return (
        <Modal title="画布模板" open={open} onCancel={onClose} footer={null} width={500}>
            {loading ? <Typography.Text type="secondary">加载中…</Typography.Text> : null}
            {templates.length === 0 && !loading ? <Empty description="暂无模板。在画布中点击「保存为模板」创建。" /> : null}
            <List
                dataSource={templates}
                renderItem={t => (
                    <List.Item actions={[<Button key="load" size="small" icon={<FolderOpen className="size-3.5" />} onClick={() => handleLoad(t.id)}>加载</Button>]}>
                        <List.Item.Meta title={t.title} description={t.description || t.updatedAt} />
                    </List.Item>
                )}
            />
        </Modal>
    );
}

export async function saveCanvasAsTemplate(title: string, nodes: any[], edges: any[]) {
    const data = JSON.stringify({ nodes, edges });
    const r = await fetch("/api/canvas/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, templateData: data, category: "system" }),
    });
    return r.json();
}

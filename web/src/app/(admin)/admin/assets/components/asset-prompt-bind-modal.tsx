"use client";

import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { App, Button, Empty, List, Modal, Select, Space, Tag, Typography } from "antd";
import { useEffect, useState } from "react";

import { fetchAdminPrompts, type AdminPromptQuery } from "@/services/api/admin";
import { bindPromptToAsset, fetchAssetPrompts, unbindPromptFromAsset, type AssetPromptBind } from "@/services/api/assets";
import { useUserStore } from "@/stores/use-user-store";

type Props = {
    assetId: string;
    assetTitle: string;
    open: boolean;
    onClose: () => void;
};

export function AssetPromptBindModal({ assetId, assetTitle, open, onClose }: Props) {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const [binds, setBinds] = useState<AssetPromptBind[]>([]);
    const [loading, setLoading] = useState(false);
    const [promptOptions, setPromptOptions] = useState<{ label: string; value: string }[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

    const loadBinds = async () => {
        if (!assetId) return;
        setLoading(true);
        try {
            const data = await fetchAssetPrompts(assetId);
            setBinds(data || []);
        } catch { message.error("加载关联提示词失败"); }
        finally { setLoading(false); }
    };

    const loadPrompts = async () => {
        try {
            const data = await fetchAdminPrompts(token || "", { pageSize: 200 });
            setPromptOptions((data.items || []).map((p) => ({ label: p.title, value: p.id })));
        } catch { /* ignore */ }
    };

    useEffect(() => { if (open) { loadBinds(); loadPrompts(); } }, [open, assetId]);

    const handleBind = async () => {
        if (!selectedPrompt) return;
        try {
            await bindPromptToAsset(assetId, selectedPrompt);
            message.success("已绑定");
            setSelectedPrompt(null);
            loadBinds();
        } catch { message.error("绑定失败"); }
    };

    const handleUnbind = async (id: string) => {
        try {
            await unbindPromptFromAsset(id);
            message.success("已解除");
            loadBinds();
        } catch { message.error("解除失败"); }
    };

    return (
        <Modal title={`关联提示词 · ${assetTitle}`} open={open} onCancel={onClose} footer={null} width={560}>
            <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
                <Select
                    showSearch
                    placeholder="搜索提示词…"
                    style={{ flex: 1 }}
                    options={promptOptions}
                    value={selectedPrompt}
                    onChange={setSelectedPrompt}
                    filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleBind} disabled={!selectedPrompt}>绑定</Button>
            </Space.Compact>

            {loading ? <Typography.Text type="secondary">加载中…</Typography.Text> : null}

            {binds.length === 0 && !loading ? <Empty description="暂无关联提示词" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}

            <List
                dataSource={binds}
                renderItem={(item) => (
                    <List.Item
                        actions={[<Button key="del" type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleUnbind(item.id)} />]}
                    >
                        <List.Item.Meta
                            title={<Space>{item.promptTitle}<Tag>{item.type === "negative" ? "反向" : "正向"}</Tag></Space>}
                            description={<Typography.Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 0 }}>{item.promptText}</Typography.Paragraph>}
                        />
                    </List.Item>
                )}
            />
        </Modal>
    );
}

"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography } from "antd";
import { useEffect, useState } from "react";
import { deleteKnowledgeEntry, fetchKnowledgeEntries, saveKnowledgeEntry, type KnowledgeEntry } from "@/services/api/knowledge";
import { useUserStore } from "@/stores/use-user-store";

const CATEGORY_LABELS: Record<string, string> = {
    storyboard: "编剧 Agent",
    director: "导演 Agent",
    execution: "执行词 Agent",
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export default function KnowledgePage() {
    const { message } = App.useApp();
    const token = useUserStore((state) => state.token);
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<KnowledgeEntry[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();
    const [filterCategory, setFilterCategory] = useState<string>("");

    const load = async (category?: string) => {
        if (!token) return;
        setLoading(true);
        try {
            setItems(await fetchKnowledgeEntries(token, category));
        } catch (err) {
            message.error(err instanceof Error ? err.message : "加载失败");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load(filterCategory);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, filterCategory]);

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        setModalOpen(true);
    };

    const openEdit = (item: KnowledgeEntry) => {
        setEditing(item);
        form.setFieldsValue({ category: item.category, title: item.title, content: item.content });
        setModalOpen(true);
    };

    const handleSave = async () => {
        const values = await form.validateFields().catch(() => null);
        if (!values) return;
        if (!token) return;
        setSaving(true);
        try {
            await saveKnowledgeEntry(token, { id: editing?.id, ...values });
            message.success(editing ? "已更新" : "已创建");
            setModalOpen(false);
            void load(filterCategory);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!token) return;
        try {
            await deleteKnowledgeEntry(token, id);
            message.success("已删除");
            void load(filterCategory);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "删除失败");
        }
    };

    return (
        <div style={{ padding: 24 }}>
            <Alert
                type="info"
                showIcon
                message="知识库如何工作"
                description="每条知识按分类（编剧/导演/执行词）注入到对应 Agent 的 system prompt 末尾。Agent 收到请求时会自动检索该分类下的所有知识条目作为参考。你可以在这里添加领域知识、风格指南、方法论等内容，Agent 输出会自动体现。"
                style={{ marginBottom: 16 }}
            />
            <Space style={{ justifyContent: "space-between", width: "100%", marginBottom: 16 }}>
                <Space>
                    <Select
                        allowClear
                        placeholder="筛选 Agent 类型"
                        style={{ width: 160 }}
                        value={filterCategory || undefined}
                        options={CATEGORY_OPTIONS}
                        onChange={(v) => setFilterCategory(v || "")}
                    />
                </Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新增知识</Button>
            </Space>

            <Table<KnowledgeEntry>
                rowKey="id"
                loading={loading}
                dataSource={items}
                locale={{ emptyText: <Empty description="暂无知识条目" /> }}
                columns={[
                    { title: "标题", dataIndex: "title", width: 200, render: (v: string, r) => <Typography.Link onClick={() => openEdit(r)}>{v}</Typography.Link> },
                    { title: "Agent", dataIndex: "category", width: 130, render: (v: string) => CATEGORY_LABELS[v] || v },
                    {
                        title: "内容",
                        dataIndex: "content",
                        ellipsis: true,
                        render: (v: string) => <Typography.Text style={{ maxWidth: 400 }} ellipsis>{v.slice(0, 120)}</Typography.Text>,
                    },
                    {
                        title: "操作",
                        width: 120,
                        render: (_, r) => (
                            <Space>
                                <Button type="link" size="small" onClick={() => openEdit(r)}>编辑</Button>
                                <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消">
                                    <Button type="link" size="small" danger>删除</Button>
                                </Popconfirm>
                            </Space>
                        ),
                    },
                ]}
            />

            <Modal title={editing ? "编辑知识" : "新增知识"} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={saving} width={680} destroyOnHidden>
                <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item name="category" label="所属 Agent" rules={[{ required: true, message: "请选择 Agent" }]}>
                        <Select options={CATEGORY_OPTIONS} placeholder="选择注入到哪个 Agent" />
                    </Form.Item>
                    <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
                        <Input placeholder="例如：王家卫电影风格、好莱坞三幕剧结构" />
                    </Form.Item>
                    <Form.Item name="content" label="知识内容" rules={[{ required: true, message: "请输入内容" }]} extra="编写你想让 Agent 掌握的领域知识、风格指南或创作方法论。Agent 在回答时会参考这些内容。">
                        <Input.TextArea rows={8} placeholder="例如：王家卫电影的核心视觉特征包括……" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

"use client";

import { Box, Info, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Empty, Form, Image, Input, Modal, Popconfirm, Select, Tooltip, Typography, Upload } from "antd";
import type { UploadFile } from "antd";
import { deleteProp, fetchProps, saveProp } from "@/services/api/prop";
import { uploadImage } from "@/services/image-storage";
import { useUserStore } from "@/stores/use-user-store";
import type { Prop } from "@/types/prop";

const CATEGORY_OPTIONS = [
    { value: "weapon", label: "武器" },
    { value: "accessory", label: "配饰" },
    { value: "vehicle", label: "载具" },
    { value: "furniture", label: "家具" },
    { value: "tool", label: "工具" },
    { value: "food", label: "食物" },
    { value: "building", label: "建筑" },
    { value: "nature", label: "自然物" },
    { value: "other", label: "其他" },
];

export default function PropsPage() {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const token = useUserStore((state) => state.token);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Prop | null>(null);
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const [coverFile, setCoverFile] = useState<UploadFile[]>([]);
    const [refFiles, setRefFiles] = useState<UploadFile[]>([]);

    const query = useQuery({
        queryKey: ["props"],
        queryFn: fetchProps,
        retry: false,
    });

    const items = query.data || [];

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        setCoverFile([]);
        setRefFiles([]);
        setModalOpen(true);
    };

    const openEdit = (item: Prop) => {
        setEditing(item);
        form.setFieldsValue({
            name: item.name,
            description: item.description,
            category: item.category,
            promptTemplate: item.promptTemplate || "",
        });
        setCoverFile(item.coverUrl ? [{ uid: "-1", name: "cover", status: "done", url: item.coverUrl }] : []);
        setRefFiles((item.referenceUrls || []).map((url, i) => ({ uid: `-ref-${i}`, name: `ref-${i}`, status: "done" as const, url })));
        setModalOpen(true);
    };

    const handleSave = async () => {
        const values = await form.validateFields().catch(() => null);
        if (!values) return;
        setSaving(true);
        try {
            let coverUrl = editing?.coverUrl || "";
            const newCoverFile = coverFile[0]?.originFileObj as File | undefined;
            if (newCoverFile) {
                const uploaded = await uploadImage(newCoverFile);
                coverUrl = uploaded.url;
            } else if (coverFile.length && !newCoverFile) {
                coverUrl = coverFile[0].url || coverUrl;
            }

            const existingUrls = (editing?.referenceUrls || []).filter((url) => refFiles.some((f) => f.url === url && !f.originFileObj));
            const newRefFiles = refFiles.filter((f) => f.originFileObj instanceof File).map((f) => f.originFileObj as File);
            const uploadedRefUrls = newRefFiles.length
                ? await Promise.all(newRefFiles.map((file) => uploadImage(file).then((res) => res.url)))
                : [];
            const referenceUrls = [...existingUrls, ...uploadedRefUrls];

            const data: Partial<Prop> = {
                id: editing?.id,
                name: values.name,
                description: values.description || "",
                category: values.category || "",
                promptTemplate: values.promptTemplate || "",
                coverUrl,
                referenceUrls,
            };
            await saveProp(data);
            message.success(editing ? "已更新" : "已创建");
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["props"] });
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteProp(id);
            message.success("已删除");
            queryClient.invalidateQueries({ queryKey: ["props"] });
        } catch (err) {
            message.error(err instanceof Error ? err.message : "删除失败");
        }
    };

    if (!token) return <Empty className="mt-32" description="请先登录" />;

    return (
        <div className="mx-auto max-w-6xl px-4 py-6">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Typography.Title level={4} className="!mb-0">道具库</Typography.Title>
                    <Tooltip title="管理场景中的道具/物件。上传参考图和提示词模板后，可在画布中作为参考素材注入到视频生成。">
                        <Info className="size-4 cursor-help text-stone-400" />
                    </Tooltip>
                </div>
                <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreate}>新建道具</Button>
            </div>

            {!items.length ? (
                <Empty className="mt-16" description="还没有道具，点击「新建道具」创建第一个" />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                        <Card
                            key={item.id}
                            hoverable
                            onClick={() => openEdit(item)}
                            cover={item.coverUrl ? <Image src={item.coverUrl} alt={item.name} className="aspect-[4/3] object-cover" preview={false} /> : <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 dark:bg-stone-800"><Box className="size-12 text-stone-300" /></div>}
                            actions={[<Popconfirm key="del" title="确定删除此道具？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(item.id); }} onCancel={(e) => e?.stopPropagation()} okText="删除" cancelText="取消"><Button key="delete" type="text" danger size="small" icon={<Trash2 className="size-3.5" />} onClick={(e) => e.stopPropagation()} /></Popconfirm>]}
                        >
                            <Card.Meta
                                title={item.name}
                                description={
                                    <div className="space-y-1">
                                        {item.category && <span className="text-xs text-stone-400">{CATEGORY_OPTIONS.find((c) => c.value === item.category)?.label || item.category}</span>}
                                        {item.description && <Typography.Paragraph className="!mb-0 text-xs" ellipsis={{ rows: 2 }}>{item.description}</Typography.Paragraph>}
                                        {item.referenceUrls?.length > 0 && <span className="text-xs text-stone-400">{item.referenceUrls.length} 张参考图</span>}
                                    </div>
                                }
                            />
                        </Card>
                    ))}
                </div>
            )}

            <Modal title={editing ? "编辑道具" : "新建道具"} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={saving} width={640} destroyOnHidden>
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item name="name" label="道具名称" rules={[{ required: true, message: "请输入道具名称" }]}>
                        <Input placeholder="例如：轩辕剑、魔法书" />
                    </Form.Item>
                    <Form.Item name="category" label="分类">
                        <Select options={CATEGORY_OPTIONS} placeholder="选择道具分类" allowClear />
                    </Form.Item>
                    <Form.Item name="description" label="道具描述">
                        <Input.TextArea rows={2} placeholder="外观、材质、用途等描述" />
                    </Form.Item>
                    <Form.Item name="promptTemplate" label="提示词模板" extra="道具文本描述，生成时自动拼入 prompt">
                        <Input.TextArea rows={3} placeholder="例如：一把银色的长剑，剑身上刻有古老的符文，剑柄镶嵌蓝宝石" />
                    </Form.Item>
                    <Form.Item label="封面图">
                        <Upload listType="picture-card" maxCount={1} fileList={coverFile} onChange={({ fileList }) => setCoverFile(fileList)} beforeUpload={() => false}>上传</Upload>
                    </Form.Item>
                    <Form.Item label="参考图集" extra="多角度参考图，用于锁定道具外观">
                        <Upload listType="picture-card" multiple maxCount={9} fileList={refFiles} onChange={({ fileList }) => setRefFiles(fileList)} beforeUpload={() => false}>上传</Upload>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

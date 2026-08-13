"use client";

import { Info, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, ColorPicker, Empty, Form, Image, Input, Modal, Popconfirm, Progress, Select, Space, Tag, Tooltip, Typography, Upload } from "antd";
import type { UploadFile } from "antd";
import { checkCharacterConsistency, deleteCharacter, fetchCharacters, saveCharacter } from "@/services/api/character";
import { uploadImage } from "@/services/image-storage";
import { uploadMediaFile } from "@/services/file-storage";
import { useUserStore } from "@/stores/use-user-store";
import type { Character } from "@/types/character";

export default function CharactersPage() {
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const token = useUserStore((state) => state.token);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Character | null>(null);
    const [form] = Form.useForm();
    const [primaryColor, setPrimaryColor] = useState<string>("#2563eb");
    const [accentColor, setAccentColor] = useState<string>("#f97316");
    const [accent2Color, setAccent2Color] = useState<string>("#22c55e");
    const [saving, setSaving] = useState(false);
    const [coverFile, setCoverFile] = useState<UploadFile[]>([]);
    const [refFiles, setRefFiles] = useState<UploadFile[]>([]);
    const [voiceFile, setVoiceFile] = useState<UploadFile[]>([]);
    const [sceneFiles, setSceneFiles] = useState<UploadFile[]>([]);

    const query = useQuery({
        queryKey: ["characters"],
        queryFn: fetchCharacters,
        retry: false,
    });

    useEffect(() => {
        if (query.isError) message.error(query.error instanceof Error ? query.error.message : "获取角色列表失败");
    }, [message, query.error, query.isError]);

    const items = query.data || [];

    const openCreate = () => {
        setEditing(null);
        form.resetFields();
        setCoverFile([]);
        setRefFiles([]);
        setVoiceFile([]);
        setSceneFiles([]);
        setModalOpen(true);
    };

    const openEdit = (item: Character) => {
        setEditing(item);
        form.setFieldsValue({
            name: item.name,
            description: item.description,
            personalityKeywords: item.personalityKeywords || [],
            promptTemplate: item.promptTemplate || "",
        });
        setPrimaryColor(item.colorScheme?.primary || "#2563eb");
        setAccentColor(item.colorScheme?.accent || "#f97316");
        setAccent2Color(item.colorScheme?.accent2 || "#22c55e");
        setCoverFile(item.coverUrl ? [{ uid: "-1", name: "cover", status: "done", url: item.coverUrl }] : []);
        setRefFiles((item.referenceUrls || []).map((url, i) => ({ uid: `-ref-${i}`, name: `ref-${i}`, status: "done" as const, url })));
        setVoiceFile(item.voiceUrl ? [{ uid: "-v", name: "voice", status: "done", url: item.voiceUrl }] : []);
        setSceneFiles((item.sceneUrls || []).map((url, i) => ({ uid: `-scene-${i}`, name: `scene-${i}`, status: "done" as const, url })));
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
                const hideCover = message.loading("正在上传封面...", 0);
                try {
                    const uploaded = await uploadImage(newCoverFile);
                    coverUrl = uploaded.url;
                } finally {
                    hideCover();
                }
            } else if (coverFile.length && !newCoverFile) {
                coverUrl = coverFile[0].url || coverUrl;
            }

            const existingUrls = (editing?.referenceUrls || []).filter((url) => refFiles.some((f) => f.url === url && !f.originFileObj));
            const newRefFiles = refFiles.filter((f) => f.originFileObj instanceof File).map((f) => f.originFileObj as File);
            let uploadedRefUrls: string[] = [];
            if (newRefFiles.length) {
                let uploadedCount = 0;
                const updateProgress = () => message.open({ key: "char-upload", type: "loading", content: `正在上传参考图 ${uploadedCount}/${newRefFiles.length}`, duration: 0 });
                updateProgress();
                uploadedRefUrls = await Promise.all(
                    newRefFiles.map((file) =>
                        uploadImage(file).then((res) => {
                            uploadedCount++;
                            updateProgress();
                            return res.url;
                        }),
                    ),
                );
                message.success(`已上传 ${uploadedCount} 张参考图`);
            }
            const referenceUrls = [...existingUrls, ...uploadedRefUrls];

            let voiceUrl = editing?.voiceUrl || "";
            const newVoiceFile = voiceFile[0]?.originFileObj as File | undefined;
            if (newVoiceFile) {
                const uploaded = newVoiceFile.type.startsWith("audio/")
                    ? await uploadMediaFile(newVoiceFile, "character-voice")
                    : await uploadImage(newVoiceFile);
                voiceUrl = uploaded.url;
            }

            const existingScenes = (editing?.sceneUrls || []).filter((url) => sceneFiles.some((f) => f.url === url && !f.originFileObj));
            const newSceneFiles = sceneFiles.filter((f) => f.originFileObj instanceof File).map((f) => f.originFileObj as File);
            const uploadedSceneUrls = newSceneFiles.length
                ? await Promise.all(newSceneFiles.map((file) => uploadImage(file).then((res) => res.url)))
                : [];
            const sceneUrls = [...existingScenes, ...uploadedSceneUrls];

            const data: Partial<Character> = {
                id: editing?.id,
                name: values.name,
                description: values.description || "",
                personalityKeywords: values.personalityKeywords || [],
                colorScheme: { primary: primaryColor, accent: accentColor, accent2: accent2Color },
                promptTemplate: values.promptTemplate || "",
                coverUrl,
                referenceUrls,
                voiceUrl,
                sceneUrls,
            };
            await saveCharacter(data);
            message.success(editing ? "已更新" : "已创建");
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["characters"] });
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteCharacter(id);
            message.success("已删除");
            queryClient.invalidateQueries({ queryKey: ["characters"] });
        } catch (err) {
            message.error(err instanceof Error ? err.message : "删除失败");
        }
    };

    const [consistencyOpen, setConsistencyOpen] = useState(false);
    const [consistencyCharacter, setConsistencyCharacter] = useState<Character | null>(null);
    const [consistencyUrl, setConsistencyUrl] = useState("");
    const [consistencyChecking, setConsistencyChecking] = useState(false);
    const [consistencyScore, setConsistencyScore] = useState<number | null>(null);

    const openConsistency = (item: Character) => {
        setConsistencyCharacter(item);
        setConsistencyUrl("");
        setConsistencyScore(null);
        setConsistencyOpen(true);
    };

    const runConsistency = async () => {
        if (!consistencyCharacter || !consistencyUrl.trim()) return;
        setConsistencyChecking(true);
        setConsistencyScore(null);
        try {
            const result = await checkCharacterConsistency(consistencyCharacter.id, consistencyUrl.trim());
            setConsistencyScore(result.score);
        } catch (err) {
            message.error(err instanceof Error ? err.message : "校验失败");
        } finally {
            setConsistencyChecking(false);
        }
    };

    if (!token) return <Empty className="mt-32" description="请先登录" />;

    return (
        <div className="mx-auto max-w-6xl px-4 py-6">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Typography.Title level={4} className="!mb-0">人物库</Typography.Title>
                    <Tooltip title="管理角色的多角度参考图、外貌描述和提示词模板。角色可以在画布中作为参考素材注入到生图和视频生成，锁定人物形象一致性。">
                        <Info className="size-4 cursor-help text-stone-400" />
                    </Tooltip>
                </div>
                <Button type="primary" icon={<Plus className="size-4" />} onClick={openCreate}>新建角色</Button>
            </div>

            {!items.length ? (
                <Empty className="mt-16" description="还没有角色，点击「新建角色」创建第一个" />
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                        <Card
                            key={item.id}
                            hoverable
                            onClick={() => openEdit(item)}
                            cover={item.coverUrl ? <Image src={item.coverUrl} alt={item.name} className="aspect-[4/3] object-cover" preview={false} /> : <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 dark:bg-stone-800"><UserRound className="size-12 text-stone-300" /></div>}
                            actions={[
                                <Tooltip key="check" title="校验一致性"><Button key="check" type="text" size="small" icon={<ShieldCheck className="size-3.5" />} onClick={(e) => { e.stopPropagation(); openConsistency(item); }} /></Tooltip>,
                                <Popconfirm key="del" title="确定删除此角色？" onConfirm={(e) => { e?.stopPropagation(); handleDelete(item.id); }} onCancel={(e) => e?.stopPropagation()} okText="删除" cancelText="取消"><Button key="delete" type="text" danger size="small" icon={<Trash2 className="size-3.5" />} onClick={(e) => e.stopPropagation()} /></Popconfirm>,
                            ]}
                        >
                            <Card.Meta
                                title={item.name}
                                description={
                                    <div className="space-y-1">
                                        {item.personalityKeywords?.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {item.personalityKeywords.map((kw) => <Tag key={kw} color="blue">{kw}</Tag>)}
                                            </div>
                                        )}
                                        {item.description && <Typography.Paragraph className="!mb-0 text-xs" ellipsis={{ rows: 2 }}>{item.description}</Typography.Paragraph>}
                                        {item.referenceUrls?.length > 0 && <span className="text-xs text-stone-400">{item.referenceUrls.length} 张参考图</span>}
                                    </div>
                                }
                            />
                        </Card>
                    ))}
                </div>
            )}

            <Modal title={editing ? "编辑角色" : "新建角色"} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={saving} width={640} destroyOnHidden>
                <Form form={form} layout="vertical" className="mt-4">
                    <Form.Item name="name" label="角色名称" rules={[{ required: true, message: "请输入角色名称" }]}>
                        <Input placeholder="例如：李白、赛博侦探" />
                    </Form.Item>
                    <Form.Item name="description" label="角色描述">
                        <Input.TextArea rows={2} placeholder="身份、年龄、职业等背景信息" />
                    </Form.Item>
                    <Form.Item name="personalityKeywords" label="性格关键词" extra="3-5 个辨识度词，锁定角色锚点">
                        <Select mode="tags" placeholder="输入后按回车添加，如：沉稳、果决、冷幽默" />
                    </Form.Item>
                    <Form.Item label="视觉配色">
                        <Space wrap>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-stone-500">主色</span>
                                <ColorPicker value={primaryColor} onChangeComplete={(color) => setPrimaryColor(color.toHexString())} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-stone-500">辅色</span>
                                <ColorPicker value={accentColor} onChangeComplete={(color) => setAccentColor(color.toHexString())} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-stone-500">点缀</span>
                                <ColorPicker value={accent2Color} onChangeComplete={(color) => setAccent2Color(color.toHexString())} />
                            </div>
                        </Space>
                    </Form.Item>
                    <Form.Item name="promptTemplate" label="提示词模板" extra="角色文本 DNA，生成时自动拼入 prompt">
                        <Input.TextArea rows={3} placeholder="例如：男性，30岁，短发，穿黑色风衣，身材高大，目光锐利" />
                    </Form.Item>
                    <Form.Item label="封面图">
                        <Upload listType="picture-card" maxCount={1} fileList={coverFile} onChange={({ fileList }) => setCoverFile(fileList)} beforeUpload={() => false}>上传</Upload>
                    </Form.Item>
                    <Form.Item label="参考图集" extra="正/侧/背面全身照、面部特写（垫图法锁定外貌）">
                        <Upload listType="picture-card" multiple maxCount={9} fileList={refFiles} onChange={({ fileList }) => setRefFiles(fileList)} beforeUpload={() => false}>上传</Upload>
                    </Form.Item>
                    <Form.Item label="场景图集" extra="正面/背面/360°全景（多角度场景参考）">
                        <Upload listType="picture-card" multiple maxCount={9} fileList={sceneFiles} onChange={({ fileList }) => setSceneFiles(fileList)} beforeUpload={() => false}>上传</Upload>
                    </Form.Item>
                    <Form.Item label="专属声线" extra="上传角色的专属配音文件，用于短剧对白">
                        <Upload listType="picture-card" maxCount={1} fileList={voiceFile} onChange={({ fileList }) => setVoiceFile(fileList)} beforeUpload={() => false} accept="audio/*">上传</Upload>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal title={`校验一致性${consistencyCharacter ? `：${consistencyCharacter.name}` : ""}`} open={consistencyOpen} onCancel={() => setConsistencyOpen(false)} footer={null} width={480} destroyOnHidden>
                <div className="mt-2 space-y-4">
                    <Typography.Text type="secondary">粘贴一张生成结果图的地址，与「{consistencyCharacter?.name || "该角色"}」的参考图比对相似度。</Typography.Text>
                    <Input placeholder="https://... 图片地址" value={consistencyUrl} onChange={(e) => setConsistencyUrl(e.target.value)} onPressEnter={runConsistency} />
                    <Button type="primary" block loading={consistencyChecking} disabled={!consistencyUrl.trim()} onClick={runConsistency}>开始校验</Button>
                    {consistencyScore !== null && (consistencyScore < 0 ? (
                        <Alert type="warning" showIcon message="无法比对" description="该角色未配参考图，或校验服务暂不可用。" />
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <Progress type="circle" percent={Math.round(consistencyScore * 100)} />
                            <Typography.Text type="secondary">与角色参考图的 CLIP 相似度</Typography.Text>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
}

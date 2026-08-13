"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { App, Button, Segmented, Tooltip } from "antd";
import { ChevronRight, Clapperboard, Download, FileUp, ImageIcon, Info, Plus, Video } from "lucide-react";

import { readZip } from "@/lib/zip";
import { setMediaBlob } from "@/services/file-storage";
import { setImageBlob } from "@/services/image-storage";
import { CanvasDeleteProjectsDialog } from "./components/canvas-delete-projects-dialog";
import { CanvasProjectCard } from "./components/canvas-project-card";
import type { CanvasExportFile } from "./export-types";
import { useCanvasStore } from "./stores/use-canvas-store";
import { useCanvasUiStore } from "./stores/use-canvas-ui-store";
import { exportCanvasProjects } from "./utils/canvas-export";

export default function CanvasPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const hydrated = useCanvasStore((state) => state.hydrated);
    const projects = useCanvasStore((state) => state.projects);
    const createProject = useCanvasStore((state) => state.createProject);
    const importProject = useCanvasStore((state) => state.importProject);
    const selectedIds = useCanvasUiStore((state) => state.selectedProjectIds);
    const setDeleteIds = useCanvasUiStore((state) => state.setDeleteProjectIds);
    const [tab, setTab] = useState<"draft" | "archived">("draft");

    const filteredProjects = projects.filter((p) => p.status === tab || !p.status);
    const enterProject = (id: string) => { router.push(`/canvas/${id}`); };
    const createAndEnter = () => enterProject(createProject(`无限画布 ${projects.length + 1}`));
    const createWorkflowProject = (kind: "image" | "video") => {
        const title = kind === "image" ? "文生图工作流" : "分镜生视频工作流";
        const id = createProject(title);
        sessionStorage.setItem("canvas-workflow-template", kind);
        router.push(`/canvas/${id}`);
    };
    const importCanvas = async (file?: File) => {
        if (!file) return;
        try {
            const zip = await readZip(file);
            const projectFile = zip.get("projects.json");
            if (!projectFile) throw new Error("missing projects.json");
            const data = JSON.parse(await projectFile.text()) as CanvasExportFile;
            await Promise.all(
                data.projects.flatMap((project) =>
                    project.files.map(async (item) => {
                        const blob = zip.get(item.path);
                        if (!blob) return;
                        const typedBlob = blob.type ? blob : blob.slice(0, blob.size, item.mimeType);
                        await (item.storageKey.startsWith("image:") ? setImageBlob(item.storageKey, typedBlob) : setMediaBlob(item.storageKey, typedBlob));
                    }),
                ),
            );
            data.projects.forEach((item) => importProject(item.project));
            message.success(`已导入 ${data.projects.length} 个画布`);
        } catch {
            message.error("导入失败，请选择有效的画布压缩包");
        } finally {
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    return (
        <main className="h-full overflow-auto bg-background text-stone-950 dark:text-stone-100">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
                <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6 dark:border-stone-800">
                    <div>
                        <p className="text-xs text-stone-500">画布库</p>
                        <h1 className="mt-3 text-3xl font-semibold">无限画布</h1>
                        <p className="mt-2 max-w-lg text-sm leading-relaxed text-stone-500">画布是你编排 AI 创作流程的自由空间。用节点和连线记录从提示词到成片的完整思路，每一步的中间产物、参数和依赖关系都保留在画布上。</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.length ? (
                            <>
                                <Button disabled={!hydrated} icon={<Download className="size-4" />} onClick={() => void exportCanvasProjects(projects.filter((project) => selectedIds.includes(project.id)), `无限画布-${selectedIds.length}个项目`)}>
                                    导出选中
                                </Button>
                                <Button disabled={!hydrated} onClick={() => setDeleteIds(selectedIds)}>
                                    删除选中
                                </Button>
                            </>
                        ) : null}
                        {projects.length ? (
                            <Button disabled={!hydrated} onClick={() => setDeleteIds(projects.map((project) => project.id))}>
                                删除全部
                            </Button>
                        ) : null}
                        <Button disabled={!hydrated} icon={<FileUp className="size-4" />} onClick={() => inputRef.current?.click()}>
                            导入画布
                        </Button>
                        <Button disabled={!hydrated} type="primary" icon={<Plus className="size-4" />} onClick={createAndEnter}>
                            新建画布
                        </Button>
                    </div>
                </header>

                <section className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/50">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-400">
                        <Clapperboard className="size-4" />
                        快速开始
                        <Tooltip title="选择一个模板，自动创建带有连线管线的画布项目。打开后可直接在画布节点中输入提示词开始生成。">
                            <Info className="size-3.5 cursor-help text-stone-400" />
                        </Tooltip>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            disabled={!hydrated}
                            className="flex flex-1 items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-stone-300 hover:shadow-sm disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
                            onClick={() => createWorkflowProject("image")}
                        >
                            <ImageIcon className="size-5 shrink-0 text-sky-500" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-stone-900 dark:text-stone-100">文生图工作流</div>
                                <div className="mt-0.5 text-xs text-stone-500">创建 文本 → 配置 → 图片 连线管线，写好提示词直接出图</div>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-stone-400" />
                        </button>
                        <button
                            type="button"
                            disabled={!hydrated}
                            className="flex flex-1 items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left transition hover:border-stone-300 hover:shadow-sm disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:border-stone-600"
                            onClick={() => createWorkflowProject("video")}
                        >
                            <Video className="size-5 shrink-0 text-emerald-500" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-stone-900 dark:text-stone-100">分镜生视频工作流</div>
                                <div className="mt-0.5 text-xs text-stone-500">创建 文本 → 配置 → 图片 → 视频 完整管线</div>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-stone-400" />
                        </button>
                    </div>
                </section>

                {!hydrated ? (
                    <section className="flex min-h-[360px] items-center justify-center border-y border-stone-200 text-sm text-stone-500 dark:border-stone-800">正在加载画布...</section>
                ) : (
                    <>
                        <Segmented
                            options={[
                                { value: "draft", label: `进行中${projects.filter((p) => p.status === "draft" || !p.status).length ? ` (${projects.filter((p) => p.status === "draft" || !p.status).length})` : ""}` },
                                { value: "archived", label: `已归档${projects.filter((p) => p.status === "archived").length ? ` (${projects.filter((p) => p.status === "archived").length})` : ""}` },
                            ]}
                            value={tab}
                            onChange={(v) => setTab(v as "draft" | "archived")}
                        />
                        {filteredProjects.length ? (
                            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredProjects.map((project) => (
                                    <CanvasProjectCard key={project.id} project={project} />
                                ))}
                            </div>
                        ) : (
                            <section className="flex min-h-[360px] flex-col items-center justify-center border-y border-stone-200 text-center dark:border-stone-800">
                                <h2 className="text-xl font-medium">{tab === "draft" ? "还没有画布" : "没有已归档的画布"}</h2>
                                <p className="mt-3 text-sm text-stone-500">新建一个画布后，每个画布独立保存节点、连线和画布外观。或使用上方流程模板一键创建含连线的预设画布。</p>
                                <Button type="primary" className="mt-6" icon={<Plus className="size-4" />} onClick={createAndEnter}>
                                    新建画布
                                </Button>
                            </section>
                        )}
                    </>
                )}
            </div>

            <input ref={inputRef} type="file" accept="application/zip,.zip" className="hidden" onChange={(event) => void importCanvas(event.target.files?.[0])} />
            <CanvasDeleteProjectsDialog />
        </main>
    );
}

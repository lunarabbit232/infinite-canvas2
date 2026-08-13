"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ImagePlus, Maximize2, Play, Sparkles, Video, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const STORAGE_KEY = "infinite-canvas:onboarding-done";

const steps = [
    {
        title: "欢迎来到无限画布",
        description: "AI 驱动的创作平台——生图、做视频、搭工作流，一切从画布开始。",
        icon: <Sparkles className="size-6 text-sky-500" />,
    },
    {
        title: "从画布开始创作",
        description: "侧栏点「我的画布」新建项目。在画布里可以自由创建图片、视频、文本节点，连线搭建工作流。",
        icon: <Maximize2 className="size-6 text-stone-500" />,
        highlight: "canvas-nav",
    },
    {
        title: "生图工作台",
        description: "上传参考图、填提示词、选模型参数，一键生成高质量图片。生成的图可以直接拖回画布继续创作。",
        icon: <ImagePlus className="size-6 text-indigo-500" />,
    },
    {
        title: "视频创作台",
        description: "支持 Kling 多镜头分镜，拖拽排序时间轴，逐段编辑 prompt 和时长，一键生成连贯视频。",
        icon: <Video className="size-6 text-emerald-500" />,
    },
    {
        title: "工作流模板",
        description: "不想每次重复设置？用「单图生成」「多图系列」「视频生成」「短剧创作」工作流模板，填变量就能批量出片。",
        icon: <BookOpen className="size-6 text-amber-500" />,
    },
    {
        title: "开始创作吧",
        description: "点击「开始」进入画布，或者点侧栏任意工具直接跳转。右上角「我的作品」可以查看所有生成结果。",
        icon: <Play className="size-6 text-green-500" />,
    },
];

export function OnboardingGuide() {
    const [visible, setVisible] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (localStorage.getItem(STORAGE_KEY)) return;
        const timer = setTimeout(() => setVisible(true), 800);
        return () => clearTimeout(timer);
    }, []);

    if (!visible) return null;

    const current = steps[step];
    const isLast = step === steps.length - 1;

    const finish = () => {
        setVisible(false);
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    };

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={finish}
            >
                <motion.div
                    className="relative mx-4 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button onClick={finish} className="absolute right-3 top-3 grid size-7 place-items-center rounded-full text-stone-400 transition hover:text-stone-600 dark:hover:text-stone-200">
                        <X className="size-4" />
                    </button>

                    <div className="mb-4 flex items-center gap-3">
                        {current.icon}
                        <h2 className="text-lg font-semibold text-stone-950 dark:text-stone-100">{current.title}</h2>
                    </div>
                    <p className="mb-6 text-sm leading-6 text-stone-500">{current.description}</p>

                    <div className="mb-4 flex justify-center gap-1.5">
                        {steps.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-sky-500" : "w-1.5 bg-stone-200 dark:bg-stone-700"}`} />
                        ))}
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setStep(Math.max(0, step - 1))}
                            disabled={step === 0}
                            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-stone-500 transition hover:text-stone-700 disabled:opacity-30 dark:hover:text-stone-300"
                        >
                            <ArrowLeft className="size-4" /> 上一步
                        </button>
                        <button
                            onClick={isLast ? finish : () => setStep(step + 1)}
                            className="flex items-center gap-1 rounded-lg bg-stone-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-stone-200"
                        >
                            {isLast ? (
                                <>开始 <Check className="size-4" /></>
                            ) : (
                                <>下一步 <ArrowRight className="size-4" /></>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Image } from "antd";
import NextImage from "next/image";
import { FileText, Image as ImageIcon, Music2, Video } from "lucide-react";
import { canvasThemes } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { CanvasResourceReference } from "../utils/canvas-resource-references";

type CanvasPromptChipInputProps = {
    value: string;
    references: CanvasResourceReference[];
    onChange: (value: string) => void;
    onSubmit?: () => void;
    className?: string;
    style?: CSSProperties;
    placeholder?: string;
};

type MentionState = {
    query: string;
    rect: DOMRect | null;
};

type PromptToken =
    | { type: "text"; value: string }
    | { type: "reference"; label: string };

export function CanvasPromptChipInput({ value, references, onChange, onSubmit, className, style, placeholder }: CanvasPromptChipInputProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const editorRef = useRef<HTMLDivElement>(null);
    const composingRef = useRef(false);
    const lastEmittedRef = useRef(value);
    const [mention, setMention] = useState<MentionState | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const activeReferences = useMemo(() => references.filter((reference) => reference.active), [references]);
    const referenceByLabel = useMemo(() => new Map(activeReferences.map((reference) => [reference.label, reference])), [activeReferences]);
    const activeLabels = useMemo(() => Array.from(new Set(activeReferences.map((reference) => reference.label))).sort((left, right) => right.length - left.length), [activeReferences]);
    const tokens = useMemo(() => parsePromptTokens(value, activeLabels), [activeLabels, value]);
    const candidates = useMemo(() => {
        if (!mention) return [];
        const query = mention.query.trim().toLowerCase();
        if (!query) return activeReferences;
        return activeReferences.filter((reference) => `${reference.label} ${reference.title} ${reference.kind} ${reference.text || ""}`.toLowerCase().includes(query));
    }, [activeReferences, mention]);

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;
        if (document.activeElement === editor && value === lastEmittedRef.current) return;
        editor.textContent = "";
        tokens.forEach((token) => {
            if (token.type === "text") {
                editor.append(document.createTextNode(token.value));
                return;
            }
            const reference = referenceByLabel.get(token.label);
            if (reference) editor.append(createReferenceChip(reference, theme, setImagePreview));
            else editor.append(document.createTextNode(token.label));
        });
        lastEmittedRef.current = value;
    }, [referenceByLabel, theme, tokens, value]);

    const emitChange = (nextValue: string) => {
        lastEmittedRef.current = nextValue;
        onChange(nextValue);
    };

    const closeMention = () => {
        setMention(null);
        setActiveIndex(0);
    };

    const syncMention = () => {
        const text = textBeforeCaret();
        const match = /@([^\s@]*)$/.exec(text);
        if (!match || !activeReferences.length) {
            closeMention();
            return;
        }
        setMention({
            query: match[1] || "",
            rect: getCaretRect(),
        });
        setActiveIndex(0);
    };

    const syncFromEditor = () => {
        const editor = editorRef.current;
        if (!editor) return;
        emitChange(serializePromptEditor(editor));
        syncMention();
    };

    const insertReference = (reference: CanvasResourceReference) => {
        const editor = editorRef.current;
        if (!editor) return;
        removeActiveMention();
        const leadingSpace = document.createTextNode(" ");
        const chip = createReferenceChip(reference, theme, setImagePreview);
        const trailingSpace = document.createTextNode(" ");
        const selection = window.getSelection();
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        if (range) {
            range.insertNode(trailingSpace);
            range.insertNode(chip);
            range.insertNode(leadingSpace);
            range.setStartAfter(trailingSpace);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
        } else {
            editor.append(leadingSpace, chip, trailingSpace);
            placeCaretAtEnd(editor);
        }
        closeMention();
        emitChange(serializePromptEditor(editor));
    };

    const showPlaceholder = !value.trim();

    return (
        <div className="relative w-full">
            {showPlaceholder && placeholder ? (
                <div className="pointer-events-none absolute left-3 top-2 text-sm leading-5" style={{ color: theme.node.placeholder }}>
                    {placeholder}
                </div>
            ) : null}

            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                aria-label={placeholder}
                className={`${className || ""} overflow-y-auto whitespace-pre-wrap break-words outline-none`}
                style={{ ...style, cursor: "text" }}
                onInput={() => {
                    if (!composingRef.current) syncFromEditor();
                }}
                onPaste={(event) => {
                    const text = event.clipboardData.getData("text/plain");
                    if (!text) return;

                    event.preventDefault();

                    const selection = window.getSelection();
                    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
                    if (!range) return;

                    range.deleteContents();

                    const textNode = document.createTextNode(text);
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.collapse(true);
                    selection?.removeAllRanges();
                    selection?.addRange(range);

                    syncFromEditor();
                }}
                onCompositionStart={() => {
                    composingRef.current = true;
                }}
                onCompositionEnd={() => {
                    composingRef.current = false;
                    syncFromEditor();
                }}
                onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                    event.stopPropagation();

                    const nativeEvent = event.nativeEvent;
                    const isComposing = composingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229;
                    if (isComposing) return;

                    if (mention && candidates.length) {
                        if (event.key === "ArrowDown") {
                            event.preventDefault();
                            setActiveIndex((index) => (index + 1) % candidates.length);
                            return;
                        }

                        if (event.key === "ArrowUp") {
                            event.preventDefault();
                            setActiveIndex((index) => (index - 1 + candidates.length) % candidates.length);
                            return;
                        }

                        if (event.key === "Enter") {
                            event.preventDefault();
                            insertReference(candidates[Math.min(activeIndex, candidates.length - 1)]);
                            return;
                        }

                        if (event.key === "Escape") {
                            event.preventDefault();
                            closeMention();
                            return;
                        }
                    }

                    if ((event.key === "Backspace" || event.key === "Delete") && deleteAdjacentReference(event.key)) {
                        event.preventDefault();
                        requestAnimationFrame(syncFromEditor);
                        return;
                    }

                    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey && onSubmit) {
                        event.preventDefault();
                        onSubmit();
                        return;
                    }

                    requestAnimationFrame(syncMention);
                }}
                onPointerUp={() => {
                    requestAnimationFrame(syncMention);
                }}
                onBlur={() => {
                    window.setTimeout(closeMention, 120);
                }}
            />

            {mention && candidates.length ? (
                <MentionMenu
                    rect={mention.rect}
                    references={candidates}
                    activeIndex={Math.min(activeIndex, candidates.length - 1)}
                    theme={theme}
                    onSelect={insertReference}
                />
            ) : null}

            {imagePreview ? (
                <Image
                    src={imagePreview}
                    alt="引用图片预览"
                    style={{ display: "none" }}
                    preview={{
                        visible: true,
                        src: imagePreview,
                        onVisibleChange: (visible) => {
                            if (!visible) setImagePreview(null);
                        },
                    }}
                />
            ) : null}
        </div>
    );
}

function MentionMenu({
    rect,
    references,
    activeIndex,
    theme,
    onSelect,
}: {
    rect: DOMRect | null;
    references: CanvasResourceReference[];
    activeIndex: number;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onSelect: (reference: CanvasResourceReference) => void;
}) {
    const selectedRef = useRef(false);
    const activeItemRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        activeItemRef.current?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, references]);

    const selectReference = (reference: CanvasResourceReference) => {
        if (selectedRef.current) return;
        selectedRef.current = true;
        onSelect(reference);
    };
    const stopCanvasInteraction = (event: PointerEvent | MouseEvent) => {
        event.stopPropagation();
    };
    const menuWidth = 256;
    const maxMenuHeight = 224;
    const menuHeight = Math.min(maxMenuHeight, references.length * 48 + 8);
    const gap = 6;
    const anchor = rect || new DOMRect(16, 16, 0, 0);
    const left = clamp(anchor.left, 8, window.innerWidth - menuWidth - 8);
    const showAbove = anchor.bottom + gap + menuHeight > window.innerHeight && anchor.top - gap - menuHeight >= 8;
    const top = clamp(showAbove ? anchor.top - gap - menuHeight : anchor.bottom + gap, 8, window.innerHeight - menuHeight - 8);

    return createPortal(
        <div
            data-canvas-resource-mention-menu="true"
            className="fixed z-[120] max-h-56 w-64 overflow-y-auto rounded-xl border p-1 shadow-2xl backdrop-blur-md"
            style={{
                left,
                top,
                background: theme.toolbar.panel,
                borderColor: theme.toolbar.border,
                color: theme.node.text,
            }}
            onPointerDown={stopCanvasInteraction}
            onMouseDown={stopCanvasInteraction}
            onClick={(event) => {
                event.stopPropagation();
            }}
        >
            {references.map((reference, index) => (
                <button
                    key={reference.id}
                    ref={index === activeIndex ? activeItemRef : undefined}
                    type="button"
                    className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition"
                    style={{
                        background: index === activeIndex ? theme.toolbar.activeBg : "transparent",
                        color: index === activeIndex ? theme.toolbar.activeText : theme.node.text,
                    }}
                    onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectReference(reference);
                    }}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        selectReference(reference);
                    }}
                >
                    <ReferencePreview reference={reference} />

                    <span className="min-w-0 flex-1">
                        <span className="block font-medium">{reference.label}</span>
                        <span className="block truncate opacity-65">{reference.text || reference.title}</span>
                    </span>
                </button>
            ))}
        </div>,
        document.body,
    );
}

function ReferencePreview({ reference }: { reference: CanvasResourceReference }) {
    if (reference.kind === "image" && reference.previewUrl) {
        return <NextImage src={reference.previewUrl} alt="" width={36} height={36} unoptimized className="size-9 shrink-0 rounded-md object-cover" />;
    }
    if (reference.kind === "video" && reference.previewUrl) {
        return <video src={reference.previewUrl} className="size-9 shrink-0 rounded-md bg-black object-cover" muted preload="metadata" />;
    }
    const Icon = reference.kind === "audio" ? Music2 : reference.kind === "video" ? Video : reference.kind === "image" ? ImageIcon : FileText;
    return (
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-black/10">
            <Icon className="size-4" />
        </span>
    );
}

function createReferenceChip(
    reference: CanvasResourceReference,
    theme: (typeof canvasThemes)[keyof typeof canvasThemes],
    onImagePreview: (url: string) => void,
) {
    const wrapper = document.createElement("span");
    wrapper.contentEditable = "false";
    wrapper.dataset.refLabel = reference.label;
    if (reference.kind === "image" && reference.previewUrl) {
        const image = document.createElement("img");
        image.src = reference.previewUrl;
        image.alt = reference.title;
        image.className = "size-6 rounded object-cover";
        wrapper.className = "mx-px inline-flex size-6 items-center justify-center overflow-hidden rounded align-middle";
        wrapper.appendChild(image);
        wrapper.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            onImagePreview(reference.previewUrl || "");
        });
        return wrapper;
    }

    wrapper.className = "mx-px inline-flex h-6 max-w-40 items-center justify-center overflow-hidden rounded-md border px-1 text-xs leading-none align-middle";
    wrapper.style.background = theme.toolbar.panel;
    wrapper.style.borderColor = theme.node.stroke;
    wrapper.style.color = theme.node.text;
    wrapper.title = reference.text || reference.title;
    const text = document.createElement("span");
    text.className = "block truncate";
    text.textContent = reference.kind === "text" ? reference.text || reference.title : reference.label;
    wrapper.appendChild(text);
    return wrapper;
}

function serializePromptEditor(editor: HTMLElement) {
    return serializePromptNodes(editor.childNodes).replace(/\uFEFF/g, "");
}

function serializePromptNodes(nodes: NodeListOf<ChildNode>) {
    let result = "";
    nodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent || "";
            return;
        }
        if (!(node instanceof HTMLElement)) return;
        const referenceLabel = node.dataset.refLabel;
        if (referenceLabel) {
            result += referenceLabel;
            return;
        }
        if (node.tagName === "BR") {
            result += "\n";
            return;
        }
        const content = serializePromptNodes(node.childNodes);
        const isBlock = node.tagName === "DIV" || node.tagName === "P";
        if (isBlock && result && !result.endsWith("\n")) result += "\n";
        result += content;
        if (isBlock && !content) result += "\n";
    });
    return result;
}

function removeActiveMention() {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const text = textBeforeCaret();
    const match = /@([^\s@]*)$/.exec(text);
    if (!match) return;
    range.setStart(range.startContainer, Math.max(0, range.startOffset - (match[1] || "").length - 1));
    range.deleteContents();
}

function deleteAdjacentReference(key: string) {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return false;
    const range = selection.getRangeAt(0);
    const target = adjacentReferenceNode(range, key);
    if (!target) return false;
    target.parentNode?.normalize();
    const previousSibling = target.previousSibling;
    const nextSibling = target.nextSibling;
    if (previousSibling?.nodeType === Node.TEXT_NODE) previousSibling.textContent = (previousSibling.textContent || "").replace(/[ \u00A0]$/, "");
    if (nextSibling?.nodeType === Node.TEXT_NODE) nextSibling.textContent = (nextSibling.textContent || "").replace(/^[ \u00A0]/, "");
    const nextCaretNode = document.createTextNode("");
    target.replaceWith(nextCaretNode);
    range.setStart(nextCaretNode, 0);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}

function adjacentReferenceNode(range: Range, key: string) {
    const container = range.startContainer;
    const offset = range.startOffset;
    const previous = key === "Backspace";
    if (container.nodeType === Node.TEXT_NODE) {
        const text = container.textContent || "";
        if ((previous && offset > 0) || (!previous && offset < text.length)) return null;
        return findReferenceSibling(container, previous);
    }
    const children = Array.from(container.childNodes);
    return findReferenceSibling(children[previous ? offset - 1 : offset] || container, previous, true);
}

function findReferenceSibling(node: Node, previous: boolean, includeSelf = false): HTMLElement | null {
    let current: Node | null = includeSelf ? node : previous ? node.previousSibling : node.nextSibling;
    while (current && current.nodeType === Node.TEXT_NODE && !(current.textContent || "").trim()) {
        current = previous ? current.previousSibling : current.nextSibling;
    }
    return current instanceof HTMLElement && current.dataset.refLabel ? current : null;
}

function textBeforeCaret() {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return "";
    const range = selection.getRangeAt(0).cloneRange();
    const editor = closestPromptEditor(range.startContainer);
    if (!editor) return "";
    range.setStart(editor, 0);
    return range.toString();
}

function getCaretRect(): DOMRect | null {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return null;
    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    if (rect.width || rect.height || rect.left || rect.top) return rect;
    const editor = closestPromptEditor(range.startContainer);
    return editor?.getBoundingClientRect() || null;
}

function closestPromptEditor(node: Node) {
    const element = node instanceof Element ? node : node.parentElement;
    return element?.closest("[contenteditable='true']") || null;
}

function placeCaretAtEnd(element: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

function parsePromptTokens(value: string, labels: string[]): PromptToken[] {
    if (!labels.length) return value ? [{ type: "text", value }] : [];
    const pattern = new RegExp(`(${labels.map(escapeRegExp).join("|")})`, "g");
    const tokens: PromptToken[] = [];
    let lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
        if (match.index === undefined) continue;
        if (match.index > lastIndex) {
            tokens.push({
                type: "text",
                value: value.slice(lastIndex, match.index),
            });
        }
        tokens.push({
            type: "reference",
            label: match[0],
        });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < value.length) {
        tokens.push({
            type: "text",
            value: value.slice(lastIndex),
        });
    }
    return tokens;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number) {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
}
import type { ReferenceImage } from "@/types/image";

export function imageReferenceLabel(index: number) {
    return `图片${index + 1}`;
}

export function imageReferenceDescriptiveLabel(ref: ReferenceImage, index: number) {
    const label = imageReferenceLabel(index);
    const name = (ref.name || "").trim();
    return name ? `${label}(${name})` : label;
}

export function buildImageReferencePromptText(prompt: string, references: ReferenceImage[]) {
    const text = prompt.trim();
    if (!references.length) return text;
    const labels = references.map((ref, i) => imageReferenceDescriptiveLabel(ref, i));
    return `${labels.join("、")}\n\n${text}`;
}

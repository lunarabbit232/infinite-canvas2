import { cosyVoiceOptions } from "@/lib/audio-generation";

export type TTSVoice = { id: string; name: string };

// 声线取自本地音色表：微软 Edge TTS 端点已下线（/tts/synthesize 恒 404），
// 配音统一走渠道代理 /audio/speech（硅基流动 CosyVoice2）。
export function listTTSVoices(): TTSVoice[] {
    return cosyVoiceOptions.map((item) => ({ id: item.value, name: item.label }));
}

export function ttsVoiceShortName(voice: string) {
    const name = voice.includes(":") ? voice.slice(voice.lastIndexOf(":") + 1) : voice;
    return name || voice;
}

// voice 形如 FunAudioLLM/CosyVoice2-0.5B:alex，冒号前即模型名
function modelFromVoice(voice: string) {
    return voice.includes(":") ? voice.slice(0, voice.lastIndexOf(":")) : "FunAudioLLM/CosyVoice2-0.5B";
}

export async function synthesizeTTS(text: string, voice: string, token: string): Promise<Blob> {
    const response = await fetch("/api/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            model: modelFromVoice(voice),
            input: text,
            voice,
            response_format: "mp3",
            speed: 1,
        }),
    });
    if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { msg?: string; error?: { message?: string } };
        throw new Error(err.msg || err.error?.message || "配音生成失败");
    }
    const blob = await response.blob();
    // 后端失败时以 JSON 形式返回 code=1，需识别后抛错，避免把错误当音频保存
    if (blob.type.includes("json")) {
        const payload = JSON.parse(await blob.text()) as { msg?: string };
        throw new Error(payload.msg || "配音生成失败");
    }
    return blob.type.startsWith("audio/") ? blob : new Blob([blob], { type: "audio/mpeg" });
}

import { saveAs } from "file-saver";
import { apiGet } from "./request";

export type TTSVoice = { id: string; name: string };

export async function fetchTTSVoices(token: string): Promise<TTSVoice[]> {
    return apiGet<TTSVoice[]>("/api/v1/tts/voices", undefined, token);
}

export async function synthesizeTTS(text: string, voice: string, token: string): Promise<void> {
    const resp = await fetch("/api/v1/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, voice }),
    });
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({ msg: "TTS 请求失败" }));
        throw new Error(err.msg || "TTS 请求失败");
    }
    const blob = await resp.blob();
    saveAs(blob, "voice.mp3");
}

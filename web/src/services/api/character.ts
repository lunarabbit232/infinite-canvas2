import { apiDelete, apiGet, apiPost } from "@/services/api/request";
import { useUserStore } from "@/stores/use-user-store";
import type { Character } from "@/types/character";

function token() {
    return useUserStore.getState().token;
}

export function fetchCharacters() {
    return apiGet<Character[]>("/api/v1/characters", undefined, token());
}

export function saveCharacter(data: Partial<Character> & { id?: string }) {
    return apiPost<Character>("/api/v1/characters", data, token());
}

export function deleteCharacter(id: string) {
    return apiDelete<boolean>(`/api/v1/characters/${encodeURIComponent(id)}`, token());
}

export function checkCharacterConsistency(characterId: string, imageUrl: string) {
    return apiPost<{ score: number; characterId: string }>("/api/v1/characters/consistency", { characterId, imageUrl }, token());
}

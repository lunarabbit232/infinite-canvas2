import { useUserStore } from "@/stores/use-user-store";
import { apiDelete, apiGet, apiPost } from "@/services/api/request";
import type { Prop } from "@/types/prop";

export const fetchProps = () => {
    const token = useUserStore.getState().token;
    if (!token) return Promise.resolve([] as Prop[]);
    return apiGet<Prop[]>("/props", undefined, token);
};

export const saveProp = (data: Partial<Prop>) => {
    const token = useUserStore.getState().token;
    return apiPost<Prop>("/props", data, token);
};

export const deleteProp = (id: string) => {
    const token = useUserStore.getState().token;
    return apiDelete(`/props/${id}`, token);
};

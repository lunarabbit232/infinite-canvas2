import { apiGet, apiPost } from "@/services/api/request";

export type WorkflowEvent = {
    id: string;
    projectId: string;
    eventType: string;
    nodeId: string;
    payload: string;
    timestamp: number;
    userId: string;
    sessionId: string;
};

export type WorkflowEventList = {
    items: WorkflowEvent[];
    total: number;
    page: number;
    pageSize: number;
};

export type WorkflowReplayResult = {
    events: WorkflowEvent[];
    nodes: any[];
    edges: any[];
};

export async function recordWorkflowEvent(event: {
    projectId: string;
    eventType: string;
    nodeId?: string;
    payload?: string;
    userId?: string;
    sessionId?: string;
}) {
    return apiPost<WorkflowEvent>("/api/workflows/events", event);
}

export async function batchRecordWorkflowEvents(events: Partial<WorkflowEvent>[]) {
    return apiPost("/api/workflows/events/batch", { events });
}

export async function listWorkflowEvents(projectId: string, since?: number, page?: number, pageSize?: number) {
    return apiGet<WorkflowEventList>("/api/workflows/events", { projectId, since, page, pageSize });
}

export async function replayWorkflowEvents(projectId: string) {
    return apiGet<WorkflowReplayResult>("/api/workflows/replay", { projectId });
}

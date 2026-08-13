// Dagre 自动布局工具
// 支持横向（LR）/ 纵向（TB）一键自动排版

import * as dagre from "dagre";
import type { CanvasConnection, CanvasNodeData } from "../types";
import { CanvasNodeType } from "../types";
import { isCanvasImageNodeType } from "./canvas-panorama";

export type LayoutDirection = "LR" | "TB" | "video";

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 220;
const NODE_HORIZONTAL_GAP = 80;
const NODE_VERTICAL_GAP = 60;
const GROUP_PADDING = 40;

/**
 * 使用 Dagre 对有向无环图进行自动布局
 * @returns 更新了 position 的节点数组（不修改原数组）
 */
export function autoLayoutNodes(
    nodes: CanvasNodeData[],
    connections: CanvasConnection[],
    direction: LayoutDirection = "LR",
): CanvasNodeData[] {
    if (nodes.length === 0) return nodes;

    if (direction === "video") {
        return videoWorkflowLayout(nodes);
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: direction,
        nodesep: NODE_HORIZONTAL_GAP,
        ranksep: NODE_VERTICAL_GAP,
        marginx: 20,
        marginy: 20,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // 添加节点
    for (const node of nodes) {
        const w = node.width || DEFAULT_NODE_WIDTH;
        const h = node.height || DEFAULT_NODE_HEIGHT;
        g.setNode(node.id, { width: w, height: h });
    }

    // 添加连线（边）
    for (const conn of connections) {
        if (conn.fromNodeId && conn.toNodeId) {
            g.setEdge(conn.fromNodeId, conn.toNodeId);
        }
    }

    // 执行布局
    dagre.layout(g);

    // 构建位置映射
    const positionMap = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
        const dagreNode = g.node(node.id);
        if (dagreNode) {
            positionMap.set(node.id, {
                x: dagreNode.x - (dagreNode.width || DEFAULT_NODE_WIDTH) / 2,
                y: dagreNode.y - (dagreNode.height || DEFAULT_NODE_HEIGHT) / 2,
            });
        }
    }

    return nodes.map((node) => {
        const pos = positionMap.get(node.id);
        if (!pos) return node;

        // 对于 Group 内的子节点，偏移入 Group 内部
        if (node.metadata?.groupId) {
            return {
                ...node,
                position: {
                    x: pos.x + GROUP_PADDING,
                    y: pos.y + GROUP_PADDING,
                },
            };
        }

        return { ...node, position: pos };
    });
}

function videoWorkflowLayout(nodes: CanvasNodeData[]): CanvasNodeData[] {
    const resourceNodes = nodes.filter(
        (n) => isCanvasImageNodeType(n.type) || n.type === CanvasNodeType.Text || n.type === CanvasNodeType.Character,
    );
    const targetNodes = nodes.filter(
        (n) => n.type === CanvasNodeType.Video || n.type === CanvasNodeType.Config || n.type === CanvasNodeType.Audio,
    );
    const otherNodes = nodes.filter(
        (n) => !resourceNodes.includes(n) && !targetNodes.includes(n),
    );

    const GAP = 64;
    const TOP_Y = 0;
    const BOTTOM_Y = 400;

    const updated = new Map<string, { x: number; y: number }>();

    let x = 0;
    resourceNodes.forEach((n) => {
        updated.set(n.id, { x, y: TOP_Y });
        x += n.width + GAP;
    });

    x = 0;
    targetNodes.forEach((n) => {
        updated.set(n.id, { x, y: BOTTOM_Y });
        x += n.width + GAP;
    });

    let otherX = 0;
    otherNodes.forEach((n) => {
        updated.set(n.id, { x: otherX, y: BOTTOM_Y + 300 });
        otherX += n.width + GAP;
    });

    return nodes.map((n) => {
        const pos = updated.get(n.id);
        return pos ? { ...n, position: pos } : n;
    });
}

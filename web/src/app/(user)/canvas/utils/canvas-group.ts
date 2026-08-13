import { CanvasNodeType, type CanvasNodeData } from "../types";

export const GROUP_PADDING = 24;

export function getNodeBounds(nodes: CanvasNodeData[]) {
    return nodes.reduce(
        (bounds, node) => ({
            left: Math.min(bounds.left, node.position.x),
            top: Math.min(bounds.top, node.position.y),
            right: Math.max(bounds.right, node.position.x + node.width),
            bottom: Math.max(bounds.bottom, node.position.y + node.height),
        }),
        { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity },
    );
}

export function findGroupDropTarget(movedIds: Set<string>, nodes: CanvasNodeData[]) {
    if (nodes.some((node) => movedIds.has(node.id) && node.type === CanvasNodeType.Group)) return null;

    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    return [...nodes].reverse().find((group) => {
        if (group.type !== CanvasNodeType.Group || movedIds.has(group.id)) return false;
        return movingNodes.some((node) => {
            const centerX = node.position.x + node.width / 2;
            const centerY = node.position.y + node.height / 2;
            return centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height;
        });
    }) || null;
}

export function snapNodesIntoGroup(movedIds: Set<string>, nodes: CanvasNodeData[], group: CanvasNodeData) {
    const movingNodes = nodes.filter((node) => movedIds.has(node.id) && node.type !== CanvasNodeType.Group);
    if (!movingNodes.length) return nodes;

    const bounds = getNodeBounds(movingNodes);
    const left = group.position.x + GROUP_PADDING;
    const top = group.position.y + GROUP_PADDING;
    const right = group.position.x + group.width - GROUP_PADDING;
    const bottom = group.position.y + group.height - GROUP_PADDING;
    const dx = bounds.left < left ? left - bounds.left : bounds.right > right ? right - bounds.right : 0;
    const dy = bounds.top < top ? top - bounds.top : bounds.bottom > bottom ? bottom - bounds.bottom : 0;

    return nodes.map((node) => {
        if (!movedIds.has(node.id) || node.type === CanvasNodeType.Group) return node;
        return {
            ...node,
            position: { x: node.position.x + dx, y: node.position.y + dy },
            metadata: { ...node.metadata, groupId: group.id },
        };
    });
}

export function findContainingGroupId(node: CanvasNodeData, nodes: CanvasNodeData[]) {
    const centerX = node.position.x + node.width / 2;
    const centerY = node.position.y + node.height / 2;
    return [...nodes].reverse().find((group) => group.type === CanvasNodeType.Group && centerX >= group.position.x && centerX <= group.position.x + group.width && centerY >= group.position.y && centerY <= group.position.y + group.height)?.id;
}

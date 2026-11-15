/**
 * Dijkstra over the crisis road graph.
 * Closed segments are removed when avoidClosed is set, which is how an
 * alternative street sequence is produced after a closure.
 */
export function shortestPath(nodes, edges, fromId, toId, { avoidClosed = true, medicalOnly = false } = {}) {
  if (fromId === toId) {
    const node = nodes.find((item) => item.id === fromId);
    return {
      minutes: 0,
      meters: 0,
      nodeIds: [fromId],
      edgeIds: [],
      roads: [],
      geometry: node ? [{ lat: node.lat, lng: node.lng }] : [],
    };
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const adjacent = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (avoidClosed && edge.status === 'closed') continue;
    if (medicalOnly && !edge.medical) continue;
    if (!adjacent.has(edge.from) || !adjacent.has(edge.to)) continue;
    adjacent.get(edge.from).push(edge);
    adjacent.get(edge.to).push({ ...edge, from: edge.to, to: edge.from });
  }

  const distance = new Map([[fromId, 0]]);
  const previous = new Map();
  const via = new Map();
  const queue = new Set(nodes.map((node) => node.id));

  while (queue.size) {
    let current = null;
    let best = Infinity;
    for (const id of queue) {
      const candidate = distance.get(id) ?? Infinity;
      if (candidate < best) {
        best = candidate;
        current = id;
      }
    }
    if (current == null || best === Infinity) break;
    queue.delete(current);
    if (current === toId) break;
    for (const edge of adjacent.get(current)) {
      const next = best + edge.minutes;
      if (next < (distance.get(edge.to) ?? Infinity)) {
        distance.set(edge.to, next);
        previous.set(edge.to, current);
        via.set(edge.to, edge);
      }
    }
  }

  if (!previous.has(toId)) return null;

  const nodeIds = [toId];
  const edgeIds = [];
  const roads = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const edge = via.get(cursor);
    edgeIds.push(edge.id);
    roads.push(edge.name);
    cursor = previous.get(cursor);
    nodeIds.push(cursor);
  }
  nodeIds.reverse();
  edgeIds.reverse();

  let meters = 0;
  for (const id of edgeIds) {
    const edge = edges.find((item) => item.id === id);
    meters += edge?.meters || 0;
  }

  return {
    minutes: distance.get(toId),
    meters,
    nodeIds,
    edgeIds,
    roads: unique(roads),
    geometry: nodeIds.map((id) => {
      const node = byId.get(id);
      return { lat: node.lat, lng: node.lng };
    }),
  };
}

function unique(values) {
  return [...new Set(values)];
}

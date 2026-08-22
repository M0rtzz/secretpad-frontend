export const parseNodeId = (nodeId: string) => {
  // pipeline1-node-1 / canvas-3c5be0cdd6a0-node-33
  const match = nodeId.match(/^(.*)-node-(\d+)$/);
  if (!match) {
    throw new Error('invalid node id');
  }
  return {
    dagId: match[1],
    nodeNum: parseInt(match[2], 10),
  };
};

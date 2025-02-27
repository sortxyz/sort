export function sortNodesByPosition<T extends Node>(nodes: T[]): T[] {
  return Array.from(nodes).sort((a, b) => {
    const positionBitMask = a.compareDocumentPosition(b);
    if (positionBitMask & Node.DOCUMENT_POSITION_FOLLOWING) {
      return -1;
    } else if (positionBitMask & Node.DOCUMENT_POSITION_PRECEDING) {
      return 1;
    }

    return 0;
  });
}

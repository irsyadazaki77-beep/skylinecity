export type GridPoint = [number, number];

/**
 * Creates a deterministic orthogonal road path between two grid points.
 * The longer axis is drawn first so a diagonal drag reaches the exact
 * endpoint instead of silently dropping one coordinate.
 */
export function getOrthogonalRoadPath(start: GridPoint, end: GridPoint): GridPoint[] {
  const [sx, sy] = start;
  const [ex, ey] = end;
  const path: GridPoint[] = [];
  const dx = Math.abs(ex - sx);
  const dy = Math.abs(ey - sy);
  const xStep = ex >= sx ? 1 : -1;
  const yStep = ey >= sy ? 1 : -1;

  if (dx >= dy) {
    for (let x = sx; x !== ex + xStep; x += xStep) path.push([x, sy]);
    for (let y = sy + yStep; y !== ey + yStep; y += yStep) path.push([ex, y]);
  } else {
    for (let y = sy; y !== ey + yStep; y += yStep) path.push([sx, y]);
    for (let x = sx + xStep; x !== ex + xStep; x += xStep) path.push([x, ey]);
  }

  return path;
}

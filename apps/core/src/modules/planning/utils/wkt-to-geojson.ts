import wellknown from "wellknown";

export function wktToGeoJson(wkt?: string | null) {
  if (!wkt || typeof wkt !== "string") {
    return null;
  }

  try {
    return wellknown.parse(wkt);
  } catch {
    return null;
  }
}

export function computeBbox(geometry: any): [number, number, number, number] | null {
  if (!geometry) {
    return null;
  }

  const points: number[][] = [];

  const collect = (coords: any) => {
    if (!Array.isArray(coords)) {
      return;
    }

    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      points.push([coords[0], coords[1]]);
      return;
    }

    for (const item of coords) {
      collect(item);
    }
  };

  collect(geometry.coordinates);

  if (!points.length) {
    return null;
  }

  let minX = points[0][0];
  let minY = points[0][1];
  let maxX = points[0][0];
  let maxY = points[0][1];

  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return [minX, minY, maxX, maxY];
}

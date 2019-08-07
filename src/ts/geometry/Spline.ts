import { Polyline, SpatialReference } from "esri/geometry";
import * as geometryEngine from "esri/geometry/geometryEngine";
import * as Point from "esri/geometry/Point";

export default class Spline {

  private spatialReference: SpatialReference;

  private xs: number[] = [];
  private dxs: number[] = [];
  private points: number[][] = [];

  private tangents: number[][] = [];
  private tangentDistances: number[] = [];

  constructor(polyline: Polyline) {
    const coordinates = polyline.paths.length ? polyline.paths[0] : [];
    this.spatialReference = polyline.spatialReference;

    // Compute distances between given coordinates
    let prevPoint: Point | null = null;
    coordinates.forEach((coords, index) => {
      this.points.push(([] as number[]).concat(coords));
      const point = this.newPoint(coords);
      if (index === 0) {
        this.xs.push(0);
      } else {
        const distance = geometryEngine.distance(prevPoint as Point, point, "meters");
        this.dxs.push(distance);
        this.xs.push(distance + this.xs[index - 1]);
      }
      prevPoint = point;
    });

    // Compute tangents for each point
    this.points.forEach((point, index, values) => {
      const prevIndex = index === 0 ? 0 : index - 1;
      const nextIndex = index === values.length - 1 ? index : index + 1;
      const tangent = point.map(
        (value, i) => values[nextIndex][i] - values[prevIndex][i]
      );
      this.tangents.push(tangent);

      const p1 = this.newPoint(values[prevIndex]);
      const p2 = this.newPoint(values[nextIndex]);
      this.tangentDistances.push(geometryEngine.distance(p1, p2, "meters"));
    });
  }

  public interpolate = (x: number): number[] => {
    const xs = this.xs;
    const length = xs.length;
    const start = length ? xs[0] : 0;
    const end = length ? xs[length - 1] : 0;
    const xAbs = start + (end - start) * x;
    return this.interpolateAbsolute(xAbs);
  }

  private interpolateAbsolute(xAbs: number) {
    let i = 0;
    const xs = this.xs;
    while (i < xs.length - 1 && xAbs > xs[i + 1]) {
      i++;
    }

    const dx = this.dxs[i];

    const p1 = this.points[i];
    const p2 = this.points[i + 1];
    const t1 = this.tangents[i];
    const t2 = this.tangents[i + 1];
    const s = (xAbs - xs[i]) / dx;

    const a = 0.9;
    const ta1 = dx / this.tangentDistances[i] * a;
    const ta2 = dx / this.tangentDistances[i + 1] * a;

    return this.splinePoint(s, p1, p2, t1, t2, ta1, ta2);
  }

  // Spline basis function
  // https://www.cubic.org/docs/hermite.htm
  private splinePoint(s: number, p1: number[], p2: number[], t1: number[], t2: number[], ta1: number, ta2: number) {
    // calculate basis functions
    const s2 = Math.pow(s, 2);
    const s3 = Math.pow(s, 3);
    const h1 = 2 * s3 - 3 * s2 + 1; // calculate basis function 1
    const h2 = -2 * s3 + 3 * s2; // calculate basis function 2
    const h3 = s3 - 2 * s2 + s; // calculate basis function 3
    const h4 = s3 - s2; // calculate basis function 4

    // calculate new point
    const p = [];

    for (let i = 0; i < p1.length; i++) {
      p.push(h1 * p1[i] + h2 * p2[i] + h3 * t1[i] * ta1 + h4 * t2[i] * ta2);
    }
    return p;
  }

  private newPoint = (coords: number[]) => {
    const x = coords[0];
    const y = coords[1];
    const z = coords[2];
    return new Point({
      spatialReference: this.spatialReference,
      x,
      y,
      z
    });
  }

}



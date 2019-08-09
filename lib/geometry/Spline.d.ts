/// <reference types="arcgis-js-api" />
import { Polyline } from "esri/geometry";
declare class Spline {
    private spatialReference;
    private xs;
    private dxs;
    private points;
    private tangents;
    private tangentDistances;
    constructor(polyline: Polyline);
    interpolate: (x: number) => number[];
    createPolyline: (count?: number) => __esri.Polyline;
    private interpolateAbsolute;
    private splinePoint;
    private newPoint;
}
export = Spline;

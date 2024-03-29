/// <reference types="arcgis-js-api" />
import Accessor = require("esri/core/Accessor");
import * as Graphic from "esri/Graphic";
import * as FeatureLayer from "esri/layers/FeatureLayer";
import * as GeoJSONLayer from "esri/layers/GeoJSONLayer";
declare type LineLayerType = FeatureLayer | GeoJSONLayer;
declare const SplineLayerProxy_base: typeof Accessor;
declare class SplineLayerProxy extends SplineLayerProxy_base {
    lineLayer: LineLayerType;
    private resolveSplineLayer;
    private rejectSplineLayer;
    private splineLayerPromise;
    private existingObjectIds;
    getLineGraphic(splineGraphic: Graphic): IPromise<Graphic>;
    whenSplineLayer(): IPromise<FeatureLayer>;
    private createSplineGraphic;
    private initializeSplineLayer;
    private refresh;
    private refreshSplineLayer;
}
export = SplineLayerProxy;

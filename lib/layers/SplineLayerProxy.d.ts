/// <reference types="arcgis-js-api" />
import Accessor = require("esri/core/Accessor");
import * as Graphic from "esri/Graphic";
import * as FeatureLayer from "esri/layers/FeatureLayer";
import * as GeoJSONLayer from "esri/layers/GeoJSONLayer";
declare type lineLayer = FeatureLayer | GeoJSONLayer;
declare const SplineLayerProxy_base: typeof Accessor;
declare class SplineLayerProxy extends SplineLayerProxy_base {
    lineLayer: lineLayer;
    splineLayer: FeatureLayer;
    private existingObjectIds;
    getLineGraphic(splineGraphic: Graphic): IPromise<Graphic>;
    private createSplineGraphic;
    private initializeSplineLayer;
    private refreshSplines;
}
export = SplineLayerProxy;

import Accessor = require("esri/core/Accessor");
import { declared, property, subclass } from "esri/core/accessorSupport/decorators";
import * as promiseUtils from "esri/core/promiseUtils";
import { Polyline } from "esri/geometry";
import * as Graphic from "esri/Graphic";
import * as FeatureLayer from "esri/layers/FeatureLayer";
import * as GeoJSONLayer from "esri/layers/GeoJSONLayer";
import * as jsonUtils from "esri/renderers/support/jsonUtils";

import Spline = require("./../geometry/Spline");

type LineLayerType = FeatureLayer | GeoJSONLayer;

const LINE_OBJECT_ID_FIELD = "_line_objectid";

const createSplineLayer = (layer: FeatureLayer) => {

  let renderer = layer.renderer;
  if (renderer) {
    renderer = jsonUtils.fromJSON(renderer.toJSON());
  }

  let elevationInfo: any = layer.elevationInfo;

  // Try to invoke internal clone()
  if (elevationInfo && typeof elevationInfo.clone === "function") {
    elevationInfo = elevationInfo.clone();
  }

  return new FeatureLayer({
    definitionExpression: layer.definitionExpression,
    elevationInfo,
    fields: [
      {
        name: "OBJECTID",
        type: "oid"
      },
      {
        name: LINE_OBJECT_ID_FIELD,
        type: "long"
      }],
    geometryType: "polyline",
    labelingInfo: layer.labelingInfo ? layer.labelingInfo.map((info) => info.clone()) : undefined as any,
    labelsVisible: layer.labelsVisible,
    legendEnabled: layer.legendEnabled,
    listMode: layer.listMode,
    maxScale: layer.maxScale,
    minScale: layer.maxScale,
    objectIdField: "OBJECTID",
    opacity: layer.opacity,
    outFields: ["*"],
    popupEnabled: layer.popupEnabled,
    popupTemplate: layer.popupTemplate ? layer.popupTemplate.clone() : undefined as any,
    renderer,
    source: [],
    spatialReference: layer.spatialReference,
    title: layer.title,
  });
}

@subclass("polyspline.layers.SplineLayerProxy")
class SplineLayerProxy extends declared(Accessor) {

  @property()
  get lineLayer(): LineLayerType {
    return this._get<LineLayerType>("lineLayer");
  }
  set lineLayer(layer: LineLayerType) {
    const oldLayer = this._get("lineLayer");
    if (oldLayer) {
      if (oldLayer === layer) {
        return;
      }
      throw new Error("The `lineLayer` property cannot be changed once a layer has been assigned");
    }

    if (layer) {
      this._set("lineLayer", layer);
      this.initializeSplineLayer();
    }
  }

  private resolveSplineLayer: (splineLayer: FeatureLayer) => any = null as any;
  private rejectSplineLayer: (error: any) => any = null as any;

  private splineLayerPromise: IPromise<FeatureLayer> = promiseUtils.create((resolve, reject) => {
    this.resolveSplineLayer = resolve;
    this.rejectSplineLayer = reject;
  });
  private existingObjectIds = new Map<number, number>();

  public getLineGraphic(splineGraphic: Graphic): IPromise<Graphic> {
    const layer = this.lineLayer;
    if (!layer) {
      return promiseUtils.reject("No source layer assigned");
    }

    const objectId = splineGraphic.attributes[LINE_OBJECT_ID_FIELD];
    return layer
      .queryFeatures({
        objectIds: [objectId],
        outFields: ["*"],
        returnGeometry: true,
      })
      .then((featureSet): Graphic => {
        if (featureSet.features.length) {
          return featureSet.features[0];
        }
        throw new Error("No such graphic with objectId `{objectId}`");
      });
  }

  public whenSplineLayer(): IPromise<FeatureLayer> {
    return this.splineLayerPromise;
  }

  private createSplineGraphic = (graphic: Graphic): Graphic => {
    const geometry = graphic.geometry as Polyline;
    let splineGeometry: Polyline;
    const spatialReference = this.lineLayer.spatialReference;

    if (
      geometry.paths.length &&
      2 < geometry.paths[0].length
    ) {
      const spline = new Spline(geometry);
      splineGeometry = spline.createPolyline();
    } else {
      splineGeometry = new Polyline({
        paths: geometry.paths,
        spatialReference,
      })
    }

    return new Graphic({
      attributes: graphic.attributes,
      geometry: splineGeometry,
    });
  }

  private initializeSplineLayer = (): IPromise => {

    const refreshDebounced = promiseUtils.debounce(this.refresh);

    return this.lineLayer
        .load()
        .then((layer) => {
          layer.on("edits", refreshDebounced);

          if (layer.geometryType !== "polyline") {
            const error = new Error(
              "`lineLayer` must have `geometryType` \"polyline\""
            );
            this.rejectSplineLayer(error);
            throw error;
          }

          const splineLayer = createSplineLayer(layer);
          this.resolveSplineLayer(splineLayer);

          return refreshDebounced();
        });
  }

  private refresh = (): IPromise => {
    return this.whenSplineLayer().then((splineLayer) => this.refreshSplineLayer(splineLayer));
  }

  private refreshSplineLayer = (splineLayer: FeatureLayer): IPromise => {
    return this.lineLayer.queryFeatures()
      .then((response) => response.features.map(this.createSplineGraphic))
      .then((splineGraphics) => {
        const existingObjectIds = this.existingObjectIds;

        const updateFeatures: Graphic[] = [];
        const addFeatures: Graphic[] = [];
        splineGraphics.forEach((splineGraphic) => {
          const lineObjectId = splineGraphic.attributes[this.lineLayer.objectIdField];
          splineGraphic.attributes[LINE_OBJECT_ID_FIELD] = lineObjectId;

          if (existingObjectIds.has(lineObjectId)) {
            splineGraphic.attributes[splineLayer.objectIdField] = existingObjectIds.get(lineObjectId);
            existingObjectIds.delete(lineObjectId);
            updateFeatures.push(splineGraphic);
          } else {
            splineGraphic.attributes[splineLayer.objectIdField] = null;
            addFeatures.push(splineGraphic);
          }
        });

        const deleteFeatures = Array.from(existingObjectIds.values())
          .map((objectId) => {
            return { objectId };
          });

        const edits = {
          addFeatures,
          deleteFeatures,
          updateFeatures,
        };

        return splineLayer.applyEdits(edits).then((results) => {
          this.existingObjectIds.clear();
          splineGraphics.forEach((splineGraphic) => {
            const lineObjectId = splineGraphic.attributes[LINE_OBJECT_ID_FIELD];
            const splineObjectId = splineGraphic.attributes[splineLayer.objectIdField];
            this.existingObjectIds.set(lineObjectId, splineObjectId);
          });
          return results;
        });
      });
  }

}

export = SplineLayerProxy;
import Accessor = require("esri/core/Accessor");
import { declared, property, subclass } from "esri/core/accessorSupport/decorators";
import * as promiseUtils from "esri/core/promiseUtils";
import { Polyline } from "esri/geometry";
import * as SpatialReference from "esri/geometry/SpatialReference";
import * as Graphic from "esri/Graphic";
import * as FeatureLayer from "esri/layers/FeatureLayer";
import * as GeoJSONLayer from "esri/layers/GeoJSONLayer";
import * as jsonUtils from "esri/renderers/support/jsonUtils";

import Spline = require("./../geometry/Spline");

type lineLayer = FeatureLayer | GeoJSONLayer;

const LINE_OBJECT_ID_FIELD = "_line_objectid";

@subclass("polyspline.layers.SplineLayerProxy")
class SplineLayerProxy extends declared(Accessor) {

  @property()
  get lineLayer(): lineLayer {
    return this._get<lineLayer>("lineLayer");
  }
  set lineLayer(layer: lineLayer) {
    if (layer) {
      const refresh = promiseUtils.debounce(this.refreshSplines);
      if (layer.type === "feature") {
        layer.on("edits" as any, refresh);
      }
      this._set("lineLayer", layer);

      this.initializeSplineLayer();
    } else {
      this._set("lineLayer", null);
    }

  }

  @property({ readOnly: true })
  public splineLayer = new FeatureLayer({
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
    objectIdField: "OBJECTID",
    outFields: ["*"],
    source: [],
    spatialReference: SpatialReference.WebMercator
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
    const splineLayer = this.splineLayer;

    return this.lineLayer
        .load()
        .then((layer) => {
          if (layer.geometryType !== "polyline") {
            throw new Error(
              "Feature layer must have geometryType 'polyline'"
            );
          }

          const renderer = layer.renderer;
          if (renderer) {
            splineLayer.renderer = jsonUtils.fromJSON(renderer.toJSON());
          }
          splineLayer.spatialReference = layer.spatialReference;
        })
        .then(this.refreshSplines);
  }

  private refreshSplines = (): IPromise => {
    const splineLayer = this.splineLayer;

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
            splineGraphic.attributes[this.splineLayer.objectIdField] = existingObjectIds.get(lineObjectId);
            existingObjectIds.delete(lineObjectId);
            updateFeatures.push(splineGraphic);
          } else {
            splineGraphic.attributes[this.splineLayer.objectIdField] = null;
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
            const splineObjectId = splineGraphic.attributes[this.splineLayer.objectIdField];
            this.existingObjectIds.set(lineObjectId, splineObjectId);
          });
          return results;
        });
      });
  }

}

export = SplineLayerProxy;
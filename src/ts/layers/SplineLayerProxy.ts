import Accessor = require("esri/core/Accessor");
import { declared, property, subclass } from "esri/core/accessorSupport/decorators";
import * as promiseUtils from "esri/core/promiseUtils";
import { Polyline } from "esri/geometry";
import * as SpatialReference from "esri/geometry/SpatialReference";
import * as Graphic from "esri/Graphic";
import * as FeatureLayer from "esri/layers/FeatureLayer";
import * as GeoJSONLayer from "esri/layers/GeoJSONLayer";
import * as jsonUtils from "esri/renderers/support/jsonUtils";
import * as FeatureSet from "esri/tasks/support/FeatureSet";

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
        type: "integer"
      }],
    geometryType: "polyline",
    objectIdField: "OBJECTID",
    outFields: ["*"],
    source: [],
    spatialReference: SpatialReference.WebMercator
  });

  private existingObjectIds: string[] = [];

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

    const splineGraphic = new Graphic({
      attributes: graphic.attributes,
      geometry: splineGeometry,
    });
    splineGraphic.attributes[LINE_OBJECT_ID_FIELD] = graphic.attributes[this.lineLayer.objectIdField];
    return splineGraphic;
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
        const oldObjectIds = this.existingObjectIds;

        const objectIds: string[] = [];
        const updateFeatures: Graphic[] = [];
        const addFeatures: Graphic[] = [];
        splineGraphics.forEach((splineGraphic) => {
          const objectId = splineGraphic.attributes[LINE_OBJECT_ID_FIELD];
          objectIds.push(objectId);
          if (0 <= oldObjectIds.indexOf(objectId)) {
            updateFeatures.push(splineGraphic);
          } else {
            addFeatures.push(splineGraphic);
          }
        });

        const deleteFeatures = oldObjectIds
          .filter(objectId => {
            return objectIds.indexOf(objectId) < 0;
          })
          .map((objectId) => {
            return { objectId };
          });

        this.existingObjectIds = objectIds;
        return splineLayer.applyEdits({
          addFeatures,
          deleteFeatures,
          updateFeatures,
        });
      }).then(console.log).catch(console.error);
  }

}

export = SplineLayerProxy;
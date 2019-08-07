import Accessor = require("esri/core/Accessor");
import { declared, property, subclass } from "esri/core/accessorSupport/decorators";
import * as promiseUtils from "esri/core/promiseUtils";
import { Polyline } from "esri/geometry";
import * as SpatialReference from "esri/geometry/SpatialReference";
import * as Graphic from "esri/Graphic";
import * as FeatureLayer from "esri/layers/FeatureLayer";
import * as GeoJSONLayer from "esri/layers/GeoJSONLayer";
import Renderer = require("esri/renderers/Renderer");
import * as FeatureSet from "esri/tasks/support/FeatureSet";

import Spline from "./../geometry/Spline";

export type SourceLayer = FeatureLayer | GeoJSONLayer;

@subclass("polyspline.layers.SplineLayerProxy")
export default class SplineLayerProxy extends declared(Accessor) {

  @property()
  get sourceLayer(): SourceLayer {
    return this._get<SourceLayer>("sourceLayer");
  }
  set sourceLayer(layer: SourceLayer) {
    if (layer) {
      const refresh = promiseUtils.debounce(this.refreshSplines);
      if (layer.type === "feature") {
        layer.on("edits" as any, refresh);
      }
    }

    this._set("sourceLayer", layer);
  }

  @property({ readOnly: true })
  public tourLayer = new FeatureLayer({
    geometryType: "polyline",
    objectIdField: "OBJECTID",
    source: [],
    spatialReference: SpatialReference.WebMercator
  });

  private existingObjectIds: string[] = [];

  public getSourceGraphic(graphic: Graphic): IPromise<FeatureSet> {
    const layer = this.sourceLayer;
    if (!layer) {
      return promiseUtils.reject("No source layer assigned");
    }

    return layer
      .queryFeatures({
        objectIds: [graphic.attributes[layer.objectIdField]],
        returnGeometry: true,
      });
  }

  private createSpline = (graphic: Graphic): Graphic => {
    const geometry = graphic.geometry as Polyline;
    let paths = [];
    const spatialReference = this.sourceLayer.spatialReference;

    if (
      geometry.paths.length &&
      2 < geometry.paths[0].length
    ) {
      const spline = new Spline(geometry);

      const count = 10000;
      const path = [];
      for (let i = 0; i <= count; i++) {
        path.push(spline.interpolate(i * 1.0 / count));
      }
      paths.push(path);
    } else {
      paths = geometry.paths;
    }

    return new Graphic({
      attributes: graphic.attributes,
      geometry: new Polyline({
        paths,
        spatialReference,
      })
    });
  }

  private refreshSplines = (): IPromise => {
    const tourLayer = this.tourLayer;
    const sourceLayer = this.sourceLayer;

    return sourceLayer
        .load()
        .then((): IPromise<FeatureSet> => {
          if (sourceLayer.geometryType !== "polyline") {
            throw new Error(
              "Feature layer must have geometryType 'polyline'"
            );
          }

          const renderer = sourceLayer.renderer;
          if (renderer) {
            this.tourLayer.renderer = Renderer.fromJSON(renderer.toJSON());
          }
          this.tourLayer.spatialReference = sourceLayer.spatialReference;

          return sourceLayer.queryFeatures();
        })
        .then((response) => {
          const graphics = response.features;
          return graphics
            .map(this.createSpline)
            .filter((spline) => !!spline);
        })
        .then((splineGraphics) => {
          const objectIdField = this.sourceLayer.objectIdField;
          const oldObjectIds = this.existingObjectIds;

          const objectIds: string[] = [];
          const updateFeatures: Graphic[] = [];
          const addFeatures: Graphic[] = [];
          splineGraphics.forEach((graphic) => {
            const objectId = graphic.attributes[objectIdField];
            objectIds.push(objectId);
            if (0 <= oldObjectIds.indexOf(objectId)) {
              updateFeatures.push(graphic);
            } else {
              addFeatures.push(graphic);
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
          return this.tourLayer.applyEdits({
            addFeatures,
            deleteFeatures,
            updateFeatures,
          });
        });
  }

}
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
define(["require", "exports", "esri/core/Accessor", "esri/core/accessorSupport/decorators", "esri/core/promiseUtils", "esri/geometry", "esri/geometry/SpatialReference", "esri/Graphic", "esri/layers/FeatureLayer", "esri/renderers/support/jsonUtils", "./../geometry/Spline"], function (require, exports, Accessor, decorators_1, promiseUtils, geometry_1, SpatialReference, Graphic, FeatureLayer, jsonUtils, Spline) {
    "use strict";
    var LINE_OBJECT_ID_FIELD = "_line_objectid";
    var SplineLayerProxy = /** @class */ (function (_super) {
        __extends(SplineLayerProxy, _super);
        function SplineLayerProxy() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.splineLayer = new FeatureLayer({
                fields: [
                    {
                        name: "OBJECTID",
                        type: "oid"
                    },
                    {
                        name: LINE_OBJECT_ID_FIELD,
                        type: "long"
                    }
                ],
                geometryType: "polyline",
                objectIdField: "OBJECTID",
                outFields: ["*"],
                source: [],
                spatialReference: SpatialReference.WebMercator
            });
            _this.existingObjectIds = new Map();
            _this.createSplineGraphic = function (graphic) {
                var geometry = graphic.geometry;
                var splineGeometry;
                var spatialReference = _this.lineLayer.spatialReference;
                if (geometry.paths.length &&
                    2 < geometry.paths[0].length) {
                    var spline = new Spline(geometry);
                    splineGeometry = spline.createPolyline();
                }
                else {
                    splineGeometry = new geometry_1.Polyline({
                        paths: geometry.paths,
                        spatialReference: spatialReference,
                    });
                }
                return new Graphic({
                    attributes: graphic.attributes,
                    geometry: splineGeometry,
                });
            };
            _this.initializeSplineLayer = function () {
                var splineLayer = _this.splineLayer;
                return _this.lineLayer
                    .load()
                    .then(function (layer) {
                    if (layer.geometryType !== "polyline") {
                        throw new Error("Feature layer must have geometryType 'polyline'");
                    }
                    var renderer = layer.renderer;
                    if (renderer) {
                        splineLayer.renderer = jsonUtils.fromJSON(renderer.toJSON());
                    }
                    splineLayer.spatialReference = layer.spatialReference;
                })
                    .then(_this.refreshSplines);
            };
            _this.refreshSplines = function () {
                var splineLayer = _this.splineLayer;
                return _this.lineLayer.queryFeatures()
                    .then(function (response) { return response.features.map(_this.createSplineGraphic); })
                    .then(function (splineGraphics) {
                    var existingObjectIds = _this.existingObjectIds;
                    var updateFeatures = [];
                    var addFeatures = [];
                    splineGraphics.forEach(function (splineGraphic) {
                        var lineObjectId = splineGraphic.attributes[_this.lineLayer.objectIdField];
                        splineGraphic.attributes[LINE_OBJECT_ID_FIELD] = lineObjectId;
                        if (existingObjectIds.has(lineObjectId)) {
                            splineGraphic.attributes[_this.splineLayer.objectIdField] = existingObjectIds.get(lineObjectId);
                            existingObjectIds.delete(lineObjectId);
                            updateFeatures.push(splineGraphic);
                        }
                        else {
                            splineGraphic.attributes[_this.splineLayer.objectIdField] = null;
                            addFeatures.push(splineGraphic);
                        }
                    });
                    var deleteFeatures = Array.from(existingObjectIds.values())
                        .map(function (objectId) {
                        return { objectId: objectId };
                    });
                    var edits = {
                        addFeatures: addFeatures,
                        deleteFeatures: deleteFeatures,
                        updateFeatures: updateFeatures,
                    };
                    return splineLayer.applyEdits(edits).then(function (results) {
                        _this.existingObjectIds.clear();
                        splineGraphics.forEach(function (splineGraphic) {
                            var lineObjectId = splineGraphic.attributes[LINE_OBJECT_ID_FIELD];
                            var splineObjectId = splineGraphic.attributes[_this.splineLayer.objectIdField];
                            _this.existingObjectIds.set(lineObjectId, splineObjectId);
                        });
                        return results;
                    });
                });
            };
            return _this;
        }
        Object.defineProperty(SplineLayerProxy.prototype, "lineLayer", {
            get: function () {
                return this._get("lineLayer");
            },
            set: function (layer) {
                if (layer) {
                    var refresh = promiseUtils.debounce(this.refreshSplines);
                    if (layer.type === "feature") {
                        layer.on("edits", refresh);
                    }
                    this._set("lineLayer", layer);
                    this.initializeSplineLayer();
                }
                else {
                    this._set("lineLayer", null);
                }
            },
            enumerable: true,
            configurable: true
        });
        SplineLayerProxy.prototype.getLineGraphic = function (splineGraphic) {
            var layer = this.lineLayer;
            if (!layer) {
                return promiseUtils.reject("No source layer assigned");
            }
            var objectId = splineGraphic.attributes[LINE_OBJECT_ID_FIELD];
            return layer
                .queryFeatures({
                objectIds: [objectId],
                outFields: ["*"],
                returnGeometry: true,
            })
                .then(function (featureSet) {
                if (featureSet.features.length) {
                    return featureSet.features[0];
                }
                throw new Error("No such graphic with objectId `{objectId}`");
            });
        };
        __decorate([
            decorators_1.property()
        ], SplineLayerProxy.prototype, "lineLayer", null);
        __decorate([
            decorators_1.property({ readOnly: true })
        ], SplineLayerProxy.prototype, "splineLayer", void 0);
        SplineLayerProxy = __decorate([
            decorators_1.subclass("polyspline.layers.SplineLayerProxy")
        ], SplineLayerProxy);
        return SplineLayerProxy;
    }(decorators_1.declared(Accessor)));
    return SplineLayerProxy;
});

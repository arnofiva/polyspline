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
define(["require", "exports", "esri/core/Accessor", "esri/core/accessorSupport/decorators", "esri/core/promiseUtils", "esri/geometry", "esri/Graphic", "esri/layers/FeatureLayer", "esri/layers/support/Field", "esri/renderers/support/jsonUtils", "./../geometry/Spline"], function (require, exports, Accessor, decorators_1, promiseUtils, geometry_1, Graphic, FeatureLayer, Field, jsonUtils, Spline) {
    "use strict";
    var LINE_OBJECT_ID_FIELD = "_line_objectid";
    var createSplineLayer = function (layer) {
        var renderer = layer.renderer;
        if (renderer) {
            renderer = jsonUtils.fromJSON(renderer.toJSON());
        }
        var elevationInfo = layer.elevationInfo;
        // Try to invoke internal clone()
        if (elevationInfo && typeof elevationInfo.clone === "function") {
            elevationInfo = elevationInfo.clone();
        }
        var fields = [
            new Field({
                name: "OBJECTID",
                type: "oid"
            }),
            new Field({
                name: LINE_OBJECT_ID_FIELD,
                type: "long"
            })
        ];
        layer.fields.forEach(function (field) {
            if (field.type !== "oid" && field.name !== "OBJECTID" && field.name !== LINE_OBJECT_ID_FIELD) {
                fields.push(field);
            }
        });
        return new FeatureLayer({
            elevationInfo: elevationInfo,
            fields: fields,
            geometryType: "polyline",
            labelingInfo: layer.labelingInfo ? layer.labelingInfo.map(function (info) { return info.clone(); }) : undefined,
            labelsVisible: layer.labelsVisible,
            legendEnabled: layer.legendEnabled,
            listMode: layer.listMode,
            maxScale: layer.maxScale,
            minScale: layer.maxScale,
            objectIdField: "OBJECTID",
            opacity: layer.opacity,
            outFields: ["*"],
            popupEnabled: layer.popupEnabled,
            popupTemplate: layer.popupTemplate ? layer.popupTemplate.clone() : undefined,
            renderer: renderer,
            source: [],
            spatialReference: layer.spatialReference,
            title: layer.title,
        });
    };
    var SplineLayerProxy = /** @class */ (function (_super) {
        __extends(SplineLayerProxy, _super);
        function SplineLayerProxy() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.resolveSplineLayer = null;
            _this.rejectSplineLayer = null;
            _this.splineLayerPromise = promiseUtils.create(function (resolve, reject) {
                _this.resolveSplineLayer = resolve;
                _this.rejectSplineLayer = reject;
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
                var refreshDebounced = promiseUtils.debounce(_this.refresh);
                return _this.lineLayer
                    .load()
                    .then(function (layer) {
                    layer.on("edits", refreshDebounced);
                    if (layer.geometryType !== "polyline") {
                        var error = new Error("`lineLayer` must have `geometryType` \"polyline\"");
                        _this.rejectSplineLayer(error);
                        throw error;
                    }
                    var splineLayer = createSplineLayer(layer);
                    _this.resolveSplineLayer(splineLayer);
                    return refreshDebounced();
                });
            };
            _this.refresh = function () {
                return _this.whenSplineLayer().then(function (splineLayer) { return _this.refreshSplineLayer(splineLayer); });
            };
            _this.refreshSplineLayer = function (splineLayer) {
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
                            splineGraphic.attributes[splineLayer.objectIdField] = existingObjectIds.get(lineObjectId);
                            existingObjectIds.delete(lineObjectId);
                            updateFeatures.push(splineGraphic);
                        }
                        else {
                            splineGraphic.attributes[splineLayer.objectIdField] = null;
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
                            var splineObjectId = splineGraphic.attributes[splineLayer.objectIdField];
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
                var oldLayer = this._get("lineLayer");
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
        SplineLayerProxy.prototype.whenSplineLayer = function () {
            return this.splineLayerPromise;
        };
        __decorate([
            decorators_1.property()
        ], SplineLayerProxy.prototype, "lineLayer", null);
        SplineLayerProxy = __decorate([
            decorators_1.subclass("polyspline.layers.SplineLayerProxy")
        ], SplineLayerProxy);
        return SplineLayerProxy;
    }(decorators_1.declared(Accessor)));
    return SplineLayerProxy;
});

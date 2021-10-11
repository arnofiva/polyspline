# PolySpline

[ArcGIS API for JavaScript](https://js.arcgis.com/) extension that creates splines from polylines.

A live demo is available here: https://arnofiva.github.io/polyspline

[![screenshot](./demo/screenshot.png)](https://arnofiva.github.io/polyspline)

The live demo shows one of the long roundtrip cruise of the [ZSG, Zürichsee Schifffahrtsgesellschaft](https://www.zsg.ch/en/timetable-prices/round-trips-scheduled-cruises/dep-zurich).

## Usage

To use the library you must first tell Dojo to load it and import the `SplineLayerProxy` class using `require`:

```
<script type="text/javascript">
  var dojoConfig = {
    packages: [{
      name: "polyspline",
      location: "https://arnofiva.github.io/polyspline/lib/",
    }]
  };
</script>
<script src="https://js.arcgis.com/4.12/"></script>

<script>

require([
  "esri/Map",
  "esri/views/SceneView",

  "polyspline/layers/SplineLayerProxy",
], function(
  Map,
  SceneView,

  SplineLayerProxy,
) {

  // Your source code goes here

}
</script>
```

Pass a [`FeatureLayer`](https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-FeatureLayer.html) or [`GeoJSONLayer`](https://developers.arcgis.com/javascript/latest/api-reference/esri-layers-GeoJSONLayer.html) with polyline geometries to SplineLayerProxy and it will create a new layer where all features are rendered as smooth lines.

```
var route = new GeoJSONLayer({
  url: "./cruise.geojson",
});

var splineProxy = new SplineLayerProxy({
  lineLayer: route,
});

splineProxy.whenSplineLayer().then(function(smoothRoute) {
  map.add(smoothRoute);
});

```

## Licensing

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license is available in the repository's [LICENSE](./LICENSE) file.

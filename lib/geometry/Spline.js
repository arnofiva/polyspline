define(["require", "exports", "esri/geometry", "esri/geometry/geometryEngine", "esri/geometry/Point"], function (require, exports, geometry_1, geometryEngine, Point) {
    "use strict";
    var Spline = /** @class */ (function () {
        function Spline(polyline) {
            var _this = this;
            this.xs = [];
            this.dxs = [];
            this.points = [];
            this.tangents = [];
            this.tangentDistances = [];
            this.interpolate = function (x) {
                var xs = _this.xs;
                var length = xs.length;
                var start = length ? xs[0] : 0;
                var end = length ? xs[length - 1] : 0;
                var xAbs = start + (end - start) * x;
                return _this.interpolateAbsolute(xAbs);
            };
            this.createPolyline = function (count) {
                if (count === void 0) { count = 50; }
                var spatialReference = _this.spatialReference;
                var path = [];
                var xs = _this.xs;
                var length = _this.xs.length;
                path.push(_this.interpolateAbsolute(length ? xs[0] : 0));
                for (var i = 1; i < _this.xs.length; i++) {
                    for (var j = 1; j <= count; j++) {
                        var xAbs = xs[i - 1] + (xs[i] - xs[i - 1]) * (j * 1.0 / count);
                        path.push(_this.interpolateAbsolute(xAbs));
                    }
                }
                return new geometry_1.Polyline({
                    paths: [path],
                    spatialReference: spatialReference,
                });
            };
            this.interpolateAbsolute = function (xAbs) {
                var i = 0;
                var xs = _this.xs;
                while (i < xs.length - 1 && xAbs > xs[i + 1]) {
                    i++;
                }
                var dx = _this.dxs[i];
                var p1 = _this.points[i];
                var p2 = _this.points[i + 1];
                var t1 = _this.tangents[i];
                var t2 = _this.tangents[i + 1];
                var s = (xAbs - xs[i]) / dx;
                var a = 0.9;
                var ta1 = dx / _this.tangentDistances[i] * a;
                var ta2 = dx / _this.tangentDistances[i + 1] * a;
                return _this.splinePoint(s, p1, p2, t1, t2, ta1, ta2);
            };
            this.newPoint = function (coords) {
                var x = coords[0];
                var y = coords[1];
                var z = coords[2];
                return new Point({
                    spatialReference: _this.spatialReference,
                    x: x,
                    y: y,
                    z: z
                });
            };
            var coordinates = polyline.paths.length ? polyline.paths[0] : [];
            this.spatialReference = polyline.spatialReference;
            // Compute distances between given coordinates
            var prevPoint = null;
            coordinates.forEach(function (coords, index) {
                _this.points.push([].concat(coords));
                var point = _this.newPoint(coords);
                if (index === 0) {
                    _this.xs.push(0);
                }
                else {
                    var distance = geometryEngine.distance(prevPoint, point, "meters");
                    _this.dxs.push(distance);
                    _this.xs.push(distance + _this.xs[index - 1]);
                }
                prevPoint = point;
            });
            // Compute tangents for each point
            this.points.forEach(function (point, index, values) {
                var prevIndex = index === 0 ? 0 : index - 1;
                var nextIndex = index === values.length - 1 ? index : index + 1;
                var tangent = point.map(function (value, i) { return values[nextIndex][i] - values[prevIndex][i]; });
                _this.tangents.push(tangent);
                var p1 = _this.newPoint(values[prevIndex]);
                var p2 = _this.newPoint(values[nextIndex]);
                _this.tangentDistances.push(geometryEngine.distance(p1, p2, "meters"));
            });
        }
        // Spline basis function
        // https://www.cubic.org/docs/hermite.htm
        Spline.prototype.splinePoint = function (s, p1, p2, t1, t2, ta1, ta2) {
            // calculate basis functions
            var s2 = Math.pow(s, 2);
            var s3 = Math.pow(s, 3);
            var h1 = 2 * s3 - 3 * s2 + 1; // calculate basis function 1
            var h2 = -2 * s3 + 3 * s2; // calculate basis function 2
            var h3 = s3 - 2 * s2 + s; // calculate basis function 3
            var h4 = s3 - s2; // calculate basis function 4
            // calculate new point
            var p = [];
            for (var i = 0; i < p1.length; i++) {
                p.push(h1 * p1[i] + h2 * p2[i] + h3 * t1[i] * ta1 + h4 * t2[i] * ta2);
            }
            return p;
        };
        return Spline;
    }());
    return Spline;
});

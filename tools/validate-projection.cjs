// Validates the browser Robinson projection against coordinates generated
// by the same Basemap/PROJ Robinson projection used for detailed-world-map.svg.
const cases = [
  { name: "London", latitude: 51.5074, longitude: -0.1278, expectedX: 49.9695244194, expectedY: 18.2188589365 },
  { name: "New York", latitude: 40.7128, longitude: -74.0060, expectedX: 31.1240604102, expectedY: 24.7711889065 },
  { name: "Stockholm", latitude: 59.3293, longitude: 18.0686, expectedX: 54.0334913957, expectedY: 13.6516488192 },
  { name: "Cairo", latitude: 30.0444, longitude: 31.2357, expectedX: 58.3283489465, expectedY: 31.3724579293 },
  { name: "Tokyo", latitude: 35.6762, longitude: 139.6503, expectedX: 86.4673667210, expectedY: 27.8811666730 },
  { name: "Sydney", latitude: -33.8688, longitude: 151.2093, expectedX: 89.7741168405, expectedY: 70.9990571512 }
];

const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(require("path").join(__dirname, "../js/offline-world-map.js"), "utf8")
  .replace(/export class DetailedWorldMap[\s\S]*/, "");
const context = {};
vm.createContext(context);
vm.runInContext(source + "\nthis.projectRobinson = projectRobinson;", context);

let failed = false;
for (const test of cases) {
  const actual = context.projectRobinson(test.latitude, test.longitude);
  const errorX = Math.abs(actual.x - test.expectedX);
  const errorY = Math.abs(actual.y - test.expectedY);
  const passed = errorX < 0.001 && errorY < 0.001;
  console.log(`${passed ? "PASS" : "FAIL"} ${test.name}: x=${actual.x.toFixed(6)}, y=${actual.y.toFixed(6)}`);
  if (!passed) failed = true;
}
process.exitCode = failed ? 1 : 0;

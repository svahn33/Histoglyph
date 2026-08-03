export const MAP_CENTRAL_MERIDIAN = 11.25;

const ROBINSON_X = [
  1.0000, 0.9986, 0.9954, 0.9900, 0.9822,
  0.9730, 0.9600, 0.9427, 0.9216, 0.8962,
  0.8679, 0.8350, 0.7986, 0.7597, 0.7186,
  0.6732, 0.6213, 0.5722, 0.5322
];

const ROBINSON_Y = [
  0.0000, 0.0620, 0.1240, 0.1860, 0.2480,
  0.3100, 0.3720, 0.4340, 0.4958, 0.5571,
  0.6176, 0.6769, 0.7346, 0.7903, 0.8435,
  0.8936, 0.9394, 0.9761, 1.0000
];

function interpolate(values, absoluteLatitude) {
  if (absoluteLatitude >= 90) {
    return values[values.length - 1];
  }

  const lowerIndex = Math.floor(
    absoluteLatitude / 5
  );
  const upperIndex = lowerIndex + 1;
  const fraction =
    (absoluteLatitude - lowerIndex * 5) / 5;

  return (
    values[lowerIndex] +
    (values[upperIndex] - values[lowerIndex]) *
      fraction
  );
}

function wrapLongitude(longitude) {
  return (
    ((longitude + 180) % 360 + 360) % 360 -
    180
  );
}

export function calculateApproximateMapPosition(
  latitude,
  longitude
) {
  const safeLatitude = Math.max(
    -90,
    Math.min(90, Number(latitude))
  );

  const longitudeFromCentre = wrapLongitude(
    Number(longitude) - MAP_CENTRAL_MERIDIAN
  );

  const absoluteLatitude = Math.abs(safeLatitude);
  const xScale = interpolate(
    ROBINSON_X,
    absoluteLatitude
  );
  const yScale = interpolate(
    ROBINSON_Y,
    absoluteLatitude
  );

  const x =
    50 +
    (longitudeFromCentre / 180) *
      50 *
      xScale;

  const latitudeSign =
    safeLatitude === 0 ? 0 : Math.sign(safeLatitude);

  const y =
    50 -
    latitudeSign *
      50 *
      yScale;

  return { x, y };
}

export function getStoredOrCalculatedPosition(place) {
  const mapX = Number(place?.mapX);
  const mapY = Number(place?.mapY);

  if (
    Number.isFinite(mapX) &&
    Number.isFinite(mapY)
  ) {
    return {
      x: mapX,
      y: mapY,
      source: "stored"
    };
  }

  const approximate =
    calculateApproximateMapPosition(
      place?.latitude,
      place?.longitude
    );

  return {
    ...approximate,
    source: "calculated"
  };
}

export function positionMarker(
  marker,
  position,
  offsetX = 0
) {
  marker.style.left =
    `${position.x + offsetX}%`;
  marker.style.top = `${position.y}%`;
}

function clamp(value, minimum, maximum) {
  return Math.max(
    minimum,
    Math.min(maximum, value)
  );
}

export function fitSceneToPositions(
  viewport,
  scene,
  positions,
  {
    minimumZoom = 1,
    maximumZoom = 1.75
  } = {}
) {
  const validPositions = positions.filter(Boolean);

  if (validPositions.length === 0) {
    scene.style.transform =
      "translate3d(0, 0, 0) scale(1)";
    return;
  }

  const width = viewport.clientWidth;
  const height = viewport.clientHeight;

  if (width <= 0 || height <= 0) {
    return;
  }

  const pixelPositions = validPositions.map(
    position => ({
      x: position.x / 100 * width,
      y: position.y / 100 * height
    })
  );

  const xs = pixelPositions.map(point => point.x);
  const ys = pixelPositions.map(point => point.y);

  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);

  const spanX = maximumX - minimumX;
  const spanY = maximumY - minimumY;

  const minimumVisibleWidth = width * 0.57;
  const minimumVisibleHeight = height * 0.57;

  const requiredWidth = Math.max(
    spanX + width * 0.24,
    minimumVisibleWidth
  );

  const requiredHeight = Math.max(
    spanY + height * 0.28,
    minimumVisibleHeight
  );

  const zoom = clamp(
    Math.min(
      width / requiredWidth,
      height / requiredHeight
    ),
    minimumZoom,
    maximumZoom
  );

  const centreX = (minimumX + maximumX) / 2;
  const centreY = (minimumY + maximumY) / 2;

  let translateX =
    width / 2 - centreX * zoom;
  let translateY =
    height / 2 - centreY * zoom;

  translateX = clamp(
    translateX,
    width - width * zoom,
    0
  );

  translateY = clamp(
    translateY,
    height - height * zoom,
    0
  );

  scene.style.transform =
    `translate3d(${translateX}px, ${translateY}px, 0) scale(${zoom})`;
}

export function distanceBetweenMapPositions(
  first,
  second
) {
  return Math.hypot(
    Number(first.x) - Number(second.x),
    Number(first.y) - Number(second.y)
  );
}

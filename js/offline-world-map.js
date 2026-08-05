const ROBINSON_X_COEFFICIENTS = [
  [1.0, 2.2199e-17, -7.15515e-05, 3.1103e-06],
  [0.9986, -0.000482243, -2.4897e-05, -1.3309e-06],
  [0.9954, -0.00083103, -4.48605e-05, -9.86701e-07],
  [0.99, -0.00135364, -5.9661e-05, 3.6777e-06],
  [0.9822, -0.00167442, -4.49547e-06, -5.72411e-06],
  [0.973, -0.00214868, -9.03571e-05, 1.8736e-08],
  [0.96, -0.00305085, -9.00761e-05, 1.64917e-06],
  [0.9427, -0.00382792, -6.53386e-05, -2.6154e-06],
  [0.9216, -0.00467746, -0.00010457, 4.81243e-06],
  [0.8962, -0.00536223, -3.23831e-05, -5.43432e-06],
  [0.8679, -0.00609363, -0.000113898, 3.32484e-06],
  [0.835, -0.00698325, -6.40253e-05, 9.34959e-07],
  [0.7986, -0.00755338, -5.00009e-05, 9.35324e-07],
  [0.7597, -0.00798324, -3.5971e-05, -2.27626e-06],
  [0.7186, -0.00851367, -7.01149e-05, -8.6303e-06],
  [0.6732, -0.00986209, -0.000199569, 1.91974e-05],
  [0.6213, -0.010418, 8.83923e-05, 6.24051e-06],
  [0.5722, -0.00906601, 0.000182, 6.24051e-06]
];

const ROBINSON_Y_COEFFICIENTS = [
  [-5.20417e-18, 0.0124, 1.21431e-18, -8.45284e-11],
  [0.062, 0.0124, -1.26793e-09, 4.22642e-10],
  [0.124, 0.0124, 5.07171e-09, -1.60604e-09],
  [0.186, 0.0123999, -1.90189e-08, 6.00152e-09],
  [0.248, 0.0124002, 7.10039e-08, -2.24e-08],
  [0.31, 0.0123992, -2.64997e-07, 8.35986e-08],
  [0.372, 0.0124029, 9.88983e-07, -3.11994e-07],
  [0.434, 0.0123893, -3.69093e-06, -4.35621e-07],
  [0.4958, 0.0123198, -1.02252e-05, -3.45523e-07],
  [0.5571, 0.0121916, -1.54081e-05, -5.82288e-07],
  [0.6176, 0.0119938, -2.41424e-05, -5.25327e-07],
  [0.6769, 0.011713, -3.20223e-05, -5.16405e-07],
  [0.7346, 0.0113541, -3.97684e-05, -6.09052e-07],
  [0.7903, 0.0109107, -4.89042e-05, -1.04739e-06],
  [0.8435, 0.0103431, -6.4615e-05, -1.40374e-09],
  [0.8936, 0.00969686, -6.4636e-05, -8.547e-06],
  [0.9394, 0.00840947, -0.000192841, -4.2106e-06],
  [0.9761, 0.00616527, -0.000256, -4.2106e-06]
];

const ROBINSON_VIEWBOX_WIDTH = 1419.6;
const ROBINSON_VIEWBOX_HEIGHT = 719.98;

const REGION_BOXES = {
  world: { x: 0, y: 0, width: 100, height: 100, maxZoom: 1 },
  northAmerica: { x: 1.5, y: 4, width: 41, height: 52, maxZoom: 2.5 },
  southAmerica: { x: 26, y: 43, width: 27, height: 52, maxZoom: 2.7 },
  europe: { x: 42, y: 12, width: 20, height: 34, maxZoom: 4.1 },
  africa: { x: 41, y: 36, width: 26, height: 48, maxZoom: 2.9 },
  asia: { x: 55, y: 5, width: 44, height: 61, maxZoom: 2.25 },
  oceania: { x: 70, y: 54, width: 29, height: 42, maxZoom: 2.8 }
};

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normaliseLongitude(longitude) {
  let value = Number(longitude);
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function evaluateRobinsonPolynomial(coefficients, z) {
  return coefficients[0] + z * (
    coefficients[1] + z * (coefficients[2] + z * coefficients[3])
  );
}

function getRobinsonFactors(absoluteLatitude) {
  const latitude = clamp(Number(absoluteLatitude), 0, 90);
  const interval = Math.min(17, Math.floor(latitude / 5));
  const intervalLatitude = latitude - interval * 5;

  return {
    x: evaluateRobinsonPolynomial(
      ROBINSON_X_COEFFICIENTS[interval],
      intervalLatitude
    ),
    y: evaluateRobinsonPolynomial(
      ROBINSON_Y_COEFFICIENTS[interval],
      intervalLatitude
    )
  };
}

function projectRobinson(latitude, longitude) {
  const lat = clamp(Number(latitude), -90, 90);
  const lon = normaliseLongitude(longitude);
  const factors = getRobinsonFactors(Math.abs(lat));
  const sign = lat === 0 ? 0 : Math.sign(lat);

  return {
    x: 50 + (lon / 180) * 50 * factors.x,
    y: 50 - sign * 50 * factors.y
  };
}

function invertRobinson(x, y) {
  const normalisedX = clamp(Number(x), 0, 100);
  const normalisedY = clamp(Number(y), 0, 100);
  const targetY = Math.abs((50 - normalisedY) / 50);
  let low = 0;
  let high = 90;

  for (let iteration = 0; iteration < 45; iteration += 1) {
    const middle = (low + high) / 2;
    if (getRobinsonFactors(middle).y < targetY) low = middle;
    else high = middle;
  }

  const absoluteLatitude = (low + high) / 2;
  const latitude = normalisedY < 50
    ? absoluteLatitude
    : normalisedY > 50
      ? -absoluteLatitude
      : 0;
  const xFactor = getRobinsonFactors(absoluteLatitude).x;
  const longitude = xFactor > 0
    ? clamp(((normalisedX - 50) / (50 * xFactor)) * 180, -180, 180)
    : 0;

  return { latitude, longitude };
}

function makeMarker(type) {
  if (type === 'admin') {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'offline-map-marker offline-map-marker--admin';
    marker.setAttribute('aria-label', 'Editable place');
    return marker;
  }

  const marker = document.createElement('div');
  marker.className = `offline-map-marker offline-map-marker--${type}`;
  const ariaLabels = {
    birth: 'Birthplace',
    death: 'Place of death',
    combined: 'Birthplace and place of death'
  };
  marker.setAttribute('aria-label', ariaLabels[type] || 'Historical location');

  const dot = document.createElement('span');
  dot.className = 'offline-map-marker-dot';

  const label = document.createElement('span');
  label.className = 'offline-map-marker-label';

  const year = document.createElement('span');
  year.className = 'offline-map-marker-year';

  const place = document.createElement('span');
  place.className = 'offline-map-marker-place';
  place.hidden = true;

  label.append(year, place);
  marker.append(dot, label);
  return marker;
}

export class DetailedWorldMap {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      editable: false,
      onLocationChange: null,
      ...options
    };

    this.scale = 1;
    this.centerX = 0.5;
    this.centerY = 0.5;
    this.minimumScale = 1;
    this.maximumScale = this.options.editable ? 10 : 7;
    this.markers = [];
    this.editableMarker = null;
    this.lastEditableLocation = null;
    this.pointerMode = null;
    this.pointerStart = null;
    this.didMove = false;
    this.activePointers = new Map();
    this.pinchStart = null;

    this.container.classList.add('offline-map');
    this.container.innerHTML = `
      <div class="offline-map-scene">
        <img class="offline-map-image" alt="Detailed vector world map with white land and grey ocean" draggable="false" decoding="sync">
        <div class="offline-map-marker-layer"></div>
      </div>
      <div class="offline-map-controls" aria-label="Map zoom controls">
        <button type="button" data-offline-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" data-offline-zoom="out" aria-label="Zoom out">−</button>
        <button type="button" data-offline-zoom="reset" aria-label="Show the whole world">⌂</button>
      </div>
    `;

    this.scene = this.container.querySelector('.offline-map-scene');
    this.image = this.container.querySelector('.offline-map-image');
    this.markerLayer = this.container.querySelector('.offline-map-marker-layer');

    const mapAssetUrl = new URL('assets/detailed-world-map.svg', document.baseURI).href;
    this.ready = new Promise((resolve, reject) => {
      const handleLoad = () => {
        if (this.image.naturalWidth > 0 && this.image.naturalHeight > 0) {
          this.container.classList.add('offline-map--ready');
          this.applyTransform();
          resolve();
        } else {
          reject(new Error('The local vector map loaded without dimensions.'));
        }
      };

      const handleError = () => {
        this.container.innerHTML = `
          <div class="map-load-error">
            <strong>The local map could not be loaded.</strong>
            <span>Keep the assets folder beside play.html and open the complete project folder.</span>
          </div>
        `;
        reject(new Error(`Could not load local map asset: ${mapAssetUrl}`));
      };

      this.image.addEventListener('load', handleLoad, { once: true });
      this.image.addEventListener('error', handleError, { once: true });
      this.image.src = mapAssetUrl;
    });

    this.setupInteractions();
    this.resizeObserver = new ResizeObserver(() => this.applyTransform());
    this.resizeObserver.observe(this.container);
    this.applyTransform();
  }

  setupInteractions() {
    this.container.querySelector('[data-offline-zoom="in"]').addEventListener('click', event => {
      event.stopPropagation();
      this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, this.scale * 1.35);
    });

    this.container.querySelector('[data-offline-zoom="out"]').addEventListener('click', event => {
      event.stopPropagation();
      this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, this.scale / 1.35);
    });

    this.container.querySelector('[data-offline-zoom="reset"]').addEventListener('click', event => {
      event.stopPropagation();
      this.zoomToRegion('world');
    });

    this.container.addEventListener('wheel', event => {
      event.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0013);
      this.zoomAt(event.clientX - rect.left, event.clientY - rect.top, this.scale * factor);
    }, { passive: false });

    this.container.addEventListener('pointerdown', event => {
      if (event.target.closest('.offline-map-controls') || event.target.closest('.offline-map-marker')) return;
      this.container.setPointerCapture(event.pointerId);
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.didMove = false;

      if (this.activePointers.size === 1) {
        this.pointerMode = 'pan';
        this.pointerStart = {
          x: event.clientX,
          y: event.clientY,
          centerX: this.centerX,
          centerY: this.centerY
        };
      } else if (this.activePointers.size === 2) {
        const points = [...this.activePointers.values()];
        this.pointerMode = 'pinch';
        this.pinchStart = {
          distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
          scale: this.scale,
          centerX: this.centerX,
          centerY: this.centerY,
          midpoint: {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2
          }
        };
      }
    });

    this.container.addEventListener('pointermove', event => {
      if (!this.activePointers.has(event.pointerId)) return;
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointerMode === 'pan' && this.activePointers.size === 1) {
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        if (Math.hypot(dx, dy) > 3) this.didMove = true;
        this.centerX = this.pointerStart.centerX - dx / (this.container.clientWidth * this.scale);
        this.centerY = this.pointerStart.centerY - dy / (this.container.clientHeight * this.scale);
        this.applyTransform();
      } else if (this.pointerMode === 'pinch' && this.activePointers.size >= 2) {
        const points = [...this.activePointers.values()].slice(0, 2);
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        const rect = this.container.getBoundingClientRect();
        const midpoint = {
          x: (points[0].x + points[1].x) / 2 - rect.left,
          y: (points[0].y + points[1].y) / 2 - rect.top
        };
        this.didMove = true;
        const nextScale = this.pinchStart.scale * (distance / Math.max(1, this.pinchStart.distance));
        this.zoomAt(midpoint.x, midpoint.y, nextScale);
      }
    });

    const finishPointer = event => {
      const wasMoved = this.didMove;
      this.activePointers.delete(event.pointerId);
      if (this.container.hasPointerCapture(event.pointerId)) this.container.releasePointerCapture(event.pointerId);
      if (this.activePointers.size === 0) {
        this.pointerMode = null;
        this.pointerStart = null;
        this.pinchStart = null;

        if (this.options.editable && !wasMoved && !event.target.closest('.offline-map-controls')) {
          const location = this.clientPointToLocation(event.clientX, event.clientY);
          if (location) this.setEditableLocation(location.latitude, location.longitude, true);
        }
      }
    };

    this.container.addEventListener('pointerup', finishPointer);
    this.container.addEventListener('pointercancel', finishPointer);
  }

  getTransformPixels() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    let translateX = width / 2 - this.centerX * width * this.scale;
    let translateY = height / 2 - this.centerY * height * this.scale;

    translateX = clamp(translateX, width - width * this.scale, 0);
    translateY = clamp(translateY, height - height * this.scale, 0);

    this.centerX = (width / 2 - translateX) / (width * this.scale);
    this.centerY = (height / 2 - translateY) / (height * this.scale);

    return { width, height, translateX, translateY };
  }

  applyTransform() {
    const { translateX, translateY } = this.getTransformPixels();
    this.scene.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${this.scale})`;
    const inverseScale = 1 / this.scale;
    this.markerLayer.querySelectorAll('.offline-map-marker').forEach(marker => {
      marker.style.setProperty('--marker-inverse-scale', inverseScale);
    });
  }

  zoomAt(pointerX, pointerY, requestedScale) {
    const { width, height, translateX, translateY } = this.getTransformPixels();
    const sceneX = (pointerX - translateX) / (width * this.scale);
    const sceneY = (pointerY - translateY) / (height * this.scale);
    const nextScale = clamp(requestedScale, this.minimumScale, this.maximumScale);
    const nextTranslateX = pointerX - sceneX * width * nextScale;
    const nextTranslateY = pointerY - sceneY * height * nextScale;

    this.scale = nextScale;
    this.centerX = (width / 2 - nextTranslateX) / (width * nextScale);
    this.centerY = (height / 2 - nextTranslateY) / (height * nextScale);
    this.applyTransform();
  }

  clientPointToLocation(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const { width, height, translateX, translateY } = this.getTransformPixels();
    const sceneX = (clientX - rect.left - translateX) / this.scale;
    const sceneY = (clientY - rect.top - translateY) / this.scale;
    const percentX = clamp(sceneX / width * 100, 0, 100);
    const percentY = clamp(sceneY / height * 100, 0, 100);
    return invertRobinson(percentX, percentY);
  }

  async resize() {
    await this.ready;
    this.applyTransform();
  }

  clearMarkers() {
    this.markers = [];
    this.markerLayer
      .querySelectorAll('.offline-map-marker--birth, .offline-map-marker--death, .offline-map-marker--combined')
      .forEach(marker => marker.remove());
  }

  async setGameLocations(locations) {
    await this.ready;
    this.clearMarkers();

    const valid = locations.filter(
      location =>
        Number.isFinite(Number(location.latitude)) &&
        Number.isFinite(Number(location.longitude))
    );

    const samePlace =
      valid.length === 2 &&
      Math.abs(Number(valid[0].latitude) - Number(valid[1].latitude)) < 0.00001 &&
      Math.abs(Number(valid[0].longitude) - Number(valid[1].longitude)) < 0.00001;

    const displayLocations = samePlace
      ? [
          {
            type: "combined",
            label: `${valid[0].label || "Birthplace"}; ${valid[1].label || "place of death"}`,
            year: [valid[0].year, valid[1].year].filter(Boolean).join("–"),
            placeName: valid[0].placeName || valid[1].placeName || "",
            latitude: Number(valid[0].latitude),
            longitude: Number(valid[0].longitude)
          }
        ]
      : valid;

    displayLocations.forEach(location => {
      const position = projectRobinson(location.latitude, location.longitude);
      const marker = makeMarker(location.type);
      marker.style.left = `${position.x}%`;
      marker.style.top = `${position.y}%`;
      marker.style.setProperty('--marker-inverse-scale', 1 / this.scale);
      marker.title = location.label || '';

      if (position.x > 76) {
        marker.classList.add('offline-map-marker--label-left');
      }

      const yearLabel = marker.querySelector('.offline-map-marker-year');
      if (yearLabel) yearLabel.textContent = location.year || '';

      const placeLabel = marker.querySelector('.offline-map-marker-place');
      if (placeLabel) {
        placeLabel.textContent = location.placeName || '';
        placeLabel.hidden = true;
      }

      this.markerLayer.append(marker);
      this.markers.push({ marker, location, position });
    });
  }

  setPlaceNamesVisible(visible) {
    this.markerLayer
      .querySelectorAll('.offline-map-marker-place')
      .forEach(label => {
        label.hidden = !visible || !label.textContent.trim();
      });
  }

  async fitToLocations(locations, animate = true) {
    await this.ready;
    const positions = locations
      .filter(location => Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)))
      .map(location => projectRobinson(location.latitude, location.longitude));

    if (positions.length === 0) {
      await this.zoomToRegion('world', animate);
      return;
    }

    const xs = positions.map(position => position.x);
    const ys = positions.map(position => position.y);
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    const minimumWidth = positions.length === 1 ? 24 : 34;
    const minimumHeight = positions.length === 1 ? 24 : 34;
    const spanX = Math.max(minimumWidth, maxX - minX + 14);
    const spanY = Math.max(minimumHeight, maxY - minY + 18);
    const centerX = (minX + maxX) / 2 / 100;
    const centerY = (minY + maxY) / 2 / 100;
    const targetScale = clamp(Math.min(88 / spanX, 88 / spanY), 1, 4.25);

    this.setView(centerX, centerY, targetScale, animate);
  }

  setView(centerX, centerY, scale, animate = true) {
    if (animate) this.scene.classList.add('offline-map-scene--animate');
    else this.scene.classList.remove('offline-map-scene--animate');

    this.centerX = clamp(centerX, 0, 1);
    this.centerY = clamp(centerY, 0, 1);
    this.scale = clamp(scale, this.minimumScale, this.maximumScale);
    this.applyTransform();

    if (animate) {
      window.setTimeout(() => this.scene.classList.remove('offline-map-scene--animate'), 700);
    }
  }

  async zoomToRegion(regionName = 'world', animate = true) {
    await this.ready;
    const box = REGION_BOXES[regionName] || REGION_BOXES.world;
    const centerX = (box.x + box.width / 2) / 100;
    const centerY = (box.y + box.height / 2) / 100;
    const scale = regionName === 'world'
      ? 1
      : clamp(Math.min(88 / box.width, 88 / box.height), 1, box.maxZoom);
    this.setView(centerX, centerY, scale, animate);
  }

  async setEditableLocation(latitude, longitude, notify = false) {
    await this.ready;
    const lat = clamp(Number(latitude), -90, 90);
    const lon = normaliseLongitude(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    this.lastEditableLocation = { latitude: lat, longitude: lon };
    const position = projectRobinson(lat, lon);

    if (!this.editableMarker) {
      this.editableMarker = makeMarker('admin');
      this.editableMarker.style.setProperty('--marker-inverse-scale', 1 / this.scale);
      this.markerLayer.append(this.editableMarker);

      this.editableMarker.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        this.editableMarker.setPointerCapture(event.pointerId);
        this.editableMarker.dataset.dragging = 'true';
      });

      this.editableMarker.addEventListener('pointermove', event => {
        if (this.editableMarker.dataset.dragging !== 'true') return;
        const location = this.clientPointToLocation(event.clientX, event.clientY);
        if (!location) return;
        this.setEditableLocation(location.latitude, location.longitude, true);
      });

      const stopDrag = event => {
        if (this.editableMarker.dataset.dragging !== 'true') return;
        this.editableMarker.dataset.dragging = 'false';
        if (this.editableMarker.hasPointerCapture(event.pointerId)) this.editableMarker.releasePointerCapture(event.pointerId);
      };

      this.editableMarker.addEventListener('pointerup', stopDrag);
      this.editableMarker.addEventListener('pointercancel', stopDrag);
    }

    this.editableMarker.style.left = `${position.x}%`;
    this.editableMarker.style.top = `${position.y}%`;
    this.editableMarker.style.setProperty('--marker-inverse-scale', 1 / this.scale);

    if (notify && typeof this.options.onLocationChange === 'function') {
      this.options.onLocationChange(this.lastEditableLocation);
    }
  }

  async focusEditableLocation(animate = true) {
    await this.ready;
    if (!this.lastEditableLocation) return;
    const position = projectRobinson(this.lastEditableLocation.latitude, this.lastEditableLocation.longitude);
    this.setView(position.x / 100, position.y / 100, 4.5, animate);
  }
}

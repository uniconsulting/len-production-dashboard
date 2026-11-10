// Continuous contour used by Mieru's BentoSurface and its Summary cards.
// A shape is dimensioned in CSS pixels so wide cards keep the same soft shoulders.
const REFERENCE_ASPECT = 392 / 318;
const MIN_SIDE_EXPONENT = 6.5;
const CORNER_SCALE_PX = 28;
const PATH_STEPS = 128;
const cache = new Map();

function bentoPath(width, height, profile) {
  const key = [width, height, profile].join(':');
  if (cache.has(key)) return cache.get(key);

  const tall = width / height < 0.7;
  const shapeWidth = tall ? height : width;
  const shapeHeight = tall ? width : height;
  const a = shapeWidth / 2;
  const b = shapeHeight / 2;
  const cornerScale = profile === 'rounded' ? 1.15 : 1;
  const ny = Math.max(MIN_SIDE_EXPONENT, shapeHeight / CORNER_SCALE_PX) / cornerScale;
  const nx = (ny * shapeWidth) / shapeHeight / REFERENCE_ASPECT;
  const bow = Math.min(
    profile === 'forecast' ? 0.25 : 0.75,
    Math.max(0, (shapeWidth / shapeHeight - 1.5) * 1.5),
  );
  const points = Array.from({ length: PATH_STEPS + 1 }, (_, i) => {
    const angle = (i * Math.PI * 2) / PATH_STEPS;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = Math.abs(cos) < 1e-10 ? 0 : Math.sign(cos) * Math.abs(cos) ** (2 / nx);
    const y = Math.abs(sin) < 1e-10 ? 0 : Math.sign(sin) * Math.abs(sin) ** (2 / ny);

    // Shared tangents keep neighbouring cubic segments smooth across axes.
    const dx = (-ny / b) * Math.sign(y) * Math.abs(y) ** (ny - 1);
    const sourceDy = (nx / a) * Math.sign(x) * Math.abs(x) ** (nx - 1);
    const dy = sourceDy * (1 - (bow / b) * x * x) - ((dx * 2 * bow) / a) * y * x;
    const length = Math.hypot(dx, dy);
    const point = {
      x: a * (1 + x),
      y: b + y * (b - bow * x * x),
      tx: dx / length,
      ty: dy / length,
    };
    return tall ? { x: point.y, y: point.x, tx: point.ty, ty: point.tx } : point;
  });
  const round = (v) => Number(v.toFixed(3));
  let path = 'M ' + round(points[0].x) + ' ' + round(points[0].y);
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    const handle = Math.hypot(q.x - p.x, q.y - p.y) / 3;
    const curve = [
      p.x + p.tx * handle,
      p.y + p.ty * handle,
      q.x - q.tx * handle,
      q.y - q.ty * handle,
      q.x,
      q.y,
    ];
    path += ' C ' + curve.map(round).join(' ');
  }
  const clip = 'path("' + path + ' Z")';
  if (cache.size >= 256) cache.delete(cache.keys().next().value);
  cache.set(key, clip);
  return clip;
}

const surfaceSelector = '.bento-card, .bento-contour';
let binding;

export function bindBento(root) {
  const host = root.closest('#app') || root;
  if (binding?.host === host) {
    binding.scan();
    return binding.dispose;
  }
  binding?.dispose();

  const attached = new Set();
  function measure(card) {
    const width = card.clientWidth;
    const height = card.clientHeight;
    if (!width || !height) return;
    const profile =
      card.dataset.bentoProfile || (card.matches('.hero-card, .mini-card') ? 'rounded' : 'default');
    const clip = bentoPath(width, height, profile);
    if (card.style.getPropertyValue('--bento-clip') !== clip) {
      card.style.setProperty('--bento-clip', clip);
    }
  }

  const resize = new ResizeObserver((entries) => {
    for (const { target } of entries) if (attached.has(target)) measure(target);
  });
  function scan() {
    for (const card of attached) {
      if (!host.contains(card)) {
        resize.unobserve(card);
        attached.delete(card);
      }
    }
    for (const card of host.querySelectorAll(surfaceSelector)) {
      if (!attached.has(card)) {
        attached.add(card);
        resize.observe(card);
        measure(card);
      }
    }
  }

  // Details replace their own subtree after filtering. Observing only childList prevents
  // clip writes from retriggering observation. The contour snaps to size without animation,
  // also when reduced motion is enabled. CSS applies it to the decorative surface only.
  const includesCard = (node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    (node.matches(surfaceSelector) || node.querySelector(surfaceSelector));
  const mutations = new MutationObserver((records) => {
    if (
      records.some(
        ({ addedNodes, removedNodes }) =>
          Array.from(addedNodes).some(includesCard) || Array.from(removedNodes).some(includesCard),
      )
    )
      scan();
  });
  mutations.observe(host, { childList: true, subtree: true });
  function dispose() {
    resize.disconnect();
    mutations.disconnect();
    for (const card of attached) card.style.removeProperty('--bento-clip');
    attached.clear();
    if (binding?.host === host) binding = undefined;
  }
  binding = { host, scan, dispose };
  scan();
  return dispose;
}

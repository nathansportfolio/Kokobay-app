/**
 * Focal-point zoom math for ZoomableImage.
 *
 * Transforms apply as: translateX → translateY → scale (RN default origin = view center).
 * A content point at local offset `l` from center appears at screen offset: t + s·l.
 *
 * Pinch focal fix: keep the content under the fingers stationary when scale changes s₀ → s₁:
 *   t₁ = f − (f − t₀) · (s₁ / s₀)
 * where f is the focal point relative to view center, t is translate, s is scale.
 */

export type ZoomClampInput = {
  translateX: number;
  translateY: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Visible image width/height at scale 1 (after contentFit). */
  contentWidth: number;
  contentHeight: number;
};

export type ZoomClampResult = {
  translateX: number;
  translateY: number;
};

/** Clamp pan so scaled content never reveals empty space beyond the viewport. */
export function clampZoomTranslation(input: ZoomClampInput): ZoomClampResult {
  'worklet';

  const {
    translateX,
    translateY,
    scale,
    viewportWidth,
    viewportHeight,
    contentWidth,
    contentHeight,
  } = input;

  if (scale <= 1) {
    return { translateX: 0, translateY: 0 };
  }

  const scaledW = contentWidth * scale;
  const scaledH = contentHeight * scale;
  const maxX = Math.max(0, (scaledW - viewportWidth) / 2);
  const maxY = Math.max(0, (scaledH - viewportHeight) / 2);

  return {
    translateX: Math.min(maxX, Math.max(-maxX, translateX)),
    translateY: Math.min(maxY, Math.max(-maxY, translateY)),
  };
}

/**
 * Focal-point scale update — keeps the pinch centroid pinned under the user's fingers.
 */
export function focalPointScaleUpdate(input: {
  focalX: number;
  focalY: number;
  viewportWidth: number;
  viewportHeight: number;
  startScale: number;
  startTranslateX: number;
  startTranslateY: number;
  gestureScale: number;
  minScale: number;
  maxScale: number;
}): { scale: number; translateX: number; translateY: number } {
  'worklet';

  const nextScale = Math.min(
    input.maxScale,
    Math.max(input.minScale, input.startScale * input.gestureScale),
  );
  const ratio = nextScale / input.startScale;

  // Focal relative to view center (RNGH focalX/Y are top-left origin).
  const focalCenterX = input.focalX - input.viewportWidth / 2;
  const focalCenterY = input.focalY - input.viewportHeight / 2;

  return {
    scale: nextScale,
    translateX: focalCenterX - (focalCenterX - input.startTranslateX) * ratio,
    translateY: focalCenterY - (focalCenterY - input.startTranslateY) * ratio,
  };
}

/**
 * Double-tap zoom toward tap location (Instagram-style toggle).
 */
export function focalPointDoubleTapUpdate(input: {
  tapX: number;
  tapY: number;
  viewportWidth: number;
  viewportHeight: number;
  currentScale: number;
  currentTranslateX: number;
  currentTranslateY: number;
  zoomInScale: number;
  zoomOutThreshold: number;
}): { scale: number; translateX: number; translateY: number; zoomingIn: boolean } {
  'worklet';

  const zoomingIn = input.currentScale <= input.zoomOutThreshold;
  const targetScale = zoomingIn ? input.zoomInScale : 1;
  const ratio = targetScale / input.currentScale;

  const focalCenterX = input.tapX - input.viewportWidth / 2;
  const focalCenterY = input.tapY - input.viewportHeight / 2;

  if (!zoomingIn) {
    return { scale: 1, translateX: 0, translateY: 0, zoomingIn: false };
  }

  return {
    scale: targetScale,
    translateX: focalCenterX - (focalCenterX - input.currentTranslateX) * ratio,
    translateY: focalCenterY - (focalCenterY - input.currentTranslateY) * ratio,
    zoomingIn: true,
  };
}

/** Compute displayed image size for `cover` / `contain` at scale 1. */
export function displayedImageSize(input: {
  imageWidth: number;
  imageHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  contentFit: 'cover' | 'contain';
}): { width: number; height: number } {
  'worklet';

  const { imageWidth, imageHeight, viewportWidth, viewportHeight, contentFit } = input;
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: viewportWidth, height: viewportHeight };
  }

  const imageAspect = imageWidth / imageHeight;
  const viewportAspect = viewportWidth / viewportHeight;

  if (contentFit === 'cover') {
    return { width: viewportWidth, height: viewportHeight };
  }

  if (imageAspect > viewportAspect) {
    return { width: viewportWidth, height: viewportWidth / imageAspect };
  }

  return { width: viewportHeight * imageAspect, height: viewportHeight };
}

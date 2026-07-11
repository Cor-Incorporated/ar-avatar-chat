import { Box3, Camera, Frustum, Matrix4, Object3D, Vector3 } from 'three';

export const MAX_FRAME_DELTA_SECONDS = 1 / 15;

export function clampFrameDelta(deltaSeconds: number): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(deltaSeconds, MAX_FRAME_DELTA_SECONDS);
}

export function shouldDeferViewportResize(keyboardOverlayActive: boolean): boolean {
  return keyboardOverlayActive;
}

export function normalizeViewportOffset(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export type ARSourceOrientation = 'portrait' | 'landscape';

export function detectARSourceOrientation(renderedWidth: number, renderedHeight: number): ARSourceOrientation {
  return renderedWidth > renderedHeight ? 'landscape' : 'portrait';
}

export function coverProjectionScale(
  videoWidth: number,
  videoHeight: number,
  displayWidth: number,
  displayHeight: number,
): { x: number; y: number } {
  if ([videoWidth, videoHeight, displayWidth, displayHeight].some((value) => value <= 0 || !Number.isFinite(value))) {
    return { x: 1, y: 1 };
  }
  const videoAspect = videoWidth / videoHeight;
  const displayAspect = displayWidth / displayHeight;
  return displayAspect > videoAspect
    ? { x: 1, y: displayAspect / videoAspect }
    : { x: videoAspect / displayAspect, y: 1 };
}

export function isCameraPermissionError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return true;
  }
  return error instanceof Error && /permission|denied|NotAllowed/i.test(error.message);
}

export function setUniformScale(object: Object3D, scale: number): void {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('Avatar scale must be a positive finite number');
  }
  object.scale.setScalar(scale);
}

export function anchorAvatarToFeet(object: Object3D): void {
  object.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(object);
  const center = bounds.getCenter(new Vector3());
  if (![bounds.min.y, center.x, center.z].every(Number.isFinite)) {
    throw new Error('Avatar bounds are not finite');
  }
  object.position.x -= center.x;
  object.position.y -= bounds.min.y;
  object.position.z -= center.z;
}

export function anchorObjectToWorldPoints(object: Object3D, worldPoints: readonly Vector3[]): void {
  if (worldPoints.length === 0) throw new Error('At least one anchor point is required');
  const points = worldPoints.map((point) => object.parent?.worldToLocal(point.clone()) ?? point.clone());
  const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const centerZ = points.reduce((sum, point) => sum + point.z, 0) / points.length;
  const floorY = Math.min(...points.map((point) => point.y));
  object.position.x -= centerX;
  object.position.y -= floorY;
  object.position.z -= centerZ;
}

export function isObjectSafelyInCameraView(
  object: Object3D,
  camera: Camera,
): boolean {
  object.updateWorldMatrix(true, true);
  camera.updateWorldMatrix(true, false);
  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) return false;
  const cameraPosition = camera.getWorldPosition(new Vector3());
  if (bounds.containsPoint(cameraPosition)) return false;
  const viewProjection = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return new Frustum().setFromProjectionMatrix(viewProjection).intersectsBox(bounds);
}

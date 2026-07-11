import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { anchorAvatarToFeet, areViewportRectsStable, clampFrameDelta, coverProjectionScale, detectARSourceOrientation, isCameraPermissionError, isObjectSafelyInCameraView, MAX_FRAME_DELTA_SECONDS, setUniformScale, shouldDeferViewportResize } from './runtimeMath.js';

describe('AR runtime math', () => {
  it('clamps a resumed-tab frame delta', () => {
    expect(clampFrameDelta(5)).toBe(MAX_FRAME_DELTA_SECONDS);
    expect(clampFrameDelta(1 / 60)).toBeCloseTo(1 / 60);
    expect(clampFrameDelta(Number.NaN)).toBe(0);
  });

  it('only applies isotropic scale', () => {
    const object = new Object3D();
    setUniformScale(object, 0.78);
    expect(object.scale.toArray()).toEqual([0.78, 0.78, 0.78]);
    expect(() => setUniformScale(object, 0)).toThrow(RangeError);
  });

  it('places avatar scene bounds inside the camera frustum from an AR.js marker matrix', () => {
    const camera = new PerspectiveCamera(45, 390 / 844, 0.1, 100);
    camera.updateProjectionMatrix();

    const marker = new Object3D();
    marker.matrixAutoUpdate = false;
    marker.matrix.compose(
      new Vector3(0, 0, -4),
      new Quaternion(),
      new Vector3(1, 1, 1),
    );
    const avatar = new Mesh(new BoxGeometry(0.8, 1.8, 0.5), new MeshBasicMaterial());
    avatar.position.y = 0.9;
    marker.add(avatar);

    expect(isObjectSafelyInCameraView(avatar, camera)).toBe(true);
  });

  it('rejects the old failure mode where avatar bounds remain at the camera origin', () => {
    const camera = new PerspectiveCamera(45, 390 / 844, 0.1, 100);
    camera.updateProjectionMatrix();
    const avatarAtCamera = new Mesh(
      new BoxGeometry(0.8, 1.8, 0.5),
      new MeshBasicMaterial(),
    );

    expect(isObjectSafelyInCameraView(avatarAtCamera, camera)).toBe(false);
  });

  it('rejects avatar bounds behind the camera or outside the clip volume', () => {
    const camera = new PerspectiveCamera(45, 390 / 844, 0.1, 100);
    camera.updateProjectionMatrix();
    const avatar = new Mesh(new BoxGeometry(0.8, 1.8, 0.5), new MeshBasicMaterial());
    avatar.position.set(0, 0.9, 4);
    expect(isObjectSafelyInCameraView(avatar, camera)).toBe(false);
    avatar.position.set(20, 0.9, -4);
    expect(isObjectSafelyInCameraView(avatar, camera)).toBe(false);
  });

  it('corrects camera projection for cover cropping without stretching', () => {
    const portrait = coverProjectionScale(1280, 960, 390, 844);
    const landscape = coverProjectionScale(1280, 960, 844, 390);
    expect(portrait).toEqual({ x: (4 / 3) / (390 / 844), y: 1 });
    expect(landscape).toEqual({ x: 1, y: (844 / 390) / (4 / 3) });

    // A 4:3 calibrated projection has m00 / m11 = 3 / 4. After cover
    // correction, equal world distances must occupy equal pixel distances.
    expect((3 / 4) * portrait.x * 390).toBeCloseTo(portrait.y * 844);
    expect((3 / 4) * landscape.x * 844).toBeCloseTo(landscape.y * 390);
  });

  it('keeps the AR renderer fixed while the iOS keyboard owns the visual viewport', () => {
    expect(shouldDeferViewportResize(true)).toBe(true);
    expect(shouldDeferViewportResize(false)).toBe(false);
  });

  it('allows at most one pixel of stage, video and canvas movement while typing', () => {
    const before = [
      { left: 0, top: 0, width: 390, height: 844 },
      { left: 0, top: 0, width: 390, height: 844 },
      { left: 0, top: 0, width: 390, height: 844 },
    ];
    const withinRoundingTolerance = before.map((rect) => ({
      ...rect,
      left: rect.left + 0.5,
      height: rect.height - 1,
    }));
    const keyboardResized = before.map((rect) => ({ ...rect, height: 500 }));

    expect(areViewportRectsStable(before, withinRoundingTolerance)).toBe(true);
    expect(areViewportRectsStable(before, keyboardResized)).toBe(false);
  });

  it('reports the rendered camera orientation used by ARToolkit', () => {
    expect(detectARSourceOrientation(390, 844)).toBe('portrait');
    expect(detectARSourceOrientation(844, 390)).toBe('landscape');
  });

  it('classifies camera permission failures by DOMException name before message fallback', () => {
    expect(isCameraPermissionError(new DOMException('localized message', 'NotAllowedError'))).toBe(true);
    expect(isCameraPermissionError(new DOMException('localized message', 'SecurityError'))).toBe(true);
    expect(isCameraPermissionError(new Error('Permission denied by browser'))).toBe(true);
    expect(isCameraPermissionError(new DOMException('device unavailable', 'NotFoundError'))).toBe(false);
  });

  it('centers X/Z and places the feet on the marker plane', () => {
    const object = new Object3D();
    const mesh = new Mesh(new BoxGeometry(2, 4, 2), new MeshBasicMaterial());
    mesh.position.set(3, 4, -2);
    object.add(mesh);
    anchorAvatarToFeet(object);
    object.updateWorldMatrix(true, true);
    expect(object.position.toArray()).toEqual([-3, -2, 2]);
  });
});

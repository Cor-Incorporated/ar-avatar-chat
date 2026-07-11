import { AnimationClip, AnimationMixer, BoxGeometry, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { VRM } from '@pixiv/three-vrm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvatarController, type AvatarEmotion } from './AvatarController.js';

type ControllerInternals = {
  vrm: VRM;
  mixer: AnimationMixer;
  actions: Map<AvatarEmotion, ReturnType<AnimationMixer['clipAction']>>;
  currentEmotion: AvatarEmotion;
  finishedListener: unknown;
  loadAnimation(emotion: AvatarEmotion, url: URL): Promise<void>;
  anchorToHumanoidFeet(vrm: VRM): void;
};

afterEach(() => vi.restoreAllMocks());

function createController() {
  const controller = new AvatarController();
  const internals = controller as unknown as ControllerInternals;
  const mixer = new AnimationMixer(new Object3D());
  internals.mixer = mixer;
  internals.actions = new Map(
    (['neutral', 'happy', 'sad'] as AvatarEmotion[]).map((emotion) => [
      emotion,
      mixer.clipAction(new AnimationClip(emotion, 1, [])),
    ]),
  );
  return { controller, internals, mixer };
}

function finishedListenerCount(mixer: AnimationMixer): number {
  const listeners = (mixer as unknown as { _listeners?: Record<string, unknown[]> })._listeners;
  return listeners?.finished?.length ?? 0;
}

describe('AvatarController emotion transitions', () => {
  it('anchors scaled humanoid feet on the marker plane', () => {
    const controller = new AvatarController();
    const internals = controller as unknown as ControllerInternals;
    const scene = new Object3D();
    scene.scale.setScalar(0.78);
    const leftFoot = new Object3D();
    const rightFoot = new Object3D();
    leftFoot.position.set(-0.2, 1, 0.1);
    rightFoot.position.set(0.2, 1, -0.1);
    scene.add(leftFoot, rightFoot);
    const vrm = {
      scene,
      humanoid: {
        getNormalizedBoneNode: (bone: string) => bone === 'leftFoot' ? leftFoot : rightFoot,
      },
    } as unknown as VRM;

    internals.anchorToHumanoidFeet(vrm);
    scene.updateWorldMatrix(true, true);
    const leftWorld = leftFoot.getWorldPosition(new Vector3());
    const rightWorld = rightFoot.getWorldPosition(new Vector3());

    expect(Math.min(leftWorld.y, rightWorld.y)).toBeCloseTo(0);
    expect((leftWorld.x + rightWorld.x) / 2).toBeCloseTo(0);
    expect((leftWorld.z + rightWorld.z) / 2).toBeCloseTo(0);
  });

  it('replaces an interrupted emotion listener and only the active action returns to neutral', () => {
    const { controller, internals, mixer } = createController();
    controller.playEmotion('happy');
    const happy = internals.actions.get('happy')!;
    expect(finishedListenerCount(mixer)).toBe(1);

    controller.playEmotion('sad');
    const sad = internals.actions.get('sad')!;
    expect(finishedListenerCount(mixer)).toBe(1);

    mixer.dispatchEvent({ type: 'finished', action: happy, direction: 1 });
    expect(internals.currentEmotion).toBe('sad');
    expect(finishedListenerCount(mixer)).toBe(1);

    mixer.dispatchEvent({ type: 'finished', action: sad, direction: 1 });
    expect(internals.currentEmotion).toBe('neutral');
    expect(finishedListenerCount(mixer)).toBe(0);
  });

  it('removes the active finished listener on dispose', () => {
    const { controller, internals, mixer } = createController();
    controller.playEmotion('happy');
    expect(internals.finishedListener).not.toBeNull();

    controller.dispose();
    expect(internals.finishedListener).toBeNull();
    expect(finishedListenerCount(mixer)).toBe(0);
  });

  it('silently disposes a background animation that resolves after controller disposal', async () => {
    const controller = new AvatarController();
    const internals = controller as unknown as ControllerInternals;
    const avatarScene = new Object3D();
    internals.vrm = { scene: avatarScene } as VRM;
    internals.mixer = new AnimationMixer(avatarScene);

    const staleScene = new Object3D();
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    staleScene.add(new Mesh(geometry, material));
    const geometryDisposed = vi.fn();
    const materialDisposed = vi.fn();
    geometry.addEventListener('dispose', geometryDisposed);
    material.addEventListener('dispose', materialDisposed);

    let resolveLoad!: (value: Awaited<ReturnType<GLTFLoader['loadAsync']>>) => void;
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockReturnValue(new Promise((resolve) => {
      resolveLoad = resolve;
    }));

    const pending = internals.loadAnimation('happy', new URL('https://example.test/happy.vrma'));
    controller.dispose();
    resolveLoad({ scene: staleScene, userData: {} } as Awaited<ReturnType<GLTFLoader['loadAsync']>>);

    await expect(pending).resolves.toBeUndefined();
    expect(geometryDisposed).toHaveBeenCalledOnce();
    expect(materialDisposed).toHaveBeenCalledOnce();
  });
});

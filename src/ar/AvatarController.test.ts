import { AnimationClip, AnimationMixer, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { AvatarController, type AvatarEmotion } from './AvatarController.js';

type ControllerInternals = {
  mixer: AnimationMixer;
  actions: Map<AvatarEmotion, ReturnType<AnimationMixer['clipAction']>>;
  currentEmotion: AvatarEmotion;
  finishedListener: unknown;
};

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
});

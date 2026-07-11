import {
  AnimationAction,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Object3D,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
} from '@pixiv/three-vrm-animation';
import { anchorAvatarToFeet, anchorObjectToWorldPoints, setUniformScale } from './runtimeMath.js';

export type AvatarEmotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'relaxed' | 'surprised' | 'thinking';

const ANIMATIONS: Record<AvatarEmotion, URL> = {
  neutral: new URL('../assets/animations/VRMA_01.vrma', import.meta.url),
  happy: new URL('../assets/animations/happy.vrma', import.meta.url),
  angry: new URL('../assets/animations/angry.vrma', import.meta.url),
  sad: new URL('../assets/animations/VRMA_02.vrma', import.meta.url),
  relaxed: new URL('../assets/animations/relaxed.vrma', import.meta.url),
  surprised: new URL('../assets/animations/surprised.vrma', import.meta.url),
  thinking: new URL('../assets/animations/thinking.vrma', import.meta.url),
};

const EXPRESSIONS: AvatarEmotion[] = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'thinking'];

export class AvatarController extends EventTarget {
  readonly root = new Object3D();
  private vrm: VRM | null = null;
  private mixer: AnimationMixer | null = null;
  private actions = new Map<AvatarEmotion, AnimationAction>();
  private currentAction: AnimationAction | null = null;
  private currentEmotion: AvatarEmotion = 'neutral';
  private finishedListener: ((event: { action: AnimationAction }) => void) | null = null;
  private disposed = false;

  async load(): Promise<void> {
    const modelLoader = new GLTFLoader();
    modelLoader.register((parser) => new VRMLoaderPlugin(parser));
    const model = await modelLoader.loadAsync(new URL('../assets/models/avatar.vrm', import.meta.url).href);
    const vrm = model.userData.vrm as VRM | undefined;
    if (!vrm) throw new Error('VRM model metadata was not found');

    VRMUtils.combineSkeletons(vrm.scene);
    VRMUtils.rotateVRM0(vrm);
    setUniformScale(vrm.scene, 0.78);
    this.anchorToHumanoidFeet(vrm);
    this.root.add(vrm.scene);
    this.vrm = vrm;
    this.mixer = new AnimationMixer(vrm.scene);

    await this.loadAnimation('neutral', ANIMATIONS.neutral).catch((error: unknown) => {
      console.warn('[Avatar] neutral VRMA could not be loaded; continuing with expression-only idle', error);
    });
    const neutralReady = this.actions.has('neutral');
    if (neutralReady) this.playEmotion('neutral');
    this.dispatchEvent(new Event('ready'));
    void Promise.allSettled(
      Object.entries(ANIMATIONS)
        .filter(([emotion]) => emotion !== 'neutral')
        .map(([emotion, url]) => this.loadAnimation(emotion as AvatarEmotion, url)),
    ).then((results) => {
      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length) console.warn(`[Avatar] ${failed.length} animation asset(s) failed validation/loading`);
    });
  }

  private anchorToHumanoidFeet(vrm: VRM): void {
    const feet = ['leftFoot', 'rightFoot']
      .map((bone) => vrm.humanoid.getNormalizedBoneNode(bone as 'leftFoot' | 'rightFoot'))
      .filter((bone): bone is Object3D => bone !== null);
    if (feet.length === 0) {
      anchorAvatarToFeet(vrm.scene);
      return;
    }
    vrm.scene.updateWorldMatrix(true, true);
    const worldPositions = feet.map((foot) => foot.getWorldPosition(new Vector3()));
    anchorObjectToWorldPoints(vrm.scene, worldPositions);
  }

  private async loadAnimation(emotion: AvatarEmotion, url: URL): Promise<void> {
    const vrm = this.vrm;
    const mixer = this.mixer;
    if (this.disposed || !vrm || !mixer) return;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    const gltf = await loader.loadAsync(url.href);
    if (this.disposed || this.vrm !== vrm || this.mixer !== mixer) {
      VRMUtils.deepDispose(gltf.scene);
      return;
    }
    const animation = gltf.userData.vrmAnimations?.[0];
    if (!animation) throw new Error(`${emotion}: VRMC_vrm_animation is missing`);
    const clip = createVRMAnimationClip(animation, vrm);
    if (!clip || clip.duration <= 0 || clip.tracks.length === 0) {
      throw new Error(`${emotion}: animation clip is empty`);
    }
    const action = mixer.clipAction(clip);
    if (emotion === 'neutral') {
      action.setLoop(LoopRepeat, Infinity);
    } else {
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    this.actions.set(emotion, action);
  }

  update(deltaSeconds: number): void {
    this.mixer?.update(deltaSeconds);
    this.vrm?.update(deltaSeconds);
  }

  playEmotion(value: string): void {
    const emotion = (EXPRESSIONS.includes(value as AvatarEmotion) ? value : 'neutral') as AvatarEmotion;
    const action = this.actions.get(emotion);
    this.setExpression(emotion);
    if (!action) {
      if (emotion !== 'neutral') this.ensureIdle();
      return;
    }
    this.clearFinishedListener();
    if (emotion === 'neutral' && action === this.currentAction && action.isRunning()) return;
    this.currentAction?.fadeOut(0.35);
    action.reset().fadeIn(0.35).play();
    this.currentAction = action;
    this.currentEmotion = emotion;
    if (emotion !== 'neutral' && this.mixer) {
      const expectedAction = action;
      this.finishedListener = (event: { action: AnimationAction }) => {
        if (event.action !== expectedAction) return;
        this.clearFinishedListener();
        if (this.currentAction === expectedAction) this.playEmotion('neutral');
      };
      this.mixer.addEventListener('finished', this.finishedListener);
    }
  }

  private clearFinishedListener(): void {
    if (!this.finishedListener) return;
    this.mixer?.removeEventListener('finished', this.finishedListener);
    this.finishedListener = null;
  }

  ensureIdle(): void {
    if (this.currentEmotion !== 'neutral' && this.currentAction?.isRunning()) return;
    this.playEmotion('neutral');
  }

  private setExpression(emotion: AvatarEmotion): void {
    const manager = this.vrm?.expressionManager;
    if (!manager) return;
    for (const expression of EXPRESSIONS) manager.setValue(expression, 0);
    if (emotion !== 'thinking') manager.setValue(emotion, 1);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearFinishedListener();
    this.mixer?.stopAllAction();
    if (this.vrm) VRMUtils.deepDispose(this.vrm.scene);
    this.root.clear();
    this.actions.clear();
    this.currentAction = null;
    this.mixer = null;
    this.vrm = null;
  }
}

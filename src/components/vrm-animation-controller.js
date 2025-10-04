const THREE = AFRAME.THREE;
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

AFRAME.registerComponent('vrm-animation-controller', {
  schema: {},

  init: function() {
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.scene = null;
    this.vrm = null;

    this.emotionToAnimation = {
      'neutral': './assets/animations/VRMA_01.vrma',
      'happy': './assets/animations/VRMA_02.vrma',
      'angry': './assets/animations/VRMA_03.vrma',
      'sad': './assets/animations/VRMA_04.vrma',
      'relaxed': './assets/animations/VRMA_05.vrma',
      'surprised': './assets/animations/VRMA_06.vrma',
      'thinking': './assets/animations/VRMA_07.vrma'
    };

    this.el.addEventListener('vrm-loaded', (e) => {
      this.vrm = e.detail.vrm;
      this.scene = e.detail.scene;
      this.loadAllAnimations();
    });

    window.playEmotion = (emotion) => this.playEmotion(emotion);
  },

  async loadAllAnimations() {
    console.log('[Animation Controller] 全てのアニメーションをロード中...');

    for (const [emotion, path] of Object.entries(this.emotionToAnimation)) {
      await this.loadAnimation(emotion, path);
    }

    console.log('[Animation Controller] 全てのアニメーションがロード完了');
    this.playEmotion('neutral');
  },

  async loadAnimation(emotion, path) {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(path);

      if (!this.scene) {
        console.error('[Animation Controller] VRMシーンが見つかりません');
        return;
      }

      if (!this.mixer) {
        this.mixer = new THREE.AnimationMixer(this.scene);
      }

      if (gltf.animations && gltf.animations.length > 0) {
        const action = this.mixer.clipAction(gltf.animations[0]);
        action.loop = THREE.LoopRepeat;
        action.clampWhenFinished = true;
        this.actions[emotion] = action;
        console.log(`[Animation Controller] ${emotion} のアニメーションをロード: ${path}`);
      } else {
        console.warn(`[Animation Controller] ${emotion} のアニメーションクリップが見つかりません`);
      }

    } catch (error) {
      console.error(`[Animation Controller] ${emotion} のアニメーションロードエラー:`, error);
    }
  },

  playEmotion(emotion) {
    const action = this.actions[emotion];

    if (!action) {
      console.warn(`[Animation Controller] アニメーションが見つかりません: ${emotion}`);
      return;
    }

    console.log(`[Animation Controller] 感情を切り替え: ${emotion}`);

    if (this.currentAction && this.currentAction !== action) {
      this.currentAction.fadeOut(0.5);
    }

    action.reset().fadeIn(0.5).play();
    this.currentAction = action;

    if (this.vrm) {
      this.setVRMExpression(emotion);
    }
  },

  setVRMExpression(emotion) {
    if (!this.vrm || !this.vrm.expressionManager) {
      console.warn('[Animation Controller] VRM expressionManager not found');
      return;
    }

    const expressionManager = this.vrm.expressionManager;

    const allExpressions = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];
    allExpressions.forEach(expr => {
      expressionManager.setValue(expr, 0);
    });

    if (allExpressions.includes(emotion)) {
      expressionManager.setValue(emotion, 1.0);
    }

    expressionManager.update();

    console.log(`[Animation Controller] VRM表情を設定: ${emotion}`);
  },

  tick: function(time, deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime / 1000);
    }
  }
});

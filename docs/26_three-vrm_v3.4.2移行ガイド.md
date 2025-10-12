# three-vrm v3.4.2 移行ガイド（Phase 7提案）

**日付**: 2025-10-12  
**ステータス**: 提案  
**優先度**: 中（現状で問題ないため急ぎではない）

---

## 🎯 移行の目的

最新のthree-vrm v3.4.2と公式`@pixiv/three-vrm-animation`パッケージを使用し、カスタム実装を削除してコードをシンプル化。

---

## 📦 公式パッケージの使用

### 現在（Phase 6）

```javascript
// カスタム実装
import { loadVRMAnimation } from '../lib/VRMAnimation/loadVRMAnimation.js';

const vrmAnimation = await loadVRMAnimation(path);
const clip = vrmAnimation.createAnimationClip(vrm);
```

### 移行後（Phase 7提案）

```javascript
// 公式パッケージ
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

const loader = new GLTFLoader();
loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
const gltf = await loader.loadAsync(path);
const vrmAnimation = gltf.userData.vrmAnimations[0];
const clip = createVRMAnimationClip(vrmAnimation, vrm);
```

**違い**: APIの使い方は**ほぼ同じ**（fbx2vrma-converter-uiと同じ実装）

---

## 🔄 移行手順

### ステップ1: importmap更新

```html
<!-- src/index.html -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.177.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.177.0/examples/jsm/",
    "@pixiv/three-vrm": "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.4.2/lib/three-vrm.module.min.js",
    "@pixiv/three-vrm-animation": "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm-animation@3.4.2/lib/three-vrm-animation.module.min.js"
  }
}
</script>
```

### ステップ2: コード更新

```javascript
// src/components/vrm-animation-controller.js
const THREE = AFRAME.THREE;
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

async loadAnimation(emotion, path) {
  try {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    const gltf = await loader.loadAsync(path);
    
    const vrmAnimations = gltf.userData.vrmAnimations;
    if (!vrmAnimations || vrmAnimations.length === 0) {
      throw new Error('VRMAnimationデータが見つかりません');
    }
    
    const vrmAnimation = vrmAnimations[0];
    const clip = createVRMAnimationClip(vrmAnimation, this.vrm);
    
    if (!clip) {
      throw new Error('AnimationClipの作成に失敗しました');
    }
    
    if (!this.mixer) {
      this.mixer = new THREE.AnimationMixer(this.vrm.scene);
    }
    
    const action = this.mixer.clipAction(clip);
    
    if (emotion === this.idleEmotion) {
      action.loop = THREE.LoopRepeat;
      console.log(`${this.LOG_PREFIX} 📂 ${emotion} (idle): ${path}`);
    } else {
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
      console.log(`${this.LOG_PREFIX} 📂 ${emotion} (oneshot): ${path}`);
    }
    
    this.actions[emotion] = action;
    
  } catch (error) {
    console.error(`${this.LOG_PREFIX} ❌ ${emotion} の読み込み失敗:`, error);
    throw error;
  }
}
```

### ステップ3: カスタムライブラリ削除

```bash
rm -rf src/lib/VRMAnimation
rm -rf src/lib/utils
```

### ステップ4: vrm-loader.js更新

```javascript
// src/components/vrm-loader.js
import { VRMUtils } from '@pixiv/three-vrm';

// removeUnnecessaryJoints は非推奨
// VRMUtils.removeUnnecessaryJoints(gltf.scene);  // ← 削除

// combineSkeletons を使用（推奨）
// ※ ただし、three-vrm v3.4.2では自動で最適化されるため不要の可能性
```

### ステップ5: テスト

```bash
# 開発サーバー起動
python3 -m http.server 8000

# ブラウザでテスト
# - VRMA_01.vrma（VRM標準）
# - idle_loop.vrma（カスタム）
# - LyingDown.vrma（Mixamo）
```

---

## 📊 移行の影響

### メリット

| 項目 | 改善内容 |
|------|---------|
| コードサイズ | -588行（カスタムライブラリ削除） |
| 保守性 | 公式サポート、将来のアップデート対応 |
| 最新機能 | VRM 1.0完全対応、Node Constraints等 |
| Three.js | v0.164.1 → v0.177.0（最新版） |
| パフォーマンス | Tree Shaking、メモリ使用量削減 |

### デメリット

| 項目 | 影響 |
|------|------|
| 移行作業 | 2-4時間の作業時間 |
| テスト | 3形式で再テストが必要 |
| リスク | 新しいバグが混入する可能性（低） |

---

## 🚀 実装例

完全な移行後のコード例：

```javascript
/**
 * VRM Animation Controller v3.0.0
 * three-vrm v3.4.2 + @pixiv/three-vrm-animation@3.4.2 使用
 */
const THREE = AFRAME.THREE;
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

AFRAME.registerComponent('vrm-animation-controller', {
  // ... 他のコードは同じ
  
  async loadAnimation(emotion, path) {
    try {
      // GLTFLoaderにプラグイン登録
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
      
      // VRMAファイル読み込み
      const gltf = await loader.loadAsync(path);
      const vrmAnimation = gltf.userData.vrmAnimations?.[0];
      
      if (!vrmAnimation) {
        throw new Error('VRMAnimationが見つかりません');
      }
      
      // リターゲティング実行
      const clip = createVRMAnimationClip(vrmAnimation, this.vrm);
      
      // AnimationAction作成
      if (!this.mixer) {
        this.mixer = new THREE.AnimationMixer(this.vrm.scene);
      }
      
      const action = this.mixer.clipAction(clip);
      action.loop = emotion === this.idleEmotion ? THREE.LoopRepeat : THREE.LoopOnce;
      action.clampWhenFinished = emotion !== this.idleEmotion;
      
      this.actions[emotion] = action;
      
      console.log(`${this.LOG_PREFIX} ✅ ${emotion} ロード完了: ${path}`);
      
    } catch (error) {
      console.error(`${this.LOG_PREFIX} ❌ ${emotion} ロード失敗:`, error);
      throw error;
    }
  }
});
```

---

## ✅ チェックリスト（移行時）

Phase 7実装時の確認項目：

- [ ] importmap更新（three@0.177.0, three-vrm@3.4.2, three-vrm-animation@3.4.2）
- [ ] vrm-animation-controller.js のimport文更新
- [ ] loadAnimation()メソッドの書き換え
- [ ] vrm-loader.jsの非推奨API削除
- [ ] カスタムライブラリ削除（src/lib/）
- [ ] ブラウザでVRMA_01.vrmaテスト
- [ ] ブラウザでidle_loop.vrmaテスト
- [ ] ブラウザでLyingDown.vrmaテスト
- [ ] PropertyBindingエラーが出ないことを確認
- [ ] 7つの感情アニメーション全て動作確認
- [ ] ドキュメント更新
- [ ] PRを作成

---

**作成日**: 2025-10-12  
**ステータス**: 提案（Phase 7で実装検討）

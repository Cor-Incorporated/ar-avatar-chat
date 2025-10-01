# 開発指示書 Phase 1-MVP
## ARアバターチャット - 環境セットアップ〜アバター表示

**発行日**: 2025-10-01  
**発行者**: PdM 寺田康佑  
**対象**: 開発チーム  
**期限**: 3営業日以内

---

## 📌 Phase 1の目標

名刺のペンギンロゴマーカーを検出し、VRMアバターを表示してモーションアニメーションを再生する。

### 成果物
- `src/index.html`: 動作するARアプリケーション
- `src/components/`: カスタムA-Frameコンポーネント
- `src/assets/markers/penguin-marker.patt`: カスタムマーカーファイル
- 動作確認レポート（スクリーンショット付き）

---

## 🚀 ステップ1: 基本環境セットアップ（Day 1午前）

### 1-1. HTMLベースファイル作成

**指示**: `src/index.html` を以下の内容で作成してください。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cor.Inc AR Demo</title>
  
  <!-- A-Frame 1.7.0 -->
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  
  <!-- AR.js 3.4.7 -->
  <script src="https://cdn.jsdelivr.net/npm/@ar-js-org/ar.js@3.4.7/aframe/build/aframe-ar-nft.js"></script>
  
  <!-- Three.js + three-vrm (Import Map) -->
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.177.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.177.0/examples/jsm/",
        "@pixiv/three-vrm": "https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@3.4.2/lib/three-vrm.module.min.js"
      }
    }
  </script>
  
  <style>
    body { margin: 0; overflow: hidden; }
    #info {
      position: absolute;
      top: 10px;
      left: 10px;
      color: white;
      background: rgba(0,0,0,0.7);
      padding: 10px;
      font-family: sans-serif;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="info">
    <h3>Cor.Inc AR Demo</h3>
    <p>名刺のペンギンロゴにカメラを向けてください</p>
    <p id="status">初期化中...</p>
  </div>

  <a-scene
    embedded
    arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;"
    vr-mode-ui="enabled: false"
    renderer="logarithmicDepthBuffer: true; precision: medium;"
  >
    <!-- カメラ -->
    <a-entity camera></a-entity>

    <!-- ライト -->
    <a-light type="ambient" intensity="0.5"></a-light>
    <a-light type="directional" intensity="0.8" position="1 1 1"></a-light>

    <!-- Hiroマーカー（仮） - 後でカスタムマーカーに差し替え -->
    <a-marker preset="hiro" id="marker">
      <!-- ここにVRMアバターを配置 -->
      <a-box position="0 0.5 0" material="color: cyan;"></a-box>
      <a-text value="テストマーカー" position="0 1 0" align="center"></a-text>
    </a-marker>
  </a-scene>

  <script>
    // ステータス表示更新
    document.querySelector('#marker').addEventListener('markerFound', () => {
      document.querySelector('#status').textContent = 'マーカー検出: OK';
    });
    
    document.querySelector('#marker').addEventListener('markerLost', () => {
      document.querySelector('#status').textContent = 'マーカー検出: 待機中...';
    });

    window.addEventListener('load', () => {
      document.querySelector('#status').textContent = 'カメラ準備完了';
    });
  </script>
</body>
</html>
```

### 1-2. ローカルサーバー起動

**指示**: 以下のいずれかの方法でローカルサーバーを起動してください。

**方法A**: VS Code Live Server
1. VS Codeで `src/index.html` を開く
2. 右クリック → "Open with Live Server"
3. ブラウザで `https://127.0.0.1:5500/src/index.html` にアクセス

**方法B**: Python簡易サーバー
```bash
cd /Users/teradakousuke/Developer/ar-avatar-chat/src
python3 -m http.server 8000
```
ブラウザで `http://localhost:8000/index.html` にアクセス

⚠️ **HTTPS必須**: スマートフォンでテストする場合は、ngrokまたはGlitchを使用してHTTPS環境を用意してください。

### 1-3. 動作確認（Hiroマーカー）

**タスク**:
1. Hiroマーカーを印刷（[ダウンロードはこちら](https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/HIRO.jpg)）
2. ブラウザでカメラ許可を承認
3. Hiroマーカーにカメラを向ける
4. 青いボックスと「テストマーカー」テキストが表示されることを確認

**✅ 完了条件**:
- [ ] カメラが起動する
- [ ] Hiroマーカー検出時にステータスが「マーカー検出: OK」に変わる
- [ ] 青いボックスが表示される

**📸 提出物**: 動作しているスクリーンショット（Slackに投稿）

---

## 🎯 ステップ2: カスタムマーカー生成（Day 1午後）

### 2-1. ペンギンマーカー画像の準備

**指示**: 名刺のペンギンロゴ部分を切り抜いて、マーカー画像を作成してください。

**手順**:
1. 名刺画像 `/mnt/user-data/uploads/NameCard.png` を開く
2. ペンギンロゴ部分（約3cm四方の正方形）を切り抜き
3. 以下の条件で保存:
   - ファイル名: `penguin-logo.png`
   - サイズ: 512x512px以上
   - 形式: PNG（背景: 白）
   - コントラスト: 高め（ロゴの濃紺を強調）
   - 保存先: `/Users/teradakousuke/Developer/ar-avatar-chat/assets/`

**⚠️ 注意**: AR.jsはコントラストの高い画像が必要です。必要に応じてPhotoshop/GIMPで調整してください。

### 2-2. マーカーパターンファイル生成

**指示**: AR.js Marker Training ツールを使用してマーカーを生成してください。

**手順**:
1. [AR.js Marker Training](https://ar-js-org.github.io/AR.js/three.js/examples/marker-training/examples/generator.html) にアクセス
2. `penguin-logo.png` をアップロード
3. 「Download Marker」ボタンで `.patt` ファイルをダウンロード
4. ファイル名を `penguin-marker.patt` に変更
5. 保存先: `/Users/teradakousuke/Developer/ar-avatar-chat/src/assets/markers/`

**代替手順**（オンラインツールが使えない場合）:
```bash
# AR.js CLIツールを使用（要Node.js）
npm install -g ar.js-marker-generator
ar.js-marker-generator penguin-logo.png penguin-marker.patt
```

### 2-3. index.htmlの更新

**指示**: Hiroマーカーをカスタムマーカーに差し替えてください。

**変更箇所**:
```html
<!-- 変更前 -->
<a-marker preset="hiro" id="marker">

<!-- 変更後 -->
<a-marker type="pattern" url="./assets/markers/penguin-marker.patt" id="marker">
```

### 2-4. 動作確認

**タスク**:
1. 名刺のペンギンロゴにカメラを向ける
2. 青いボックスが表示されることを確認

**✅ 完了条件**:
- [ ] ペンギンロゴ検出時にマーカーが反応する
- [ ] 検出距離: 30cm〜1m程度で安定して認識される
- [ ] 照明条件: 室内蛍光灯で検出可能

**📸 提出物**: 名刺マーカー検出のスクリーンショット

**⚠️ トラブルシューティング**:
- **検出できない場合**: コントラストを上げて再生成
- **不安定な場合**: カメラ距離・照明を調整

---

## 🎨 ステップ3: VRMアバター統合（Day 2）

### 3-1. VRMモデルの配置

**指示**: VRoid Studioで作成したVRMファイルを配置してください。

**手順**:
1. VRMファイルを `/Users/teradakousuke/Developer/ar-avatar-chat/src/assets/models/` に配置
2. ファイル名: `avatar.vrm`（わかりやすい名前に変更可）

**⚠️ 注意**: VRMファイルサイズが大きい場合（>10MB）、最適化してください:
- VRoid Studio → エクスポート設定 → テクスチャサイズ: 1024px
- ポリゴン削減: 低〜中設定

### 3-2. VRMローダーコンポーネント作成

**指示**: `src/components/vrm-loader.js` を以下の内容で作成してください。

```javascript
// src/components/vrm-loader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

AFRAME.registerComponent('vrm-loader', {
  schema: {
    src: { type: 'string', default: '' }
  },

  init: async function() {
    const scene = this.el.sceneEl.object3D;
    const loader = new GLTFLoader();
    
    // VRMプラグイン登録
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      console.log('VRMロード開始:', this.data.src);
      const gltf = await loader.loadAsync(this.data.src);
      const vrm = gltf.userData.vrm;

      if (!vrm) {
        throw new Error('VRMデータが見つかりません');
      }

      // 不要なジョイント削除（パフォーマンス最適化）
      VRMUtils.removeUnnecessaryJoints(gltf.scene);

      // VRMシーンをエンティティに追加
      this.el.setObject3D('mesh', vrm.scene);
      
      // 初期位置・サイズ調整
      vrm.scene.position.set(0, 0, 0);
      vrm.scene.scale.set(1, 1, 1);

      // VRMオブジェクトを保存（後でアニメーションで使用）
      this.vrm = vrm;

      console.log('VRMロード完了');
      this.el.emit('vrm-loaded', { vrm: vrm });

    } catch (error) {
      console.error('VRMロードエラー:', error);
      document.querySelector('#status').textContent = 'VRMロード失敗: ' + error.message;
    }
  },

  tick: function(time, deltaTime) {
    // VRMの更新（three-vrm必須）
    if (this.vrm) {
      this.vrm.update(deltaTime / 1000);
    }
  }
});
```

### 3-3. index.htmlに統合

**指示**: `src/index.html` を以下のように修正してください。

**追加1**: `<head>` 内にコンポーネント読み込み
```html
<!-- VRMローダーコンポーネント -->
<script type="module" src="./components/vrm-loader.js"></script>
```

**追加2**: マーカー内のボックスをVRMに差し替え
```html
<a-marker type="pattern" url="./assets/markers/penguin-marker.patt" id="marker">
  <!-- 削除: <a-box position="0 0.5 0" material="color: cyan;"></a-box> -->
  
  <!-- 追加: VRMアバター -->
  <a-entity
    id="avatar"
    vrm-loader="src: ./assets/models/avatar.vrm"
    position="0 0 0"
    rotation="0 0 0"
  ></a-entity>
</a-marker>
```

### 3-4. 動作確認

**タスク**:
1. ペンギンマーカーにカメラを向ける
2. VRMアバターが表示されることを確認

**✅ 完了条件**:
- [ ] マーカー検出時にVRMアバターが表示される
- [ ] アバターの向き・サイズが適切（顔が見える）
- [ ] コンソールに「VRMロード完了」と表示される
- [ ] エラーが出ていない

**📸 提出物**: VRMアバター表示のスクリーンショット

**⚠️ トラブルシューティング**:
- **アバターが小さすぎる/大きすぎる**: `scale` を調整（例: `scale="0.5 0.5 0.5"`）
- **アバターが見えない**: `position` のY軸を調整（例: `position="0 0.5 0"`）
- **CORSエラー**: ローカルサーバーのHTTPS化が必要

---

## 🎬 ステップ4: モーションアニメーション（Day 3）

### 4-1. モーションファイルの配置

**指示**: `.vrma` 形式のモーションファイルを配置してください。

**手順**:
1. モーションファイルを `/Users/teradakousuke/Developer/ar-avatar-chat/src/assets/animations/` に配置
2. ファイル名: `jump.vrma`（例: ジャンプモーション）

**⚠️ 注意**: `.vrma` はVRM Animation形式です。他の形式（FBX等）の場合は変換が必要です。

### 4-2. アニメーションコンポーネント作成

**指示**: `src/components/vrm-animation.js` を以下の内容で作成してください。

```javascript
// src/components/vrm-animation.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

AFRAME.registerComponent('vrm-animation', {
  schema: {
    src: { type: 'string', default: '' },
    autoplay: { type: 'boolean', default: true },
    loop: { type: 'boolean', default: false }
  },

  init: function() {
    this.mixer = null;
    this.action = null;

    // VRMロード完了を待つ
    this.el.addEventListener('vrm-loaded', (e) => {
      this.vrm = e.detail.vrm;
      this.loadAnimation();
    });
  },

  loadAnimation: async function() {
    if (!this.data.src) return;

    try {
      console.log('アニメーションロード開始:', this.data.src);
      
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(this.data.src);

      // AnimationMixer作成
      this.mixer = new THREE.AnimationMixer(this.vrm.scene);

      // アニメーションクリップ取得
      if (gltf.animations && gltf.animations.length > 0) {
        this.action = this.mixer.clipAction(gltf.animations[0]);
        this.action.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
        
        if (this.data.autoplay) {
          this.action.play();
        }

        console.log('アニメーション再生開始');
      } else {
        console.warn('アニメーションクリップが見つかりません');
      }

    } catch (error) {
      console.error('アニメーションロードエラー:', error);
    }
  },

  tick: function(time, deltaTime) {
    // AnimationMixerの更新
    if (this.mixer) {
      this.mixer.update(deltaTime / 1000);
    }
  },

  // 外部から呼び出せる再生関数
  play: function() {
    if (this.action) {
      this.action.reset().play();
    }
  }
});
```

### 4-3. index.htmlに統合

**指示**: `src/index.html` を修正してください。

**追加1**: `<head>` 内にコンポーネント読み込み
```html
<!-- アニメーションコンポーネント -->
<script type="module" src="./components/vrm-animation.js"></script>
```

**追加2**: VRMエンティティにアニメーション追加
```html
<a-entity
  id="avatar"
  vrm-loader="src: ./assets/models/avatar.vrm"
  vrm-animation="src: ./assets/animations/jump.vrma; autoplay: true; loop: false"
  position="0 0 0"
  rotation="0 0 0"
></a-entity>
```

### 4-4. マーカー検出時にアニメーション再生

**指示**: `<script>` セクションに以下を追加してください。

```javascript
// マーカー検出時にアニメーション再生
document.querySelector('#marker').addEventListener('markerFound', () => {
  const avatar = document.querySelector('#avatar');
  if (avatar && avatar.components['vrm-animation']) {
    avatar.components['vrm-animation'].play();
  }
});
```

### 4-5. 動作確認

**タスク**:
1. ペンギンマーカーにカメラを向ける
2. VRMアバターが表示され、モーションアニメーションが再生されることを確認

**✅ 完了条件**:
- [ ] マーカー検出時にアニメーションが再生される
- [ ] アニメーションがスムーズに動く（カクカクしない）
- [ ] アニメーション終了後、自然なポーズで停止する

**📸 提出物**: アニメーション再生中のスクリーンショット（または動画）

---

## 🎯 ステップ5: 最終調整とテスト（Day 3午後）

### 5-1. パフォーマンス最適化

**タスク**:
1. Chrome DevToolsでFPS確認（目標: 30fps以上）
2. VRMモデルのポリゴン数確認（目標: 50,000以下）
3. テクスチャサイズ確認（目標: 2048px以下）

**最適化が必要な場合**:
- VRMファイルを再エクスポート（低ポリゴン設定）
- テクスチャ圧縮（1024px）

### 5-2. UI改善

**指示**: ステータス表示をよりユーザーフレンドリーにしてください。

**例**:
```html
<div id="info">
  <h3>🐧 Cor.Inc AR Demo</h3>
  <p>📸 名刺のペンギンロゴにカメラを向けてください</p>
  <p id="status">⏳ 初期化中...</p>
</div>
```

ステータス更新:
```javascript
// カメラ準備完了
document.querySelector('#status').textContent = '✅ 準備完了！マーカーを映してください';

// マーカー検出
document.querySelector('#status').textContent = '🎉 マーカー検出！';

// マーカー喪失
document.querySelector('#status').textContent = '❌ マーカーが見えません';
```

### 5-3. エラーハンドリング

**指示**: よくあるエラーのフォールバック処理を追加してください。

```javascript
// カメラアクセス拒否
window.addEventListener('error', (e) => {
  if (e.message.includes('camera')) {
    document.querySelector('#status').textContent = '⚠️ カメラへのアクセスを許可してください';
  }
});

// VRMロード失敗
document.querySelector('#avatar').addEventListener('vrm-load-error', () => {
  document.querySelector('#status').textContent = '⚠️ アバターのロードに失敗しました';
});
```

### 5-4. 実機テスト

**タスク**: 以下のデバイスでテストしてください。

| デバイス | OS | ブラウザ | 結果 |
|----------|-----|---------|------|
| iPhone   | iOS 18+ | Safari  | ✅/❌ |
| Android  | 13+     | Chrome  | ✅/❌ |

**確認項目**:
- [ ] カメラが起動する
- [ ] マーカーを検出できる
- [ ] VRMアバターが表示される
- [ ] アニメーションが再生される
- [ ] パフォーマンスが良好（カクつかない）

**📸 提出物**: 実機での動作動画（15秒程度）

---

## 📦 最終納品物

Phase 1完了時、以下を提出してください：

### ファイル一式
```
src/
├── index.html
├── components/
│   ├── vrm-loader.js
│   └── vrm-animation.js
└── assets/
    ├── markers/
    │   └── penguin-marker.patt
    ├── models/
    │   └── avatar.vrm
    └── animations/
        └── jump.vrma
```

### ドキュメント
1. **動作確認レポート**（Markdown形式）
   - 各ステップのスクリーンショット
   - 実機テスト結果
   - 発生した問題と解決方法

2. **README.md更新**
   - セットアップ手順
   - 使い方
   - 既知の問題

### デモ準備
- Glitch/Vercelにデプロイ（HTTPS環境）
- 名刺マーカー印刷（カラー、高解像度）

---

## ⚠️ 重要な注意事項

### やってはいけないこと
❌ 指示書に記載のないライブラリ・バージョンを使用する  
❌ 指示書と異なるディレクトリ構成にする  
❌ エラーを放置して次のステップに進む  
❌ 実機テストをスキップする

### 必ずやること
✅ 各ステップ完了時にPdMに報告  
✅ エラーはスクリーンショット付きで報告  
✅ 変更・改善提案は事前に確認  
✅ コードにコメントを書く（日本語OK）

---

## 📞 問い合わせ

**PdM 寺田康佑**
- Slack: @terada
- 対応時間: 平日 9:00-18:00

質問は遠慮なく！一緒に良いものを作りましょう 🚀

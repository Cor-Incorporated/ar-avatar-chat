# CLAUDE.md

This file provides repository-specific guidance for Claude Code.

## Project Overview

Cor.Inc.の名刺マーカー上へVRMアバターを表示し、Geminiチャットの感情に応じて
VRMAモーションを再生するモバイルARデモです。対象はiOS Safari 18+とAndroid
Chrome 120+で、カメラ利用にはHTTPSが必要です。

## Current Frontend Architecture

- AR.js 3.4.8のThree.js版を使用する。A-Frameは実行時に使用しない。
- Three.js 0.180.0、`@pixiv/three-vrm` 3.5.5、
  `@pixiv/three-vrm-animation` 3.5.5をnpm/Viteで管理する。
- `src/main.ts`が`ARRuntime`と`ChatController`を生成し、破棄まで所有する。
- `src/ar/ARRuntime.ts`がカメラ、AR.js tracking、平滑化、renderer、単一rAFを所有する。
- `src/ar/AvatarController.ts`がVRM/VRMA、AnimationMixer、表情、感情遷移を所有する。
- `src/ar/runtimeMath.ts`には投影補正、delta clamp、表示猶予などの純粋関数を置く。

描画順は必ず次を維持する。

1. AR.js tracking更新
2. マーカー姿勢の平滑化と表示猶予判定
3. AnimationMixerとVRM更新
4. Three.js render

旧`src/components/vrm-loader.js`、`vrm-animation.js`、
`vrm-animation-controller.js`、A-Frame要素、CDN import mapを復活させないこと。
Viteの`assert-single-three-runtime`がbundle内のThree.js複数実体を拒否する。

## Development Commands

```bash
npm ci
npm run type-check:client
npm run test:ar
npm run validate:vrma

cd server
npm ci
npm run type-check
cd ..

npm run build
```

ローカルカメラ確認はHTTPS環境またはVercel Previewを使う。静的HTTPサーバーへ
TypeScriptソースを直接配信しない。Vite成果物は`dist/client`へ生成される。

## AR Invariants

- avatar scaleはX/Y/Z共通の等方値だけを使う。
- humanoidのleftFoot/rightFootをマーカー面へ合わせ、存在しない場合だけBox3へfallbackする。
- neutralは先行ロードし、感情モーション終了後に必ずneutralへ戻す。
- background復帰後の大きなframe deltaをclampする。
- marker lost後は最後の姿勢を2.5秒保持し、チャット入力中は保持を延長する。
- videoのcover cropとcamera projectionを同じ比率で補正する。
- AR.js、video、MediaStream、VRM、renderer、イベントlistenerを`dispose()`で解放する。

## Validation and Release Gates

- `sad.vrma`はduration 0の既知破損資産であり、runtimeでは`VRMA_02.vrma`を使う。
- VRMA runtime資産のextension、duration、track、humanoid bone検証を通す。
- iPhone Safariでカメラ、マーカー再検出、縦横比、キーボード、30秒neutralを確認する。
- implemented / PR-ready / merged / deployed / live evidenceを分けて報告する。
- 実装とREADME/CLAUDE.mdが乖離する変更は同じPRで同期する。

## Performance and Security

- 目標30fps以上。初回bundleと17MB VRMは継続的な最適化対象。
- 秘密情報をクライアントbundleやログへ含めない。
- `Permissions-Policy: camera=(self)`等の既存ヘッダーを維持する。
- CSPはAR.js/Emscriptenのeval/blob互換を実ブラウザで確認してから追加する。

## Critical Files

変更前に`README.md`、`docs/adr/001-ar-viewport-projection-and-chat-overlay.md`、
関連Issue/PRを確認する。古いPhase文書のCDNコード例より、現在の`package.json`と
上記アーキテクチャを優先する。

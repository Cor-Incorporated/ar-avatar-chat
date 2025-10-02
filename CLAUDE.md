# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AR avatar chat application for Cor.Inc. - a technical demo for B2B partners featuring:
- AR marker detection using a penguin logo on business cards
- VRM avatar display with motion animations
- Built with A-Frame, AR.js, and three-vrm

**Target devices**: Mobile smartphones (iOS Safari 18+, Android Chrome 120+) with HTTPS required.

## Development Commands

### Local Development
```bash
# Start local server (from src/ directory)
python3 -m http.server 8000
# Access at http://localhost:8000/index.html

# OR use VS Code Live Server extension
# Right-click on src/index.html → "Open with Live Server"
```

### Testing
- **Desktop testing**: Use Chrome DevTools device emulation + printed Hiro marker
- **Mobile testing**: Deploy to HTTPS environment (ngrok/Glitch/Vercel) + printed business card marker
- **Performance check**: Chrome DevTools → Performance tab (target: 30fps+)

## Code Architecture

### Technology Stack
- **A-Frame 1.7.0**: WebVR framework for AR scene management
- **AR.js 3.4.7**: Marker-based AR tracking
- **Three.js 0.177.0**: 3D rendering engine
- **@pixiv/three-vrm 3.4.2**: VRM avatar loader and animation

### Component System
Custom A-Frame components are ES6 modules using import maps:

**`src/components/vrm-loader.js`**
- Loads VRM models using GLTFLoader + VRMLoaderPlugin
- Emits `vrm-loaded` event when ready
- Handles VRM updates in `tick()` function (required for three-vrm)
- Stores VRM instance at `this.vrm` for animation access

**`src/components/vrm-animation.js`**
- Listens for `vrm-loaded` event before loading animations
- Uses THREE.AnimationMixer for motion playback
- Supports `.vrma` (VRM Animation) format
- Provides `playAnimation()` method for external control (bypasses A-Frame lifecycle)
- Uses `ready` and `pendingPlay` flags to handle timing issues

### Integration Pattern
```html
<!-- A-Frame scene with AR.js -->
<a-scene arjs="..." vr-mode-ui="enabled: false">
  <!-- Custom marker detection -->
  <a-marker type="pattern" url="./assets/markers/penguin-marker.patt">
    <!-- VRM avatar entity -->
    <a-entity
      vrm-loader="src: ./assets/models/avatar.vrm"
      vrm-animation="src: ./assets/animations/jump.vrma; autoplay: true"
    ></a-entity>
  </a-marker>
</a-scene>
```

### Key Event Flow
1. **Marker detection**: `markerFound` → trigger animation playback
2. **VRM loading**: `vrm-loaded` → enable animation component
3. **Animation update**: `tick()` → update AnimationMixer and VRM

## Important Constraints

### Strictly Follow Development Instructions
- **DO NOT** deviate from library versions specified in `docs/01_開発指示書_Phase1-MVP.md`
- **DO NOT** change directory structure without PdM approval
- **DO NOT** skip steps or proceed with unresolved errors
- **DO** report to PdM at each checkpoint completion

### Code Quality
- Add Japanese comments for complex logic (development team preference)
- Handle errors with user-friendly status messages in `#info` div
- Test on actual devices, not just desktop emulation

### Performance Requirements
- Target FPS: 30+ on mobile
- VRM polygon count: ≤50,000
- Texture size: ≤2048px
- Marker detection range: 30cm-1m

### Asset Optimization
- Use VRoid Studio export settings: Texture 1024px, Low-Medium polygon reduction
- Compress VRM files if >10MB
- High-contrast marker images for reliable detection

## Project Phases

**Phase 1 ✅ (Completed - 2025-10-01)**: MVP with marker detection + VRM avatar + motion animation
- All implementation steps completed
- Debug logs removed and code refactored
- Desktop browser testing complete
- Ready for HTTPS deployment and mobile testing

**Phase 2 ✅ (Completed - 2025-10-02)**: LLM chat integration with Gemini 2.5 Flash + Google Calendar
- **Day 1 (2025-10-01)**: Proxy server + OAuth handler implementation complete
- **Day 2 Morning (2025-10-02)**: Function Calling + 博多弁tone implementation complete
- **Day 2 Afternoon (2025-10-02)**: クライアント統合完了（チャットUI + アニメーション制御）
- **Day 2 Evening (2025-10-02)**: 統合テスト成功 + リファクタリング完了 ✅
- Technical achievements:
  - Gemini 2.5 Flash + Structured Output方式実装（Function Callingと併用不可の制限を回避）
  - 博多弁キャラクター + 感情検出（7種類: neutral/happy/angry/sad/relaxed/surprised/thinking）
  - VRMアニメーション自動切り替え（感情連動）
  - VRM表情制御（@pixiv/three-vrm expressionManager）
  - ES Module対応（@google/genai v1.21.0）
  - チャットUI（モダンなグラデーションデザイン）

**Phase 3 ✅ (Completed - 2025-10-02)**: TypeScript migration + Mobile UI optimization
- **Day 1 (2025-10-02)**: TypeScript環境構築 + 型定義ファイル作成
- **Day 2 (2025-10-02)**: バックエンド完全TypeScript化 + ボトムシートUI実装
- Technical achievements:
  - **TypeScript環境構築**: tsconfig.json、型定義完備
  - **バックエンド完全TypeScript化**: server/をフル型安全化（index.ts、gemini.service.ts）
  - **段階的フロントエンド移行**: 新規コード（ボトムシートUI）のみTypeScript、既存A-FrameコンポーネントはJS維持
  - **ボトムシートUI実装**: モバイル最適化された3段階展開UI（collapsed/peek/expanded）
    - AR表示領域: 60% → 90%以上に拡大
    - ドラッグ&スワイプジェスチャー対応
    - レスポンシブデザイン（縦/横画面、タブレット対応）
    - ダークモード、アクセシビリティ対応
  - **Mastra準備**: AIエージェントフレームワーク環境構築（Phase 4で本格統合予定）
  - **コードリファクタリング**: 古いJSファイル削除、.gitignore更新
- **Current Status**: Phase 3 MVP完成 - TypeScript基盤 + モバイルUI完成
- **Next Phase**: Phase 4（音声会話 + リップシンク + Mastra完全統合）

## Critical Files

Before making changes, read:
1. `docs/01_開発指示書_Phase1-MVP.md` - Detailed implementation instructions with code examples
2. `docs/02_チェックリスト.md` - Progress tracking checklist
3. `README.md` - Project overview and team communication rules

The development instructions contain exact code templates and CDN versions - use them verbatim unless discussed with PdM.

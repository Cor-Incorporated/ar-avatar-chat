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

**Phase 2 🔄 (In Progress - Started 2025-10-01)**: LLM chat integration with Gemini 2.5 Flash + Google Calendar
- **Day 1 (2025-10-01)**: Proxy server + OAuth handler implementation complete
- **Day 2 Morning (2025-10-02)**: Function Calling + VRoid tone implementation complete
- **Day 2 Afternoon (2025-10-02)**: OAuth認証フロー + Calendar連携 + 博多弁実装完了 ✅
- Technical breakthrough:
  - Gemini 2.5 Flash + Function Calling完全動作
  - systemInstructionの正しい配置方法を確立（config内に配置）
  - 博多弁という自然言語制約の中でのFunction Calling発動成功
  - Temperature 0.5で博多弁の自然さとFunction Calling精度のバランス実現
- **Current Status**: OAuth + Function Calling + 博多弁キャラクター実装完了
- **Next**: クライアント統合（AR.jsとの連携）

## Critical Files

Before making changes, read:
1. `docs/01_開発指示書_Phase1-MVP.md` - Detailed implementation instructions with code examples
2. `docs/02_チェックリスト.md` - Progress tracking checklist
3. `README.md` - Project overview and team communication rules

The development instructions contain exact code templates and CDN versions - use them verbatim unless discussed with PdM.

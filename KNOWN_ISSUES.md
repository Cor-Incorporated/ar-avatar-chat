# 既知の課題（Known Issues）

## 🚨 優先度: 最高（Phase 8 対応中）

### モバイルARでマーカー相対位置ズレ・モデルの縦横比歪み

**発生日**: 2026-07-10 起票
**ステータス**: 対応中 — [Issue #36](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/36)

- アバターがマーカー直上の期待位置に出ない（横ズレ・下半身沈み込み）、モデルが極端に細く歪む
- 根本原因分析と修正方針: `docs/adr/001-ar-viewport-projection-and-chat-overlay.md`（投影行列とビューポートの不整合、bbox中心アンカー）
- 過去の対症療法（PR #15〜#31）の総括もADR参照

### チャット入力中にAR画面が押し上げられ／アバターが消失

**発生日**: 2026-07-10 起票
**ステータス**: 対応中 — [Issue #37](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/37)

- ソフトキーボード表示でAR画面が押し上げられアバターの挙動が見えない
- markerLost で即座にアバターが消え、会話中の感情モーションが視認できない
- 修正方針（継続visualViewport補正＋markerLost猶予）: ADR-001 / 実装指示: `docs/28_Phase8開発指示書_AR安定化とGemini3.1.md`

### 関連バックログ

- [Issue #38](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/38): Gemini 3.1 Flash-Lite GA化・単一呼び出し・会話履歴・カメラキャプチャ・添付UX可視化
- [Issue #39](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/39): MindAR移行調査 spike（下記「マーカー検出精度の制限」の中期対策）
- [Issue #40](https://github.com/Cor-Incorporated/ar-avatar-chat/issues/40): 音声会話フェーズ1（TTS読み上げ）

---

## 🚨 優先度: 高

### モバイル縦向きでのマーカー検出精度の制限

**発生日**: 2025-10-05  
**ステータス**: 調査中・継続改善

#### 症状
- PCでは30-40cmの距離で安定してマーカー検出が可能
- **モバイル縦向き（Portrait）では依然として検出距離が短い**
- 斜め角度での検出安定性が不十分
- デバイスや環境条件により検出性能が大きく変動

#### 現在の検出性能

| デバイス/条件          | 検出距離 | 安定性      |
|------------------|----------|-----------|
| PC（真上）           | 30-40cm  | ✅ 安定      |
| PC（斜め30度）        | 30-40cm  | ✅ 安定      |
| モバイル縦向き（真上）    | 15-25cm  | ⚠️ やや不安定 |
| モバイル縦向き（斜め30度） | 10-20cm  | ⚠️ 不安定   |
| モバイル縦向き（斜め45度） | 10cm以内 | ❌ 困難      |

#### 実装済みの最適化
1. ✅ 高解像度カメラ指定（1280x960）
2. ✅ labelingMode: black_region（斜め角度対応）
3. ✅ minConfidence動的調整（0.5→0.45→0.4）
4. ✅ Smoothing軽量化（smoothCount=5）
5. ✅ maxDetectionRate: 60fps
6. ✅ patternRatio: 0.80（マーカー生成時と一致）

#### 残る制約要因
1. **モバイルカメラのハードウェア制約**
   - 低性能なセンサー（特に古い機種）
   - オートフォーカスの遅延
   - 手ブレ補正の影響

2. **ブラウザ/OSの制約**
   - iOS Safariの省電力モード
   - Androidのカメラアクセス制限
   - WebRTCの実装差異

3. **AR.jsの技術的限界**
   - ARToolKit5ベースの検出アルゴリズム
   - WebXRネイティブAPIと比較して精度が低い
   - モバイル最適化に限界がある

#### 暫定対処
ユーザーガイドラインで以下を推奨：
- 📏 **距離**: 20-30cmでの使用（理想は30-40cm）
- 💡 **照明**: 明るく均一な環境
- 📐 **角度**: できるだけ真上から（最大45度まで）
- 📱 **デバイス**: iPhone 12以降、Galaxy S10以降の使用を推奨

#### デバッグ方法
```
URL: https://ar-avatar-chat.vercel.app/?debug=true

確認項目:
- [Camera] 実際の解像度が1280x960になっているか
- [Camera] フレームレートが25fps以上か
- [Marker] 推定距離のログを確認
- Stats表示でFPSを監視
```

#### 今後の改善案
1. **マーカーサイズの拡大**
   - 名刺上のペンギンロゴを5cm以上に
   - より遠距離からの検出を実現

2. **複数マーカー対応**
   - 名刺の表裏に異なるマーカー
   - 検出率の相互補完

3. **WebXR APIへの移行**（長期）
   - ブラウザネイティブARの活用
   - より高精度な検出を実現

4. **QRコードハイブリッド方式**
   - パターンマーカー + QRコードの併用
   - 初回検出をQRコードで補助

5. **機械学習ベースの検出**
   - TensorFlow.jsによる画像認識
   - AR.jsと併用して精度向上

#### 優先度
- **高**: B2Bデモの成功に直接影響
- 継続的な改善とテストが必要

#### 関連ドキュメント
- `docs/17_モバイル最適化_マーカー検出精度向上.md`
- `docs/21_緊急_モバイル縦向き検出問題の徹底対策.md`
- `docs/22_最終最適化_ベストプラクティス完全実装.md`
- `docs/マーカー生成情報.md`

---

## 🐛 優先度: 中

### thinkingアニメーションが動作しない

**発生日**: 2025-10-05  
**ステータス**: 未解決

#### 症状
- `window.playEmotion('thinking')`を実行すると、T字型のポーズのまま固まる
- 他の感情（happy, angry, sad, relaxed, surprised）は正常に動作

#### 考えられる原因
1. `VRMA_07.vrma`ファイルの破損または互換性の問題
2. 現在のVRMアバター（`avatar.vrm`）とVRMA_07のボーン構造が不一致
3. アニメーションクリップが空または不正なデータ

#### 調査方法
```javascript
// ブラウザコンソールで実行
const action = document.querySelector('#avatar').components['vrm-animation-controller'].actions['thinking'];
console.log('thinking action:', action);
console.log('clip:', action?._clip);
console.log('duration:', action?._clip?.duration);
```

#### 暫定対処
- 現時点では`thinking`感情を避けるか、他の感情で代替
- または`VRMA_07.vrma`を再生成・再エクスポート

#### 優先度
- **中**: デモ機能には影響しないが、UX向上のため修正が望ましい

---

## 📋 今後の調査タスク

### モバイル精度改善
- [ ] 異なるデバイスでの詳細テスト（解像度と検出距離の相関）
- [ ] マーカーサイズ拡大の検証（3-4cm → 5-6cm）
- [ ] 複数マーカー方式のプロトタイプ
- [ ] WebXR APIへの移行可能性調査
- [ ] QRコードハイブリッド方式の検証

### アニメーション改善
- [ ] VRMA_07.vrmaファイルの検証（VRMアニメーションビューアーで確認）
- [ ] 代替アニメーションファイルの用意
- [ ] ボーン構造の互換性チェック

---

**作成日**: 2025-10-05  
**最終更新**: 2026-07-10（Phase 8: AR表示・チャット安定性のクリティカル課題を追加、Issue #36〜#40 起票）


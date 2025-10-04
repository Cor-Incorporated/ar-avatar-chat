# 既知の課題（Known Issues）

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

- [ ] VRMA_07.vrmaファイルの検証（VRMアニメーションビューアーで確認）
- [ ] 代替アニメーションファイルの用意
- [ ] ボーン構造の互換性チェック

---

**作成日**: 2025-10-05  
**最終更新**: 2025-10-05


# Frontend - Share Motti

AI音声対話機能を持つ学習支援アプリケーションのフロントエンド

## 🛠️ **技術スタック**

- **React 18** + **TypeScript**
- **Vite** (ビルドツール)
- **React Router** (ルーティング)
- **React Three Fiber** (3Dモデル表示)
- **OpenAI Realtime API** (音声対話)

## 🚀 **ローカル開発セットアップ**

### 1. 依存関係のインストール

```bash
cd frontend
npm install
```

### 2. 環境変数の設定

```bash
# .envファイルを作成
cp env.example .env
```

`.env`ファイルを編集（ローカル開発用の設定は既に適切）：

```bash
# Frontend Configuration (Local Development)
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### 3. バックエンドの起動

**重要**: フロントエンドを起動する前に、必ずバックエンドを先に起動してください：

```bash
# 別のターミナルで
cd ../backend
npm run dev
```

### 4. 開発サーバー起動

```bash
# 開発モード（ホットリロード）
npm run dev

# プレビューモード（本番ビルドをテスト）
npm run build && npm run preview
```

開発サーバーが起動すると：
- **開発**: `http://localhost:5173`
- **プレビュー**: `http://localhost:4173`

## 🎯 **主な機能**

### 📚 ページ構成
- **Home** (`/`) - ダッシュボード・学習記録表示
- **Study Settings** (`/study-settings`) - 学習設定
- **Study** (`/study`) - 学習ページ（3Dモデル + 教材表示）
- **Break** (`/break`) - 休憩ページ（AI音声対話）
- **Materials** (`/materials`) - 教材管理

### 🤖 3Dキャラクター
- **TalkAnimation**: 会話用アニメーション（Home, Break）
- **StudyAnimation**: 学習用アニメーション（Study）
- GLBファイル: `src/assets/udemy_test.glb`, `udemy_test2.glb`

### 🎙️ AI音声対話機能
- **OpenAI Realtime API**による音声対話
- **WebRTC**でのリアルタイム音声処理
- 自動接続・切断管理

## 🔧 **開発用コマンド**

```bash
# 開発サーバー起動
npm run dev

# 型チェック
npm run type-check

# リント実行
npm run lint

# リント自動修正
npm run lint:fix

# テスト実行
npm run test

# テスト（ウォッチモード）
npm run test:watch

# カバレッジ計測
npm run coverage

# 本番ビルド
npm run build

# プレビュー（ビルド後）
npm run preview
```

## 🗂️ **プロジェクト構成**

```
frontend/
├── public/
│   ├── Kao1.png              # 画像アセット
│   └── vite.svg
├── src/
│   ├── assets/
│   │   ├── udemy_test.glb    # 3Dモデル（Talk用）
│   │   └── udemy_test2.glb   # 3Dモデル（Study用）
│   ├── components/
│   │   ├── FileExplorer.tsx  # ファイル選択UI
│   │   ├── Material3D.tsx    # 3D教材表示
│   │   ├── StudyAnimation.tsx # 学習用3Dアニメーション
│   │   └── TalkAnimation.tsx  # 会話用3Dアニメーション
│   ├── pages/
│   │   ├── Home.tsx          # ホームページ
│   │   ├── Study.tsx         # 学習ページ
│   │   ├── StudySettings.tsx # 学習設定
│   │   ├── Break.tsx         # 休憩ページ
│   │   └── Materials.tsx     # 教材管理
│   ├── services/
│   │   └── firebaseMaterials.ts # Firebase API呼び出し
│   ├── config/
│   │   └── api.ts            # API設定
│   ├── hooks/
│   │   └── useSecurityRestrictions.ts # セキュリティ制限
│   └── constants/
│       └── cameraPositions.ts # 3Dカメラ位置
├── vercel.json               # Vercel デプロイ設定
└── vite.config.ts            # Vite 設定
```

## 🎨 **UI/UX 特徴**

### デザインシステム
- **グラスモーフィズム**: 半透明・ブラー効果
- **グラデーション**: 美しい背景グラデーション
- **アニメーション**: スムーズなトランジション
- **レスポンシブ**: モバイル対応

### 3Dインタラクション
- **WebGL**: React Three Fiberによる3D表示
- **リアルタイム**: 音声に合わせたアニメーション
- **最適化**: カメラ位置・ライティング調整済み

## 🔍 **トラブルシューティング**

### バックエンド接続エラー
```
Access to fetch at 'http://localhost:3001/...' has been blocked by CORS policy
```
→ バックエンド（`http://localhost:3001`）が起動しているか確認

### 3Dモデル読み込みエラー
```
Could not load /udemy_test.glb: 404
```
→ GLBファイルが`src/assets/`に正しく配置されているか確認

### 音声対話エラー
```
WebRTC connection error: Failed to fetch
```
→ OpenAI API キーがバックエンドで正しく設定されているか確認

### 型エラー
```
Type 'unknown' is not assignable to type 'string'
```
→ `npm run type-check`で型定義を確認

## 📦 **ビルドとデプロイ**

### Vercelデプロイ
1. `vercel.json`でSPAルーティング設定済み
2. 環境変数を本番用に設定：
   ```
   VITE_API_URL=https://your-backend-url.onrender.com
   VITE_WS_URL=wss://your-backend-url.onrender.com
   ```

### 最適化
- **コード分割**: ルートレベルでの自動分割
- **アセット最適化**: Viteによる自動最適化
- **GLBファイル**: ViteのアセットとしてハッシュURL生成

## 🚀 **開発のヒント**

- **ホットリロード**: ファイル保存時に即座に反映
- **TypeScript**: 型安全性でバグを事前防止
- **ESLint**: コード品質の自動チェック
- **開発者ツール**: React DevToolsでコンポーネント検査可能
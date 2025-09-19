# Backend - Share Motti

AI音声対話機能を持つ学習支援アプリケーションのバックエンドAPI

## 🛠️ **技術スタック**

- **Node.js** + **Express.js**
- **Firebase Admin SDK** (Firestore, Storage)
- **OpenAI Realtime API** (音声対話)
- **WebSocket** (リアルタイム通信)

## 🚀 **ローカル開発セットアップ**

### 1. 依存関係のインストール

```bash
cd backend
npm install
```

### 2. 環境変数の設定

```bash
# .envファイルを作成
cp env.example .env
```

`.env`ファイルを編集して必要な値を設定：

```bash
# Backend Configuration (Local Development)
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# OpenAI Configuration (必須)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-realtime

# Firebase Configuration (必須)
FIREBASE_PROJECT_ID=engineer-guild-hackason
FIREBASE_PRIVATE_KEY_ID=your_private_key_id_from_json
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_from_json\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@engineer-guild-hackason.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your_client_id_from_json
```

### 3. Firebase設定
いずれかで動きます。Firebaseでプロジェクトを作成後、DBとStorageを作成してください：

**Option A**: 環境変数で設定（推奨・本番環境対応）
- 上記の`FIREBASE_*`環境変数を設定

**Option B**: ファイルで設定（開発環境のみ）
- `config/firebase-admin-key.json`ファイルを配置

### 4. Google Cloud CORS設定（Firebase Storage用）

Firebase Storageへのクロスオリジンアクセスを許可するため、CORS設定が必要です：

```bash
# Google Cloud CLIをインストール・認証
gcloud auth login

# プロジェクトを設定
gcloud config set project your-firebase-project-id

# CORS設定を適用（ルートディレクトリのcors.jsonを使用）
gsutil cors set ../cors.json gs://your-firebase-project-id.firebasestorage.app
```

**cors.jsonの内容例:**
```json
[
  {
    "origin": ["http://localhost:5173", "https://your-vercel-app.vercel.app"],
    "method": ["GET","POST","PUT","DELETE"],
    "maxAgeSeconds": 3600
  }
]
```

### 5. 開発サーバー起動

```bash
# 開発モード（ホットリロード）
npm run dev

# 本番モード
npm start
```

サーバーが起動すると以下のようなログが表示されます：

```
✅ Firebase初期化成功（環境変数から）
🔥 Firebase初期化完了
Backend running on http://localhost:3001
WebSocket server ready on ws://localhost:3001
🔥 Firebase Materials API: http://localhost:3001/api/firebase-materials
🧪 Firebase Test API: http://localhost:3001/api/firebase-test/connection
```

## 📡 **API エンドポイント**

### 認証・セッション
- `POST /session/create` - WebRTCセッション作成
- `GET /session/:sessionId` - セッション情報取得

### Firebase教材管理
- `GET /api/firebase-materials/folders` - フォルダ一覧取得
- `POST /api/firebase-materials/upload` - ファイルアップロード
- `GET /api/firebase-materials/file/:fileId` - ファイル取得

### AI音声対話
- `WebSocket ws://localhost:3001` - OpenAI Realtime API経由の音声対話

### テスト用エンドポイント
- `GET /api/firebase-test/connection` - Firebase接続テスト

## 🔧 **CORS設定**

以下のオリジンからのアクセスを許可：
- `http://localhost:5173` (Vite dev)
- `http://localhost:5174` (Vite dev alt)
- `http://localhost:4173` (Vite preview)
- `http://localhost:3000` (其他)
- `yudais-projects-833f764f.vercel.app`ドメインパターン

## 🗂️ **プロジェクト構成**

```
backend/
├── config/
│   ├── firebase.js              # Firebase初期化
│   └── firebase-admin-key.json  # Firebase秘密鍵（.gitignore）
├── routes/
│   ├── ai.js                    # AI音声対話API
│   ├── firebase-materials.js    # 教材管理API
│   ├── firebase-test.js         # テスト用API
│   ├── session.js               # セッション管理
│   ├── study.js                 # 学習記録API
│   └── user.js                  # ユーザー管理API
├── websocket/
│   └── realtime-handler.js      # WebSocket処理
├── server.js                    # メインサーバー
└── package.json
```

## 🔍 **トラブルシューティング**

### Firebase接続エラー
```
❌ 必須の環境変数が設定されていません: FIREBASE_PROJECT_ID
```
→ `.env`ファイルでFirebase環境変数を正しく設定してください

### OpenAI API エラー
```
WebRTC connection error: 401 Unauthorized
```
→ `OPENAI_API_KEY`が正しく設定されているか確認してください

### CORS エラー
```
Access to fetch at 'http://localhost:3001/...' has been blocked by CORS policy
```
→ フロントエンドのURLが`allowedOrigins`に含まれているか確認してください

### Firebase Storage CORS エラー
```
Access to fetch at 'https://firebasestorage.googleapis.com/...' has been blocked by CORS policy
```
→ Google Cloud CLIで`cors.json`を適用してください：
```bash
gsutil cors set cors.json gs://your-project-id.firebasestorage.app
```

## 📝 **開発のヒント**

- **ホットリロード**: `npm run dev`を使うとファイル変更時に自動リスタート
- **ログ確認**: コンソールに詳細なFirebase初期化ログが表示されます
- **API テスト**: `http://localhost:3001/api/firebase-test/connection`でFirebase接続をテスト可能

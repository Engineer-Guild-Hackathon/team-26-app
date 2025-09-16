# Firebase Materials API ドキュメント

## 概要

Firebase Materials APIは、教材の階層フォルダ管理とファイル管理を行うRESTful APIです。

- **Firebase Firestore**: フォルダ・ファイルメタデータ管理
- **Firebase Cloud Storage**: 画像ファイルストレージ
- **無制限階層**: ネストフォルダ対応
- **ユーザー分離**: `X-User-ID`ヘッダーによる権限管理

## 階層構造管理

### データ構造

```javascript
// フォルダ (materials_folders コレクション)
{
  id: "auto-generated-id",
  name: "フォルダ名",
  parentId: "parent-folder-id" | null,  // null = ルートフォルダ
  path: "親フォルダ/子フォルダ/現在フォルダ",     // 自動生成パス
  level: 0,                              // 階層レベル (0=ルート)
  userId: "user-id",
  createdAt: Date,
  updatedAt: Date
}

// ファイル (materials コレクション)
{
  id: "auto-generated-id",
  name: "ファイル名.txt",
  extension: "txt",
  type: "text" | "image",
  content: "テキスト内容" | undefined,
  storagePath: "storage/path" | undefined,
  downloadURL: "signed-url" | undefined,
  folderId: "folder-id",
  userId: "user-id",
  createdAt: Date,
  updatedAt: Date
}
```

### 階層管理ロジック

1. **パス自動生成**: `buildFolderPath(db, parentId, folderName)`
   - 親フォルダから再帰的にパスを構築
   - 例: `数学フォルダ/微分積分学/実践問題`

2. **レベル自動計算**: `getFolderLevel(db, parentId)`
   - 親フォルダのレベル + 1
   - ルートフォルダ = level 0

3. **子フォルダ検索**: `parentId`による階層クエリ
   - ルート: `parentId == null`
   - 子: `parentId == "specific-folder-id"`

## API エンドポイント

### 🔥 Firebase接続テスト

#### GET `/api/firebase-test/connection`
Firebase接続状況を確認

```bash
curl -X GET http://localhost:3001/api/firebase-test/connection
```

**レスポンス例:**
```json
{
  "success": true,
  "message": "Firebase接続テスト完了",
  "firestore": { "connected": true },
  "storage": { "connected": true, "bucketName": "project.firebasestorage.app" }
}
```

---

### 📁 フォルダ管理

#### POST `/api/firebase-materials/folders`
フォルダ作成

**ヘッダー:**
- `Content-Type: application/json`
- `X-User-ID: user-id`

**ボディ:**
```json
{
  "name": "フォルダ名",
  "parentId": "parent-folder-id"  // オプショナル、null でルートフォルダ
}
```

**テストコマンド:**
```bash
# ルートフォルダ作成
curl -X POST http://localhost:3001/api/firebase-materials/folders \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"name":"数学フォルダ"}'

# サブフォルダ作成
curl -X POST http://localhost:3001/api/firebase-materials/folders \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"name":"微分積分学","parentId":"W3lc3KIK9M1CzlhHCzoQ"}'
```

#### GET `/api/firebase-materials/folders`
フォルダ一覧取得

**クエリパラメータ:**
- `parentId`: 指定フォルダの子フォルダのみ取得（省略時はルートフォルダ）

**テストコマンド:**
```bash
# ルートフォルダ一覧
curl -H "X-User-ID: test-user" \
  "http://localhost:3001/api/firebase-materials/folders"

# 特定フォルダの子フォルダ一覧
curl -H "X-User-ID: test-user" \
  "http://localhost:3001/api/firebase-materials/folders?parentId=W3lc3KIK9M1CzlhHCzoQ"
```

#### PUT `/api/firebase-materials/folders/:folderId`
フォルダ名変更

**テストコマンド:**
```bash
curl -X PUT http://localhost:3001/api/firebase-materials/folders/HOGORLfoQv2jrOsAssI9 \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"name":"微分積分学"}'
```

#### DELETE `/api/firebase-materials/folders/:folderId`
フォルダ削除（子フォルダ・ファイルも再帰削除）

**テストコマンド:**
```bash
curl -X DELETE http://localhost:3001/api/firebase-materials/folders/folder-id \
  -H "X-User-ID: test-user"
```

---

### 📄 ファイル管理

#### POST `/api/firebase-materials/text`
テキストファイル作成

**ボディ:**
```json
{
  "name": "ファイル名",
  "content": "テキスト内容",
  "folderId": "folder-id"
}
```

**テストコマンド:**
```bash
curl -X POST http://localhost:3001/api/firebase-materials/text \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"name":"微分の基礎","content":"微分とは瞬間変化率を求める計算手法です。","folderId":"HOGORLfoQv2jrOsAssI9"}'
```

#### POST `/api/firebase-materials/upload`
画像ファイルアップロード

**ボディ:** `multipart/form-data`
- `file`: アップロードファイル
- `folderId`: 保存先フォルダID

**テストコマンド:**
```bash
curl -X POST http://localhost:3001/api/firebase-materials/upload \
  -H "X-User-ID: test-user" \
  -F "file=@/path/to/image.jpg" \
  -F "folderId=folder-id"
```

#### GET `/api/firebase-materials/folders/:folderId/files`
フォルダ内ファイル一覧

**テストコマンド:**
```bash
curl -H "X-User-ID: test-user" \
  "http://localhost:3001/api/firebase-materials/folders/HOGORLfoQv2jrOsAssI9/files"
```

#### GET `/api/firebase-materials/files/:materialId/content`
テキストファイル内容取得

**テストコマンド:**
```bash
curl -H "X-User-ID: test-user" \
  "http://localhost:3001/api/firebase-materials/files/iWSqnHr9r3ytt2yGiK65/content"
```

#### PUT `/api/firebase-materials/files/:materialId/content`
テキストファイル内容更新

**テストコマンド:**
```bash
curl -X PUT http://localhost:3001/api/firebase-materials/files/iWSqnHr9r3ytt2yGiK65/content \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"content":"更新されたテキスト内容"}'
```

#### DELETE `/api/firebase-materials/files/:materialId`
ファイル削除

**テストコマンド:**
```bash
curl -X DELETE http://localhost:3001/api/firebase-materials/files/file-id \
  -H "X-User-ID: test-user"
```

---

## 完全テストシナリオ

```bash
# 1. Firebase接続確認
curl -X GET http://localhost:3001/api/firebase-test/connection

# 2. ルートフォルダ作成
curl -X POST http://localhost:3001/api/firebase-materials/folders \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"name":"数学フォルダ"}'

# 3. フォルダ一覧確認
curl -H "X-User-ID: test-user" \
  "http://localhost:3001/api/firebase-materials/folders"

# 4. サブフォルダ作成（親IDを上記レスポンスから取得）
curl -X POST http://localhost:3001/api/firebase-materials/folders \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"name":"微積分","parentId":"PARENT_FOLDER_ID"}'

# 5. テキストファイル作成
curl -X POST http://localhost:3001/api/firebase-materials/text \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"name":"微分の基礎","content":"微分とは瞬間変化率を求める計算手法です。","folderId":"FOLDER_ID"}'

# 6. ファイル一覧確認
curl -H "X-User-ID: test-user" \
  "http://localhost:3001/api/firebase-materials/folders/FOLDER_ID/files"

# 7. ファイル内容確認
curl -H "X-User-ID: test-user" \
  "http://localhost:3001/api/firebase-materials/files/FILE_ID/content"

# 8. ファイル内容更新
curl -X PUT http://localhost:3001/api/firebase-materials/files/FILE_ID/content \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{"content":"更新されたテキスト内容"}'
```

## 設定要件

### 環境変数 (`.env`)
```bash
OPENAI_API_KEY=your-openai-api-key
FRONTEND_URL=http://localhost:5173
PORT=3001
```

### Firebase設定
- `config/firebase-admin-key.json`: Firebase Admin SDK秘密鍵
- Firestore Database有効化
- Cloud Storage バケット作成

### 必要パッケージ
```bash
npm install firebase-admin multer uuid express
```

---

## エラーコード

- `400`: 不正なリクエスト（必須パラメータ不足）
- `403`: アクセス権限なし（ユーザーID不一致）
- `404`: リソースが見つからない
- `500`: サーバーエラー（Firebase接続問題等）

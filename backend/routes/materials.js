const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// 教材保存用ディレクトリ
const MATERIALS_DIR = path.join(__dirname, '../uploads/materials');

// ディレクトリ作成（存在しない場合）
async function ensureDirectoryExists(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Multer設定（ファイルアップロード用）
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const folderName = req.body.folder || 'default';
    const folderPath = path.join(MATERIALS_DIR, folderName);
    
    try {
      await ensureDirectoryExists(folderPath);
      cb(null, folderPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // 日本語ファイル名対応
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const timestamp = Date.now();
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

// ファイルタイプフィルター
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.txt', '.jpeg', '.jpg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('許可されていないファイル形式です。(.txt, .jpeg, .jpg, .png のみ)'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB制限
  }
});

// 初期化
(async () => {
  await ensureDirectoryExists(MATERIALS_DIR);
})();

// フォルダ一覧取得
router.get('/folders', async (req, res) => {
  try {
    const items = await fs.readdir(MATERIALS_DIR, { withFileTypes: true });
    const folders = items
      .filter(item => item.isDirectory())
      .map(item => ({
        name: item.name,
        path: item.name
      }));
    
    res.json({ folders });
  } catch (error) {
    console.error('フォルダ一覧取得エラー:', error);
    res.status(500).json({ error: 'フォルダ一覧の取得に失敗しました' });
  }
});

// 指定フォルダ内のファイル一覧取得
router.get('/folders/:folderName/files', async (req, res) => {
  try {
    const { folderName } = req.params;
    const folderPath = path.join(MATERIALS_DIR, folderName);
    
    // セキュリティチェック（パストラバーサル攻撃防止）
    if (!folderPath.startsWith(MATERIALS_DIR)) {
      return res.status(400).json({ error: '不正なパスです' });
    }
    
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    const files = items
      .filter(item => item.isFile())
      .map(item => {
        const ext = path.extname(item.name).toLowerCase();
        return {
          name: item.name,
          path: path.join(folderName, item.name),
          type: ext === '.txt' ? 'text' : 'image',
          extension: ext
        };
      });
    
    res.json({ files });
  } catch (error) {
    console.error('ファイル一覧取得エラー:', error);
    res.status(500).json({ error: 'ファイル一覧の取得に失敗しました' });
  }
});

// フォルダ作成
router.post('/folders', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'フォルダ名が必要です' });
    }
    
    // フォルダ名の検証（特殊文字制限）
    if (!/^[a-zA-Z0-9_\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(name)) {
      return res.status(400).json({ error: '無効なフォルダ名です' });
    }
    
    const folderPath = path.join(MATERIALS_DIR, name);
    await ensureDirectoryExists(folderPath);
    
    res.json({ 
      message: 'フォルダが作成されました',
      folder: { name, path: name }
    });
  } catch (error) {
    console.error('フォルダ作成エラー:', error);
    res.status(500).json({ error: 'フォルダの作成に失敗しました' });
  }
});

// ファイルアップロード
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }
    
    const file = {
      name: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path.replace(MATERIALS_DIR, '').replace(/^[\/\\]/, ''),
      type: path.extname(req.file.filename).toLowerCase() === '.txt' ? 'text' : 'image',
      size: req.file.size,
      folder: req.body.folder || 'default'
    };
    
    res.json({ 
      message: 'ファイルがアップロードされました',
      file
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    res.status(500).json({ error: 'ファイルのアップロードに失敗しました' });
  }
});

// ファイル内容取得（テキストファイル用）
router.get('/files/:folderName/:fileName/content', async (req, res) => {
  try {
    const { folderName, fileName } = req.params;
    const filePath = path.join(MATERIALS_DIR, folderName, fileName);
    
    // セキュリティチェック
    if (!filePath.startsWith(MATERIALS_DIR)) {
      return res.status(400).json({ error: '不正なパスです' });
    }
    
    // ファイル存在チェック
    await fs.access(filePath);
    
    // テキストファイルのみ内容を返す
    const ext = path.extname(fileName).toLowerCase();
    if (ext !== '.txt') {
      return res.status(400).json({ error: 'テキストファイルではありません' });
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (error) {
    console.error('ファイル内容取得エラー:', error);
    res.status(500).json({ error: 'ファイル内容の取得に失敗しました' });
  }
});

// ファイル配信（画像ファイル用）
router.get('/files/:folderName/:fileName', async (req, res) => {
  try {
    const { folderName, fileName } = req.params;
    const filePath = path.join(MATERIALS_DIR, folderName, fileName);
    
    // セキュリティチェック
    if (!filePath.startsWith(MATERIALS_DIR)) {
      return res.status(400).json({ error: '不正なパスです' });
    }
    
    // ファイル存在チェック
    await fs.access(filePath);
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('ファイル配信エラー:', error);
    res.status(404).json({ error: 'ファイルが見つかりません' });
  }
});

// ファイル削除
router.delete('/files/:folderName/:fileName', async (req, res) => {
  try {
    const { folderName, fileName } = req.params;
    const filePath = path.join(MATERIALS_DIR, folderName, fileName);
    
    // セキュリティチェック
    if (!filePath.startsWith(MATERIALS_DIR)) {
      return res.status(400).json({ error: '不正なパスです' });
    }
    
    await fs.unlink(filePath);
    res.json({ message: 'ファイルが削除されました' });
  } catch (error) {
    console.error('ファイル削除エラー:', error);
    res.status(500).json({ error: 'ファイルの削除に失敗しました' });
  }
});

// フォルダ削除
router.delete('/folders/:folderName', async (req, res) => {
  try {
    const { folderName } = req.params;
    const folderPath = path.join(MATERIALS_DIR, folderName);
    
    // セキュリティチェック
    if (!folderPath.startsWith(MATERIALS_DIR)) {
      return res.status(400).json({ error: '不正なパスです' });
    }
    
    // フォルダとその中身を削除
    await fs.rmdir(folderPath, { recursive: true });
    res.json({ message: 'フォルダが削除されました' });
  } catch (error) {
    console.error('フォルダ削除エラー:', error);
    res.status(500).json({ error: 'フォルダの削除に失敗しました' });
  }
});

module.exports = router;
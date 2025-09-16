const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getFirestore, getStorage, admin } = require('../config/firebase');
const router = express.Router();

// Firebase サービス取得
const db = getFirestore();
const bucket = getStorage().bucket();

// Multer設定（メモリストレージ使用）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB制限
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.jpeg', '.jpg', '.png'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('許可されていないファイル形式です。(.txt, .jpeg, .jpg, .png のみ)'));
    }
  }
});

// ユーザーID取得ミドルウェア（簡易版）
const getUserId = (req, res, next) => {
  // 実際の実装では認証トークンから取得
  req.userId = req.headers['x-user-id'] || 'demo-user';
  next();
};

// フォルダパス構築（ネスト対応）
async function buildFolderPath(parentId, folderName) {
  try {
    const parentDoc = await db.collection('users').doc('demo-user')
                             .collection('folders').doc(parentId).get();
    
    if (!parentDoc.exists) {
      return folderName;
    }
    
    const parentData = parentDoc.data();
    return `${parentData.path}/${folderName}`;
  } catch (error) {
    console.error('パス構築エラー:', error);
    return folderName;
  }
}

// フォルダ階層レベル取得
async function getFolderLevel(parentId) {
  try {
    const parentDoc = await db.collection('users').doc('demo-user')
                             .collection('folders').doc(parentId).get();
    
    if (!parentDoc.exists) {
      return 0;
    }
    
    const parentData = parentDoc.data();
    return parentData.level || 0;
  } catch (error) {
    console.error('レベル取得エラー:', error);
    return 0;
  }
}

// フォルダ一覧取得（階層対応）
router.get('/folders', getUserId, async (req, res) => {
  try {
    const { parentId } = req.query; // 特定の親フォルダの子を取得
    
    const foldersRef = db.collection('users').doc(req.userId).collection('folders');
    let query = foldersRef;
    
    // 親IDが指定されている場合はその子のみ、未指定の場合はルートのみ
    if (parentId) {
      query = query.where('parentId', '==', parentId);
    } else {
      query = query.where('parentId', '==', null);
    }
    
    const snapshot = await query.get();
    
    const folders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      folders.push({
        id: doc.id,
        name: data.name,
        parentId: data.parentId,
        path: data.path,
        level: data.level || 0,
        hasChildren: false, // 後で子の有無をチェック
        ...data
      });
    });
    
    // 各フォルダに子があるかチェック
    for (let folder of folders) {
      const childQuery = foldersRef.where('parentId', '==', folder.id).limit(1);
      const childSnapshot = await childQuery.get();
      folder.hasChildren = !childSnapshot.empty;
    }
    
    res.json({ folders });
  } catch (error) {
    console.error('フォルダ一覧取得エラー:', error);
    res.status(500).json({ error: 'フォルダ一覧の取得に失敗しました' });
  }
});

// 指定フォルダ内のファイル一覧取得
router.get('/folders/:folderId/files', getUserId, async (req, res) => {
  try {
    const { folderId } = req.params;
    
    const materialsRef = db.collection('users').doc(req.userId).collection('materials');
    const snapshot = await materialsRef.where('folderId', '==', folderId).get();
    
    const files = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      files.push({
        id: doc.id,
        name: data.name,
        path: `${folderId}/${data.name}`,
        type: data.type,
        extension: data.extension,
        downloadUrl: data.downloadUrl,
        size: data.size
      });
    });
    
    res.json({ files });
  } catch (error) {
    console.error('ファイル一覧取得エラー:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      userId: req.userId,
      folderId: req.params.folderId
    });
    res.status(500).json({ 
      error: 'ファイル一覧の取得に失敗しました',
      details: error.message 
    });
  }
});

// フォルダ作成
router.post('/folders', getUserId, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'フォルダ名が必要です' });
    }
    
    // フォルダ名の検証
    if (!/^[a-zA-Z0-9_\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(name)) {
      return res.status(400).json({ error: '無効なフォルダ名です' });
    }
    
    const { parentId } = req.body; // 親フォルダID（オプション）
    
    const folderData = {
      name,
      parentId: parentId || null, // 親フォルダID（ルートの場合はnull）
      path: parentId ? await buildFolderPath(parentId, name) : name, // フルパス
      level: parentId ? await getFolderLevel(parentId) + 1 : 0, // 階層レベル
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: req.userId
    };
    
    const docRef = await db.collection('users').doc(req.userId)
                          .collection('folders').add(folderData);
    
    res.json({ 
      message: 'フォルダが作成されました',
      folder: { id: docRef.id, name, path: name }
    });
  } catch (error) {
    console.error('フォルダ作成エラー:', error);
    res.status(500).json({ error: 'フォルダの作成に失敗しました' });
  }
});

// ファイルアップロード
router.post('/upload', upload.single('file'), getUserId, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }
    
    const { folderId } = req.body;
    if (!folderId) {
      return res.status(400).json({ error: 'フォルダIDが必要です' });
    }
    
    // フォルダ存在確認
    const folderDoc = await db.collection('users').doc(req.userId)
                             .collection('folders').doc(folderId).get();
    if (!folderDoc.exists) {
      return res.status(404).json({ error: 'フォルダが見つかりません' });
    }
    
    // ファイル情報
    const materialId = uuidv4();
    const ext = require('path').extname(req.file.originalname);
    const fileName = `${materialId}${ext}`;
    const filePath = `users/${req.userId}/materials/${fileName}`;
    
    // Firebase Storageにアップロード
    const fileRef = bucket.file(filePath);
    const stream = fileRef.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          originalName: req.file.originalname,
          folderId: folderId,
          userId: req.userId
        }
      }
    });
    
    await new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.end(req.file.buffer);
    });
    
    // ダウンロードURLを取得
    const [downloadUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: '03-01-2030' // 長期間有効なURL
    });
    
    // Firestoreにメタデータ保存
    const materialData = {
      name: req.file.originalname,
      type: ext.toLowerCase() === '.txt' ? 'text' : 'image',
      extension: ext,
      folderId: folderId,
      storageUrl: `gs://${bucket.name}/${filePath}`,
      downloadUrl: downloadUrl,
      size: req.file.size,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      userId: req.userId
    };
    
    // テキストファイルの場合は内容もFirestoreに保存
    if (materialData.type === 'text') {
      materialData.content = req.file.buffer.toString('utf-8');
    }
    
    await db.collection('users').doc(req.userId)
           .collection('materials').doc(materialId).set(materialData);
    
    res.json({ 
      message: 'ファイルがアップロードされました',
      file: {
        id: materialId,
        name: req.file.originalname,
        type: materialData.type,
        size: req.file.size,
        downloadUrl: downloadUrl
      }
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    res.status(500).json({ error: 'ファイルのアップロードに失敗しました' });
  }
});

// テキストファイル内容取得
router.get('/files/:materialId/content', getUserId, async (req, res) => {
  try {
    const { materialId } = req.params;
    
    // Firestoreからメタデータ取得
    const materialDoc = await db.collection('users').doc(req.userId)
                               .collection('materials').doc(materialId).get();
    
    if (!materialDoc.exists) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }
    
    const materialData = materialDoc.data();
    
    if (materialData.type !== 'text') {
      return res.status(400).json({ error: 'テキストファイルではありません' });
    }
    
    // Firebase Storageからファイル内容を取得
    const filePath = materialData.storageUrl.replace(`gs://${bucket.name}/`, '');
    const file = bucket.file(filePath);
    
    const [content] = await file.download();
    
    res.json({ content: content.toString('utf-8') });
  } catch (error) {
    console.error('ファイル内容取得エラー:', error);
    res.status(500).json({ error: 'ファイル内容の取得に失敗しました' });
  }
});

// テキストファイル内容更新
router.put('/files/:materialId/content', getUserId, async (req, res) => {
  try {
    const { materialId } = req.params;
    const { content } = req.body;
    
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'テキスト内容が必要です' });
    }
    
    // Firestoreからメタデータ取得
    const materialRef = db.collection('users').doc(req.userId)
                          .collection('materials').doc(materialId);
    const materialDoc = await materialRef.get();
    
    if (!materialDoc.exists) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }
    
    const materialData = materialDoc.data();
    
    if (materialData.type !== 'text') {
      return res.status(400).json({ error: 'テキストファイルではありません' });
    }
    
    // テキストファイルの場合はFirestoreに直接保存
    await materialRef.update({
      content: content,
      size: Buffer.byteLength(content, 'utf8'),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ 
      message: 'ファイル内容が更新されました',
      file: {
        id: materialId,
        name: materialData.name,
        content: content,
        size: Buffer.byteLength(content, 'utf8')
      }
    });
  } catch (error) {
    console.error('ファイル内容更新エラー:', error);
    res.status(500).json({ error: 'ファイル内容の更新に失敗しました' });
  }
});

// ファイル削除
router.delete('/files/:materialId', getUserId, async (req, res) => {
  try {
    const { materialId } = req.params;
    
    // Firestoreからメタデータ取得
    const materialDoc = await db.collection('users').doc(req.userId)
                               .collection('materials').doc(materialId).get();
    
    if (!materialDoc.exists) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }
    
    const materialData = materialDoc.data();
    
    // Firebase Storageからファイル削除
    const filePath = materialData.storageUrl.replace(`gs://${bucket.name}/`, '');
    await bucket.file(filePath).delete();
    
    // Firestoreからメタデータ削除
    await materialDoc.ref.delete();
    
    res.json({ message: 'ファイルが削除されました' });
  } catch (error) {
    console.error('ファイル削除エラー:', error);
    res.status(500).json({ error: 'ファイルの削除に失敗しました' });
  }
});

// フォルダ名更新
router.put('/folders/:folderId', getUserId, async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'フォルダ名が必要です' });
    }
    
    // フォルダ名の検証
    if (!/^[a-zA-Z0-9_\-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+$/.test(name)) {
      return res.status(400).json({ error: '無効なフォルダ名です' });
    }
    
    const folderRef = db.collection('users').doc(req.userId)
                       .collection('folders').doc(folderId);
    
    // フォルダ存在確認
    const folderDoc = await folderRef.get();
    if (!folderDoc.exists) {
      return res.status(404).json({ error: 'フォルダが見つかりません' });
    }
    
    // フォルダ名更新
    await folderRef.update({
      name: name,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ 
      message: 'フォルダ名が更新されました',
      folder: { id: folderId, name }
    });
  } catch (error) {
    console.error('フォルダ名更新エラー:', error);
    res.status(500).json({ error: 'フォルダ名の更新に失敗しました' });
  }
});

// フォルダ削除
router.delete('/folders/:folderId', getUserId, async (req, res) => {
  try {
    const { folderId } = req.params;
    
    // フォルダ内のファイルを全て削除
    const materialsRef = db.collection('users').doc(req.userId).collection('materials');
    const snapshot = await materialsRef.where('folderId', '==', folderId).get();
    
    const batch = db.batch();
    const deletePromises = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Storageからファイル削除
      const filePath = data.storageUrl.replace(`gs://${bucket.name}/`, '');
      deletePromises.push(bucket.file(filePath).delete());
      
      // Firestoreドキュメント削除をバッチに追加
      batch.delete(doc.ref);
    });
    
    // フォルダドキュメント削除をバッチに追加
    const folderRef = db.collection('users').doc(req.userId)
                       .collection('folders').doc(folderId);
    batch.delete(folderRef);
    
    // Storage削除とFirestore削除を並行実行
    await Promise.all([
      Promise.all(deletePromises),
      batch.commit()
    ]);
    
    res.json({ message: 'フォルダが削除されました' });
  } catch (error) {
    console.error('フォルダ削除エラー:', error);
    res.status(500).json({ error: 'フォルダの削除に失敗しました' });
  }
});

module.exports = router;

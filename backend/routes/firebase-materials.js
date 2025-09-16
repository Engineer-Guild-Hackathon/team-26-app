const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { getFirestore, getStorage } = require('../config/firebase');

// Multerの設定（メモリストレージ）
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB制限
  }
});

// ユーザーID取得ミドルウェア
const getUserId = (req, res, next) => {
  const userId = req.headers['x-user-id'] || 'anonymous';
  req.userId = userId;
  next();
};

// すべてのルートでユーザーID取得
router.use(getUserId);

// フォルダパス構築関数
const buildFolderPath = async (db, parentId, folderName) => {
  if (!parentId) {
    return folderName;
  }
  
  const parentDoc = await db.collection('materials_folders').doc(parentId).get();
  if (!parentDoc.exists) {
    throw new Error('親フォルダが見つかりません');
  }
  
  const parentData = parentDoc.data();
  return `${parentData.path}/${folderName}`;
};

// フォルダレベル取得関数
const getFolderLevel = async (db, parentId) => {
  if (!parentId) {
    return 0;
  }
  
  const parentDoc = await db.collection('materials_folders').doc(parentId).get();
  if (!parentDoc.exists) {
    throw new Error('親フォルダが見つかりません');
  }
  
  const parentData = parentDoc.data();
  return (parentData.level || 0) + 1;
};

// フォルダ作成
router.post('/folders', async (req, res) => {
  try {
    const { name, parentId = null } = req.body;
    const { userId } = req;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'フォルダ名が必要です' });
    }
    
    const db = getFirestore();
    
    // パスとレベルを計算
    const path = await buildFolderPath(db, parentId, name.trim());
    const level = await getFolderLevel(db, parentId);
    
    const folderData = {
      name: name.trim(),
      parentId,
      path,
      level,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await db.collection('materials_folders').add(folderData);
    
    console.log(`📁 フォルダ作成: ${name} (ID: ${docRef.id})`);
    
    res.json({
      success: true,
      folder: {
        id: docRef.id,
        ...folderData,
        hasChildren: false
      }
    });
  } catch (error) {
    console.error('フォルダ作成エラー:', error);
    res.status(500).json({ error: 'フォルダ作成に失敗しました' });
  }
});

// フォルダ一覧取得
router.get('/folders', async (req, res) => {
  try {
    const { userId } = req;
    const { parentId } = req.query;
    
    const db = getFirestore();
    let query = db.collection('materials_folders').where('userId', '==', userId);
    
    // 親IDが指定されている場合はその子のみ、未指定の場合はルートのみ
    if (parentId !== undefined) {
      if (parentId === '' || parentId === 'null') {
        query = query.where('parentId', '==', null);
      } else {
        query = query.where('parentId', '==', parentId);
      }
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
    
    // 各フォルダの子の有無をチェック
    for (let folder of folders) {
      const childSnapshot = await db.collection('materials_folders')
        .where('userId', '==', userId)
        .where('parentId', '==', folder.id)
        .limit(1)
        .get();
      
      folder.hasChildren = !childSnapshot.empty;
    }
    
    console.log(`📂 フォルダ一覧取得: ${folders.length}件 (親ID: ${parentId || 'ルート'})`);
    
    res.json({
      success: true,
      folders: folders.sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (error) {
    console.error('フォルダ一覧取得エラー:', error);
    res.status(500).json({ error: 'フォルダ一覧の取得に失敗しました' });
  }
});

// フォルダ名変更
router.put('/folders/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { name } = req.body;
    const { userId } = req;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'フォルダ名が必要です' });
    }
    
    const db = getFirestore();
    const folderRef = db.collection('materials_folders').doc(folderId);
    const folderDoc = await folderRef.get();
    
    if (!folderDoc.exists) {
      return res.status(404).json({ error: 'フォルダが見つかりません' });
    }
    
    const folderData = folderDoc.data();
    
    // ユーザー権限チェック
    if (folderData.userId !== userId) {
      return res.status(403).json({ error: 'このフォルダを編集する権限がありません' });
    }
    
    // パスを再計算
    const newPath = await buildFolderPath(db, folderData.parentId, name.trim());
    
    await folderRef.update({
      name: name.trim(),
      path: newPath,
      updatedAt: new Date()
    });
    
    console.log(`✏️ フォルダ名変更: ${folderData.name} → ${name.trim()}`);
    
    res.json({
      success: true,
      folder: {
        id: folderId,
        ...folderData,
        name: name.trim(),
        path: newPath
      }
    });
  } catch (error) {
    console.error('フォルダ名変更エラー:', error);
    res.status(500).json({ error: 'フォルダ名の変更に失敗しました' });
  }
});

// フォルダ削除
router.delete('/folders/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { userId } = req;
    
    const db = getFirestore();
    const storage = getStorage();
    
    // フォルダ情報取得
    const folderDoc = await db.collection('materials_folders').doc(folderId).get();
    if (!folderDoc.exists) {
      return res.status(404).json({ error: 'フォルダが見つかりません' });
    }
    
    const folderData = folderDoc.data();
    if (folderData.userId !== userId) {
      return res.status(403).json({ error: 'このフォルダを削除する権限がありません' });
    }
    
    // 子フォルダを再帰的に削除
    const deleteChildFolders = async (parentId) => {
      const childSnapshot = await db.collection('materials_folders')
        .where('userId', '==', userId)
        .where('parentId', '==', parentId)
        .get();
      
      for (const childDoc of childSnapshot.docs) {
        await deleteChildFolders(childDoc.id);
        await childDoc.ref.delete();
      }
    };
    
    // フォルダ内のファイルを削除
    const filesSnapshot = await db.collection('materials')
      .where('userId', '==', userId)
      .where('folderId', '==', folderId)
      .get();
    
    for (const fileDoc of filesSnapshot.docs) {
      const fileData = fileDoc.data();
      
      // Storageからファイル削除（画像の場合）
      if (fileData.type === 'image' && fileData.storagePath) {
        try {
          await storage.bucket().file(fileData.storagePath).delete();
        } catch (storageError) {
          console.warn('Storage削除警告:', storageError.message);
        }
      }
      
      // Firestoreからファイル削除
      await fileDoc.ref.delete();
    }
    
    // 子フォルダを削除
    await deleteChildFolders(folderId);
    
    // フォルダ自体を削除
    await folderDoc.ref.delete();
    
    console.log(`🗑️ フォルダ削除: ${folderData.name} (ID: ${folderId})`);
    
    res.json({
      success: true,
      message: 'フォルダとその中身を削除しました'
    });
  } catch (error) {
    console.error('フォルダ削除エラー:', error);
    res.status(500).json({ error: 'フォルダの削除に失敗しました' });
  }
});

// ファイルアップロード
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { folderId } = req.body;
    const { userId } = req;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'ファイルが必要です' });
    }
    
    if (!folderId) {
      return res.status(400).json({ error: 'フォルダIDが必要です' });
    }
    
    const db = getFirestore();
    const storage = getStorage();
    
    // フォルダ存在確認
    const folderDoc = await db.collection('materials_folders').doc(folderId).get();
    if (!folderDoc.exists) {
      return res.status(404).json({ error: 'フォルダが見つかりません' });
    }
    
    const folderData = folderDoc.data();
    if (folderData.userId !== userId) {
      return res.status(403).json({ error: 'このフォルダにアップロードする権限がありません' });
    }
    
    // ファイル情報
    const fileExtension = file.originalname.split('.').pop().toLowerCase();
    const fileName = `${uuidv4()}.${fileExtension}`;
    const storagePath = `materials/${userId}/${fileName}`;
    
    // Cloud Storageにアップロード
    const storageFile = storage.bucket().file(storagePath);
    await storageFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          userId: userId,
          folderId: folderId
        }
      }
    });
    
    // ダウンロードURLを取得
    const [downloadURL] = await storageFile.getSignedUrl({
      action: 'read',
      expires: '03-09-2491' // 長期間有効
    });
    
    // Firestoreにメタデータ保存
    const materialData = {
      name: file.originalname,
      extension: fileExtension,
      type: 'image',
      size: file.size,
      mimeType: file.mimetype,
      folderId,
      userId,
      storagePath,
      downloadURL,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await db.collection('materials').add(materialData);
    
    console.log(`📁 ファイルアップロード: ${file.originalname} (ID: ${docRef.id})`);
    
    res.json({
      success: true,
      file: {
        id: docRef.id,
        ...materialData
      }
    });
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    res.status(500).json({ error: 'ファイルのアップロードに失敗しました' });
  }
});

// テキストファイル作成
router.post('/text', async (req, res) => {
  try {
    const { name, content, folderId } = req.body;
    const { userId } = req;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'ファイル名が必要です' });
    }
    
    if (!folderId) {
      return res.status(400).json({ error: 'フォルダIDが必要です' });
    }
    
    const db = getFirestore();
    
    // フォルダ存在確認
    const folderDoc = await db.collection('materials_folders').doc(folderId).get();
    if (!folderDoc.exists) {
      return res.status(404).json({ error: 'フォルダが見つかりません' });
    }
    
    const folderData = folderDoc.data();
    if (folderData.userId !== userId) {
      return res.status(403).json({ error: 'このフォルダにファイルを作成する権限がありません' });
    }
    
    // テキストファイルデータ
    const materialData = {
      name: name.trim().endsWith('.txt') ? name.trim() : `${name.trim()}.txt`,
      extension: 'txt',
      type: 'text',
      content: content || '',
      folderId,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await db.collection('materials').add(materialData);
    
    console.log(`📝 テキストファイル作成: ${materialData.name} (ID: ${docRef.id})`);
    
    res.json({
      success: true,
      file: {
        id: docRef.id,
        ...materialData
      }
    });
  } catch (error) {
    console.error('テキストファイル作成エラー:', error);
    res.status(500).json({ error: 'テキストファイルの作成に失敗しました' });
  }
});

// フォルダ内ファイル一覧取得
router.get('/folders/:folderId/files', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { userId } = req;
    
    const db = getFirestore();
    
    // フォルダ存在確認
    const folderDoc = await db.collection('materials_folders').doc(folderId).get();
    if (!folderDoc.exists) {
      return res.status(404).json({ error: 'フォルダが見つかりません' });
    }
    
    const folderData = folderDoc.data();
    if (folderData.userId !== userId) {
      return res.status(403).json({ error: 'このフォルダにアクセスする権限がありません' });
    }
    
    // ファイル一覧取得
    const snapshot = await db.collection('materials')
      .where('userId', '==', userId)
      .where('folderId', '==', folderId)
      .get();
    
    const files = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      files.push({
        id: doc.id,
        name: data.name,
        extension: data.extension,
        type: data.type,
        size: data.size,
        downloadURL: data.downloadURL,
        createdAt: data.createdAt,
        ...data
      });
    });
    
    console.log(`📄 ファイル一覧取得: ${files.length}件 (フォルダ: ${folderId})`);
    
    res.json({
      success: true,
      files: files.sort((a, b) => a.name.localeCompare(b.name))
    });
  } catch (error) {
    console.error('ファイル一覧取得エラー:', error);
    res.status(500).json({ error: 'ファイル一覧の取得に失敗しました' });
  }
});

// テキストファイル内容取得
router.get('/files/:materialId/content', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { userId } = req;
    
    const db = getFirestore();
    const materialDoc = await db.collection('materials').doc(materialId).get();
    
    if (!materialDoc.exists) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }
    
    const materialData = materialDoc.data();
    if (materialData.userId !== userId) {
      return res.status(403).json({ error: 'このファイルにアクセスする権限がありません' });
    }
    
    if (materialData.type !== 'text') {
      return res.status(400).json({ error: 'テキストファイルではありません' });
    }
    
    res.json({
      success: true,
      content: materialData.content || ''
    });
  } catch (error) {
    console.error('テキストファイル内容取得エラー:', error);
    res.status(500).json({ error: 'ファイル内容の取得に失敗しました' });
  }
});

// テキストファイル内容更新
router.put('/files/:materialId/content', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { content } = req.body;
    const { userId } = req;
    
    const db = getFirestore();
    const materialRef = db.collection('materials').doc(materialId);
    const materialDoc = await materialRef.get();
    
    if (!materialDoc.exists) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }
    
    const materialData = materialDoc.data();
    if (materialData.userId !== userId) {
      return res.status(403).json({ error: 'このファイルを編集する権限がありません' });
    }
    
    if (materialData.type !== 'text') {
      return res.status(400).json({ error: 'テキストファイルではありません' });
    }
    
    await materialRef.update({
      content: content || '',
      updatedAt: new Date()
    });
    
    console.log(`✏️ テキストファイル更新: ${materialData.name} (ID: ${materialId})`);
    
    res.json({
      success: true,
      message: 'ファイル内容を更新しました'
    });
  } catch (error) {
    console.error('テキストファイル更新エラー:', error);
    res.status(500).json({ error: 'ファイル内容の更新に失敗しました' });
  }
});

// ファイル削除
router.delete('/files/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { userId } = req;
    
    const db = getFirestore();
    const storage = getStorage();
    
    const materialDoc = await db.collection('materials').doc(materialId).get();
    if (!materialDoc.exists) {
      return res.status(404).json({ error: 'ファイルが見つかりません' });
    }
    
    const materialData = materialDoc.data();
    if (materialData.userId !== userId) {
      return res.status(403).json({ error: 'このファイルを削除する権限がありません' });
    }
    
    // Storageからファイル削除（画像の場合）
    if (materialData.type === 'image' && materialData.storagePath) {
      try {
        await storage.bucket().file(materialData.storagePath).delete();
        console.log(`🗑️ Storage削除: ${materialData.storagePath}`);
      } catch (storageError) {
        console.warn('Storage削除警告:', storageError.message);
      }
    }
    
    // Firestoreからファイル削除
    await materialDoc.ref.delete();
    
    console.log(`🗑️ ファイル削除: ${materialData.name} (ID: ${materialId})`);
    
    res.json({
      success: true,
      message: 'ファイルを削除しました'
    });
  } catch (error) {
    console.error('ファイル削除エラー:', error);
    res.status(500).json({ error: 'ファイルの削除に失敗しました' });
  }
});

module.exports = router;
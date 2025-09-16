const express = require('express');
const { getFirestore, getStorage } = require('../config/firebase');
const router = express.Router();

// Firebase接続テスト
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Firebase接続テスト開始...');
    
    // Firestore接続テスト
    const db = getFirestore();
    const testDoc = db.collection('test').doc('connection');
    await testDoc.set({
      message: 'Firebase connection test',
      timestamp: new Date(),
      status: 'success'
    });
    
    const docSnapshot = await testDoc.get();
    const data = docSnapshot.data();
    
    // Storage接続テスト
    const storage = getStorage();
    const bucket = storage.bucket();
    const [exists] = await bucket.exists();
    
    console.log('✅ Firebase接続テスト成功');
    
    res.json({
      success: true,
      message: 'Firebase接続成功！',
      firestore: {
        connected: true,
        testData: data
      },
      storage: {
        connected: exists,
        bucketName: bucket.name
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Firebase接続テストエラー:', error);
    res.status(500).json({
      success: false,
      message: 'Firebase接続エラー',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Firestore基本操作テスト
router.post('/test/firestore', async (req, res) => {
  try {
    const db = getFirestore();
    const { collection: collectionName, data } = req.body;
    
    if (!collectionName || !data) {
      return res.status(400).json({ error: 'collection と data が必要です' });
    }
    
    // ドキュメント作成
    const docRef = await db.collection(collectionName).add({
      ...data,
      createdAt: new Date(),
      testFlag: true
    });
    
    // 作成したドキュメントを取得
    const doc = await docRef.get();
    
    res.json({
      success: true,
      message: 'Firestoreテスト成功',
      documentId: docRef.id,
      data: doc.data()
    });
    
  } catch (error) {
    console.error('Firestoreテストエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Storage基本操作テスト
router.post('/test/storage', async (req, res) => {
  try {
    const storage = getStorage();
    const bucket = storage.bucket();
    
    // テストファイル作成
    const fileName = `test-${Date.now()}.txt`;
    const file = bucket.file(`test/${fileName}`);
    const content = `Firebase Storage テスト\n作成日時: ${new Date().toISOString()}`;
    
    // ファイルアップロード
    await file.save(content, {
      metadata: {
        contentType: 'text/plain'
      }
    });
    
    // ダウンロードURL取得
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2030'
    });
    
    res.json({
      success: true,
      message: 'Storageテスト成功',
      fileName: fileName,
      downloadUrl: url,
      bucketName: bucket.name
    });
    
  } catch (error) {
    console.error('Storageテストエラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

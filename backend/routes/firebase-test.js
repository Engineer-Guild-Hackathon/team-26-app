const express = require('express');
const router = express.Router();
const { getFirestore, getStorage } = require('../config/firebase');

// Firebase接続テスト
router.get('/connection', async (req, res) => {
  try {
    const db = getFirestore();
    const storage = getStorage();
    
    // Firestore接続テスト
    let firestoreConnected = false;
    try {
      await db.collection('_test').limit(1).get();
      firestoreConnected = true;
    } catch (firestoreError) {
      console.error('Firestore接続エラー:', firestoreError);
    }
    
    // Storage接続テスト
    let storageConnected = false;
    let bucketName = '';
    try {
      const bucket = storage.bucket();
      bucketName = bucket.name;
      await bucket.exists();
      storageConnected = true;
    } catch (storageError) {
      console.error('Storage接続エラー:', storageError);
    }
    
    res.json({
      success: true,
      message: 'Firebase接続テスト完了',
      firestore: {
        connected: firestoreConnected
      },
      storage: {
        connected: storageConnected,
        bucketName
      }
    });
  } catch (error) {
    console.error('Firebase接続テストエラー:', error);
    res.status(500).json({
      success: false,
      message: 'Firebase接続エラー',
      error: error.message
    });
  }
});

module.exports = router;

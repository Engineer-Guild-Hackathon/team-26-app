const admin = require('firebase-admin');
const path = require('path');

let db = null;
let storage = null;

const initializeFirebase = () => {
  try {
    // firebase-admin-key.jsonファイルを読み込み
    const serviceAccountPath = path.join(__dirname, 'firebase-admin-key.json');
    const serviceAccount = require(serviceAccountPath);
    
    // Firebase Admin SDKの初期化
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
    });

    db = admin.firestore();
    storage = admin.storage();
    
    console.log('✅ Firebase初期化成功');
    console.log(`📁 Storage Bucket: ${serviceAccount.project_id}.firebasestorage.app`);
    
    return { db, storage };
  } catch (error) {
    console.error('❌ Firebase初期化エラー:', error);
    throw error;
  }
};

const getFirestore = () => {
  if (!db) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return db;
};

const getStorage = () => {
  if (!storage) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return storage;
};

module.exports = {
  initializeFirebase,
  getFirestore,
  getStorage
};

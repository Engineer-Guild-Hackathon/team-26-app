const admin = require('firebase-admin');
const path = require('path');

let db = null;
let storage = null;

const initializeFirebase = () => {
  try {
    let serviceAccount;

    // 環境変数が設定されているかチェック
    if (process.env.FIREBASE_PROJECT_ID) {
      console.log('🔧 環境変数からFirebase設定を読み込み中...');
      // 環境変数からサービスアカウント情報を構築
      serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
        token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
      };

      // 必須の環境変数チェック
      const requiredEnvVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_PRIVATE_KEY_ID', 
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_CLIENT_ID'
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          throw new Error(`❌ 必須の環境変数が設定されていません: ${envVar}`);
        }
      }
    } else {
      console.log('📄 ファイルからFirebase設定を読み込み中...');
      // 従来のファイルベースの読み込み（開発環境用フォールバック）
      const serviceAccountPath = path.join(__dirname, 'firebase-admin-key.json');
      serviceAccount = require(serviceAccountPath);
    }
    
    // Firebase Admin SDKの初期化
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
    });

    db = admin.firestore();
    storage = admin.storage();
    
    const configSource = process.env.FIREBASE_PROJECT_ID ? '環境変数' : 'ファイル';
    console.log(`✅ Firebase初期化成功（${configSource}から）`);
    console.log(`📁 Storage Bucket: ${serviceAccount.project_id}.firebasestorage.app`);
    console.log(`🔑 Client Email: ${serviceAccount.client_email}`);
    
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

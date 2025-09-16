require('dotenv').config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

// セキュリティ系ヘッダ追加
app.use(helmet());

// CORS設定
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));

// JSON受け取り（大きな画像データ対応）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ルーターのインポート
const studyRoutes = require('./routes/study');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/user');
const sessionRoutes = require('./routes/session');

const firebaseMaterialsRoutes = require('./routes/firebase-materials');
const firebaseTestRoutes = require('./routes/firebase-test');


// API ルート
app.use('/api/study', studyRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/user', userRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/session', sessionRoutes);
app.use('/api/firebase-materials', firebaseMaterialsRoutes);
app.use('/api/firebase-test', firebaseTestRoutes);

// 基本ルート
app.get("/", (req, res) => {
  res.json({ 
    message: "Study with me Backend API",
    version: "1.0.0",
    endpoints: [
      "/api/study/*",
      "/api/ai/*", 
      "/api/user/*",
      "/api/materials/*"
    ]
  });
});

// WebSocket サーバー（OpenAI Realtime API用）
const wss = new WebSocket.Server({ server });

// WebSocket 接続処理は別ファイルで管理
require('./websocket/realtime-handler')(wss);

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: true,
    message: "Internal Server Error",
    code: "INTERNAL_ERROR",
    timestamp: new Date().toISOString()
  });
});

// 404ハンドリング
app.use((req, res) => {
  res.status(404).json({
    error: true,
    message: "Endpoint not found",
    code: "NOT_FOUND",
    timestamp: new Date().toISOString()
  });
});

// Firebase初期化
const { initializeFirebase } = require('./config/firebase');
try {
  initializeFirebase();
  console.log('🔥 Firebase初期化完了');
} catch (error) {
  console.error('❌ Firebase初期化失敗:', error);
  process.exit(1);
}

const port = process.env.PORT || 3001;
server.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
  console.log(`WebSocket server ready on ws://localhost:${port}`);
  console.log(`🔥 Firebase Materials API: http://localhost:${port}/api/firebase-materials`);
  console.log(`🧪 Firebase Test API: http://localhost:${port}/api/firebase-test/connection`);
});
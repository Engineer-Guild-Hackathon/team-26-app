const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ephemeral key取得
router.post('/create', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: true,
        message: "OpenAI APIキーが設定されていません",
        code: "API_KEY_MISSING",
        timestamp: new Date().toISOString()
      });
    }

    console.log('Creating ephemeral key for WebRTC session...');

    // OpenAI ephemeral key APIを呼び出し
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-realtime',
        voice: 'alloy'
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI ephemeral key error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const sessionData = await response.json();
    console.log('Ephemeral key created successfully');

    res.json({
      client_secret: {
        value: sessionData.client_secret.value,
        expires_at: sessionData.client_secret.expires_at
      },
      session_id: sessionData.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      error: true,
      message: "セッション作成エラー",
      code: "SESSION_CREATE_ERROR",
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

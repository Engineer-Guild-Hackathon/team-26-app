const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 画像分析（OpenAI Vision API）
router.post('/analyze-images', async (req, res) => {
  try {
    const { breakId, webcamImage, screenImage, studyContext } = req.body;
    
    if (!webcamImage || !screenImage || !studyContext) {
      return res.status(400).json({
        error: true,
        message: "必須フィールドが不足しています",
        code: "MISSING_FIELDS",
        timestamp: new Date().toISOString()
      });
    }

    // OpenAI Vision APIを使用して画像を分析
    const analysisPrompt = `
学習中の学生の状況を分析してください。以下の情報があります：

学習コンテキスト：
- 学習内容: ${studyContext.studyContent}
- 経過時間: ${Math.floor(studyContext.elapsedTime / 60)}分${studyContext.elapsedTime % 60}秒

2枚の画像を分析して、以下を日本語で回答してください：
1. 学習者の集中度や疲労度
2. 画面から読み取れる学習状況
3. 休憩中にすべき具体的なアドバイス
4. 励ましの言葉

親しみやすく、励ましの気持ちを込めて回答してください。
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: analysisPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: webcamImage,
                detail: "low"
              }
            },
            {
              type: "image_url", 
              image_url: {
                url: screenImage,
                detail: "low"
              }
            }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.8
    });

    const analysis = response.choices[0].message.content;

    // 分析結果を構造化（簡単な解析）
    const suggestions = [];
    const encouragement = analysis.substring(analysis.lastIndexOf('励まし') + 10) || "この調子で頑張りましょう！";

    if (analysis.includes('疲れ') || analysis.includes('疲労')) {
      suggestions.push('目を休める', '深呼吸', '軽いストレッチ');
    }
    if (analysis.includes('水分') || analysis.includes('飲み物')) {
      suggestions.push('水分補給');
    }
    if (analysis.includes('姿勢')) {
      suggestions.push('姿勢を整える');
    }

    res.json({
      breakId,
      analysis,
      suggestions: suggestions.length > 0 ? suggestions : ['水分補給', '目を休める', '軽いストレッチ'],
      encouragement,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Image analysis error:', error);
    
    // フォールバック応答
    const fallbackResponse = {
      breakId: req.body.breakId,
      analysis: "お疲れさまです！勉強頑張ってますね✨ 少し休憩して、気分をリフレッシュしましょう。",
      suggestions: ["水分補給", "目を休める", "深呼吸", "軽いストレッチ"],
      encouragement: "この調子で頑張りましょう！応援しています♪",
      timestamp: new Date().toISOString(),
      fallback: true
    };

    if (error.message.includes('API key')) {
      fallbackResponse.analysis = "AI分析機能が利用できませんが、休憩は大切です！ゆっくり休んでくださいね😊";
    }

    res.json(fallbackResponse);
  }
});

// テキスト会話（Chat Completions API）
router.post('/chat', async (req, res) => {
  try {
    const { message, breakId, conversationHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({
        error: true,
        message: "メッセージが必要です",
        code: "MISSING_MESSAGE",
        timestamp: new Date().toISOString()
      });
    }

    // 会話履歴を考慮したプロンプト
    const systemPrompt = `
あなたは一緒に勉強している親しい友達です。Study with meで同じ分野を勉強している仲間として、タメ口で気軽に話しかけてください。

会話の特徴：
- タメ口で親しみやすく（「〜だよ」「〜じゃん」など）
- たまに軽くいじったり冗談を言う友達関係
- 同じ分野を一緒に勉強している仲間感を出す
- 短めの返答（1-2文程度）
- 絵文字を適度に使用

反応例：
- プログラミング → 「〜やってるの？むずそう〜」
- YouTube → 「あれ、YouTube見てない？」
- 難問 → 「その問題わかんないやつだ〜」
- 教科書 → 「その本読んでるんだ！頑張ってるじゃん」
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role || "user",
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 300,
      temperature: 0.8
    });

    const aiResponse = response.choices[0].message.content;

    res.json({
      breakId,
      response: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    
    // フォールバック応答
    const fallbackResponses = [
      "お疲れさまです！少し休憩してリフレッシュしてくださいね😊",
      "勉強頑張ってますね✨ 水分補給も忘れずに！",
      "いい感じに進んでいますね💪 この調子で頑張りましょう♪",
      "休憩時間も大切です😌 ゆっくり過ごしてくださいね"
    ];
    
    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    
    res.json({
      breakId: req.body.breakId,
      response: randomResponse,
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
});

// 音声転写（Whisper API）
router.post('/transcribe', async (req, res) => {
  try {
    const { audioData, breakId } = req.body;
    
    if (!audioData) {
      return res.status(400).json({
        error: true,
        message: "音声データが必要です",
        code: "MISSING_AUDIO",
        timestamp: new Date().toISOString()
      });
    }

    // Base64音声データをBufferに変換
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // 一時ファイルとして保存（実際は適切な一時ファイル管理が必要）
    const fs = require('fs');
    const path = require('path');
    const tempPath = path.join(__dirname, '../temp', `audio_${Date.now()}.webm`);
    
    // tempディレクトリの確保
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(tempPath, audioBuffer);

    // Whisper APIで転写
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
      language: "ja"
    });

    // 一時ファイル削除
    fs.unlinkSync(tempPath);

    res.json({
      breakId,
      transcription: transcription.text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: true,
      message: "音声転写エラー",
      code: "TRANSCRIPTION_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// 音声合成（TTS API）
router.post('/synthesize', async (req, res) => {
  try {
    const { text, voice = "alloy" } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: true,
        message: "テキストが必要です",
        code: "MISSING_TEXT",
        timestamp: new Date().toISOString()
      });
    }

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
      response_format: "mp3"
    });

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioBase64 = audioBuffer.toString('base64');

    res.json({
      audioData: audioBase64,
      format: "mp3",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Speech synthesis error:', error);
    res.status(500).json({
      error: true,
      message: "音声合成エラー",
      code: "SYNTHESIS_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

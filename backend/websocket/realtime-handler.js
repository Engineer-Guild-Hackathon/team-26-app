const WebSocket = require('ws');
const OpenAI = require('openai');

// OpenAI クライアント初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// アクティブな接続を管理
const activeConnections = new Map();

// OpenAI Realtime API WebSocket URL
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

module.exports = function(wss) {
  console.log('WebSocket server initialized for OpenAI Realtime API');

  wss.on('connection', function connection(ws, req) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathSegments = url.pathname.split('/');
    
    // パスから breakId を取得 (/ai/realtime/:breakId)
    let breakId = null;
    if (pathSegments.length >= 4 && pathSegments[1] === 'ai' && pathSegments[2] === 'realtime') {
      breakId = pathSegments[3];
    }

    if (!breakId) {
      ws.close(1008, 'Invalid path. Expected /ai/realtime/:breakId');
      return;
    }

    console.log(`New WebSocket connection for break: ${breakId}`);
    
    // 接続情報を保存
    const connectionInfo = {
      ws,
      breakId,
      connected: true,
      startTime: new Date(),
      openaiWs: null,
      conversationHistory: []
    };
    
    activeConnections.set(breakId, connectionInfo);

    // OpenAI Realtime API への接続を初期化
    initializeOpenAIConnection(connectionInfo);

    // クライアントからのメッセージ処理
    ws.on('message', function message(data) {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(connectionInfo, message);
      } catch (error) {
        console.error('Failed to parse client message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid JSON format',
          timestamp: new Date().toISOString()
        }));
      }
    });

    // 接続終了処理
    ws.on('close', function close() {
      console.log(`WebSocket connection closed for break: ${breakId}`);
      
      // OpenAI 接続も閉じる
      if (connectionInfo.openaiWs) {
        connectionInfo.openaiWs.close();
      }
      
      activeConnections.delete(breakId);
    });

    // エラー処理
    ws.on('error', function error(err) {
      console.error(`WebSocket error for break ${breakId}:`, err);
    });

    // 接続確認メッセージ
    ws.send(JSON.stringify({
      type: 'connected',
      breakId,
      message: 'リアルタイムAI会話に接続しました！',
      timestamp: new Date().toISOString()
    }));
  });
};

// OpenAI Realtime API への接続初期化
async function initializeOpenAIConnection(connectionInfo) {
  if (!process.env.OPENAI_API_KEY) {
    console.log('OpenAI API key not configured, using fallback mode');
    connectionInfo.fallbackMode = true;
    return;
  }

  try {
    console.log(`Initializing OpenAI Realtime connection for break: ${connectionInfo.breakId}`);
    console.log('OpenAI API Key configured:', !!process.env.OPENAI_API_KEY);
    
    // OpenAI Realtime API WebSocket接続
    const openaiWs = new WebSocket(OPENAI_REALTIME_URL, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    connectionInfo.openaiWs = openaiWs;

    // OpenAI WebSocket イベントハンドラ
    openaiWs.on('open', () => {
      console.log(`OpenAI Realtime API connected for break: ${connectionInfo.breakId}`);
      
      // 接続が完了したことをマーク
      connectionInfo.openaiConnected = true;
      
      // セッション設定を送信
      const sessionConfig = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: `あなたは一緒に勉強している親しい友達です。Study with meで同じ分野を勉強している仲間として、タメ口で気軽に話しかけてください。

会話の特徴：
- タメ口で親しみやすく（「〜だよ」「〜じゃん」など）
- たまに軽くいじったり冗談を言う友達関係
- 同じ分野を一緒に勉強している仲間感を出す
- 短めの返答（1-2文程度）
- 絵文字を適度に使用
画像が提供された場合は、その内容を分析して具体的なアドバイスを提供
【重要】2つの画像を必ず両方分析してコメントしてください：
1. ウェブカメラ画像 = 今のユーザの状態（表情、疲れ具合など）
2. スクリーンショット = ユーザが勉強している画面内容（最重要！）

スクリーンショット（勉強画面）の実際の内容を正確に見て分析してください：
- 画面に何が映っているかを正確に判断
- 勉強系なら具体的に何を学習しているか
- 遊び系なら何をしているか
- 文字やアイコンを読み取って判断

反応例（画面内容に応じて適切に使い分け）：
- 勉強画面 → 「頑張ってるじゃん！」「その問題難しそう〜」
- プログラミング → 「コード書いてるの？むずそう〜」
- 動画サイト → 「あれ、動画見てない？」
- ゲーム → 「おい、ゲームしてるじゃん笑」
- SNS → 「また携帯いじってる〜」

実際の画面内容に基づいて正確にコメントしてください。`,
          voice: 'echo',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          tools: [],
          tool_choice: 'auto',
          temperature: 0.8,
          max_response_output_tokens: 4096
        }
      };

      openaiWs.send(JSON.stringify(sessionConfig));
    });

    openaiWs.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleOpenAIMessage(connectionInfo, message);
      } catch (error) {
        console.error('Failed to parse OpenAI message:', error);
      }
    });

    openaiWs.on('error', (error) => {
      console.error(`OpenAI WebSocket error for break ${connectionInfo.breakId}:`, error);
      connectionInfo.fallbackMode = true;
    });

    openaiWs.on('close', () => {
      console.log(`OpenAI WebSocket closed for break: ${connectionInfo.breakId}`);
      connectionInfo.openaiWs = null;
    });

  } catch (error) {
    console.error('Failed to initialize OpenAI connection:', error);
    connectionInfo.fallbackMode = true;
  }
}

// クライアントからのメッセージ処理
async function handleClientMessage(connectionInfo, message) {
  const { ws, breakId, conversationHistory } = connectionInfo;
  
  try {
    switch (message.type) {
      case 'text_message':
        await handleTextMessage(connectionInfo, message);
        break;
        
      case 'audio_message':
        await handleAudioMessage(connectionInfo, message);
        break;
        
      case 'image_analysis':
        await handleImageAnalysisRealtime(connectionInfo, message);
        break;
        
      case 'screenshot_analysis':
        await handleScreenshotAnalysis(connectionInfo, message);
        break;
        
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date().toISOString()
        }));
        break;
        
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`,
          timestamp: new Date().toISOString()
        }));
    }
  } catch (error) {
    console.error('Error handling client message:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process message',
      timestamp: new Date().toISOString()
    }));
  }
}

// テキストメッセージ処理（Realtime API対応）
async function handleTextMessage(connectionInfo, message) {
  const { ws, openaiWs, conversationHistory } = connectionInfo;
  
  try {
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      // Realtime APIでテキストメッセージを送信
      const conversationItem = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'text',
              text: message.content
            }
          ]
        }
      };

      openaiWs.send(JSON.stringify(conversationItem));
      
      // レスポンス生成を開始
      const createResponse = {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: '一緒に勉強してる友達として、タメ口で気軽に返答して！'
        }
      };
      
      openaiWs.send(JSON.stringify(createResponse));
      
    } else {
      // フォールバック処理
      await handleTextMessageFallback(connectionInfo, message);
    }

  } catch (error) {
    console.error('Text message processing error:', error);
    await handleTextMessageFallback(connectionInfo, message);
  }
}

// テキストメッセージ処理（フォールバック）
async function handleTextMessageFallback(connectionInfo, message) {
  const { ws, conversationHistory } = connectionInfo;
  
  try {
    if (connectionInfo.fallbackMode) {
      // 完全フォールバック応答
      const fallbackResponses = [
        "お疲れさまです！勉強頑張ってますね✨ 少し休憩してリフレッシュしましょう♪",
        "いい感じに集中されていますね！💪 水分補給も忘れずに。",
        "勉強の調子はいかがですか？😊 休憩中はゆっくり過ごしてくださいね。",
        "素晴らしい集中力ですね！✨ この調子で頑張りましょう。"
      ];
      
      const response = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      
      ws.send(JSON.stringify({
        type: 'ai_response',
        content: response,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // Chat Completions APIを使用
    const systemPrompt = `
あなたは学習支援キャラクターです。学習中の休憩時間に親しみやすく励ましてください。
特徴:
- 優しく親しみやすい口調
- 学習者を励ます
- 適切な休憩アドバイス
- 短めの返答（2-3文程度）
- 絵文字を適度に使用
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: message.content }
      ],
      max_tokens: 300,
      temperature: 0.8
    });

    const aiResponse = response.choices[0].message.content;
    
    // 会話履歴に追加
    conversationHistory.push({ role: "user", content: message.content });
    conversationHistory.push({ role: "assistant", content: aiResponse });
    
    // 履歴が長くなりすぎないよう制限
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, 4); // 古い2ターン分を削除
    }

    ws.send(JSON.stringify({
      type: 'ai_response',
      content: aiResponse,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('OpenAI API error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'AI応答でエラーが発生しました',
      timestamp: new Date().toISOString()
    }));
  }
}

// 音声メッセージ処理（Realtime API対応）
async function handleAudioMessage(connectionInfo, message) {
  const { ws, openaiWs } = connectionInfo;
  
  try {
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN && connectionInfo.openaiConnected) {
      console.log('Realtime APIに音声データを送信中...', { audioLength: message.audioData.length });
      
      // WebMからPCM16に変換が必要な場合、ここで変換処理を行う
      // 現在は簡易実装としてそのまま送信
      
      // 音声データをRealtime APIに送信
      const audioAppend = {
        type: 'input_audio_buffer.append',
        audio: message.audioData
      };
      
      openaiWs.send(JSON.stringify(audioAppend));
      console.log('音声データ送信完了');
      
      // 音声送信完了を通知してレスポンス生成開始
      const audioCommit = {
        type: 'input_audio_buffer.commit'
      };
      
      openaiWs.send(JSON.stringify(audioCommit));
      console.log('音声バッファコミット完了');
      
      // レスポンス生成開始
      const createResponse = {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: '音声入力を理解して、日本語で親しみやすく返答してください。学習中の休憩時間なので、励ましの言葉をかけてください。'
        }
      };
      
      openaiWs.send(JSON.stringify(createResponse));
      console.log('レスポンス生成開始');
      
      ws.send(JSON.stringify({
        type: 'audio_processing',
        message: '🎤 音声を処理中です...',
        timestamp: new Date().toISOString()
      }));
      
    } else {
      console.log('OpenAI接続未準備、フォールバックを使用');
      // フォールバック: Whisper APIで転写
      await handleAudioMessageFallback(connectionInfo, message);
    }

  } catch (error) {
    console.error('Audio processing error:', error);
    await handleAudioMessageFallback(connectionInfo, message);
  }
}

// 音声メッセージ処理（フォールバック）
async function handleAudioMessageFallback(connectionInfo, message) {
  const { ws } = connectionInfo;
  
  try {
    // 音声をテキストに変換
    const audioBuffer = Buffer.from(message.audioData, 'base64');
    
    // 一時ファイル作成
    const fs = require('fs');
    const path = require('path');
    const tempPath = path.join(__dirname, '../temp', `audio_${Date.now()}.webm`);
    
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    fs.writeFileSync(tempPath, audioBuffer);

    // Whisper API で転写
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
      language: "ja"
    });

    // 一時ファイル削除
    fs.unlinkSync(tempPath);

    // 転写されたテキストを処理
    await handleTextMessage(connectionInfo, {
      type: 'text_message',
      content: transcription.text
    });

  } catch (error) {
    console.error('Audio processing fallback error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: '音声処理でエラーが発生しました',
      timestamp: new Date().toISOString()
    }));
  }
}

// OpenAI Realtime APIからのメッセージ処理
function handleOpenAIMessage(connectionInfo, message) {
  const { ws } = connectionInfo;
  
  try {
    switch (message.type) {
      case 'session.created':
        console.log('OpenAI session created:', message.session.id);
        ws.send(JSON.stringify({
          type: 'ai_connected',
          message: 'AIとの接続が完了しました！音声で話しかけてください。',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'session.updated':
        console.log('OpenAI session updated');
        // セッション設定が完了したことを通知
        ws.send(JSON.stringify({
          type: 'ai_session_ready',
          message: '🎤 音声対話の準備が完了しました！話しかけてください。',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'response.done':
        // 応答完了
        if (message.response.output) {
          message.response.output.forEach(output => {
            if (output.type === 'message' && output.message.content) {
              output.message.content.forEach(content => {
                if (content.type === 'text') {
                  ws.send(JSON.stringify({
                    type: 'ai_response',
                    content: content.text,
                    timestamp: new Date().toISOString()
                  }));
                }
              });
            }
          });
        }
        break;

      case 'response.audio.delta':
        // 音声レスポンス（ストリーミング）
        if (message.delta) {
          ws.send(JSON.stringify({
            type: 'ai_audio_delta',
            audioData: message.delta,
            timestamp: new Date().toISOString()
          }));
        }
        break;

      case 'response.audio.done':
        // 音声レスポンス完了
        ws.send(JSON.stringify({
          type: 'ai_audio_done',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'input_audio_buffer.speech_started':
        ws.send(JSON.stringify({
          type: 'speech_started',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'input_audio_buffer.speech_stopped':
        ws.send(JSON.stringify({
          type: 'speech_stopped',
          timestamp: new Date().toISOString()
        }));
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // 音声転写完了
        ws.send(JSON.stringify({
          type: 'transcription_completed',
          transcription: message.transcript,
          timestamp: new Date().toISOString()
        }));
        break;

      case 'error':
        console.error('OpenAI Realtime API error:', message);
        ws.send(JSON.stringify({
          type: 'ai_error',
          message: message.error?.message || 'AI処理中にエラーが発生しました',
          timestamp: new Date().toISOString()
        }));
        break;

      default:
        console.log('Unhandled OpenAI message type:', message.type);
    }
  } catch (error) {
    console.error('Error handling OpenAI message:', error);
  }
}

// スクリーンショット分析（Realtime API対応）
async function handleScreenshotAnalysis(connectionInfo, message) {
  const { ws, openaiWs } = connectionInfo;
  
  // 重複リクエスト防止（5秒以内の連続リクエストを無視）
  const currentTime = Date.now();
  if (connectionInfo.lastAnalysisTime && (currentTime - connectionInfo.lastAnalysisTime) < 5000) {
    console.log('⏭️ 重複画像分析リクエストを無視 (5秒以内)');
    return;
  }
  connectionInfo.lastAnalysisTime = currentTime;
  
  try {
    if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN || !connectionInfo.openaiConnected) {
      console.log('OpenAI connection not ready, using fallback. State:', openaiWs?.readyState, 'Connected:', connectionInfo.openaiConnected);
      throw new Error('OpenAI connection not available');
    }

    const { webcamImage, screenImage, studyContext } = message;
    
    // 画像データの検証
    console.log('🔍 受信した画像データの検証:', {
      webcamImageSize: webcamImage?.length || 0,
      screenImageSize: screenImage?.length || 0,
      webcamPrefix: webcamImage?.substring(0, 50) || 'EMPTY',
      screenPrefix: screenImage?.substring(0, 50) || 'EMPTY',
      studyContent: studyContext?.studyContent,
      isInitialConversation: studyContext?.isInitialConversation
    });
    
    if (!webcamImage || !screenImage) {
      console.error('❌ 画像データが不完全:', {
        webcam: !!webcamImage,
        screen: !!screenImage
      });
      ws.send(JSON.stringify({
        type: 'error',
        message: '画像データが不完全です',
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // Realtime APIで画像を含む会話アイテムを作成
    const conversationItem = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${studyContext?.isRefreshAnalysis ? '画面更新したよ！' : 'お疲れ〜！'}今の状況チェックして！

学習コンテキスト：
- 勉強してるもの: ${studyContext?.studyContent || '不明'}
- 経過時間: ${studyContext?.elapsedTime ? Math.floor(studyContext.elapsedTime / 60) + '分' : '不明'}

【必須】2つの画像を必ず両方分析してコメント：
1. ウェブカメラ = ユーザの今の状態（表情・様子）
2. スクリーンショット = 勉強画面の内容（必ずこれについて言及！）

スクリーンショット（勉強画面）の実際の内容を正確に分析してコメント：
- まず画面に何が映っているかを正確に判断
- 文字、アイコン、レイアウトをしっかり見る
- 勉強内容なら応援、サボりなら軽くいじる

実際の画面内容に応じた反応例：
- 勉強系 → 「頑張ってるじゃん！」「その内容難しそう〜」
- プログラミング → 「コード書いてるの？」
- 動画系 → 「動画見てるの？」
- ゲーム系 → 「ゲームしてるじゃん笑」

画面を正確に見て、実際の内容についてタメ口でコメントして！`
          },
          {
            type: 'image_url',
            image_url: {
              url: webcamImage
            }
          },
          {
            type: 'image_url',
            image_url: {
              url: screenImage
            }
          }
        ]
      }
    };

    // アイテムをOpenAI Realtime APIに送信
    openaiWs.send(JSON.stringify(conversationItem));
    
    // 画像送信後、少し待ってから応答生成を開始（確実に処理されるように）
    setTimeout(() => {
      const createResponse = {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: '画像を分析して、学習者に対する励ましとアドバイスを日本語で提供してください。'
        }
      };
      
      openaiWs.send(JSON.stringify(createResponse));
      console.log('🎤 画像分析後の自動応答を要求しました');
    }, 100);

    // 分析開始の通知
    ws.send(JSON.stringify({
      type: 'screenshot_analysis_started',
      message: '画像を分析中です...',
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Screenshot analysis error:', error);
    
    // フォールバック応答
    ws.send(JSON.stringify({
      type: 'screenshot_analysis_result',
      analysis: "お疲れさまです！勉強頑張ってますね✨ 少し休憩してリフレッシュしましょう♪",
      suggestions: ["水分補給", "目を休める", "深呼吸", "軽いストレッチ"],
      fallback: true,
      timestamp: new Date().toISOString()
    }));
  }
}

// Realtime API対応の画像分析
async function handleImageAnalysisRealtime(connectionInfo, message) {
  return handleScreenshotAnalysis(connectionInfo, message);
}

// 従来の画像分析処理（フォールバック用）
async function handleImageAnalysis(connectionInfo, message) {
  const { ws } = connectionInfo;
  
  try {
    const { webcamImage, screenImage, studyContext } = message;
    
    const analysisPrompt = `
学習中の学生の状況を分析してください。

学習コンテキスト：
- 学習内容: ${studyContext.studyContent}
- 経過時間: ${Math.floor(studyContext.elapsedTime / 60)}分

2枚の画像から学習状況を分析し、親しみやすく励ましの言葉をかけてください。
短めの返答（2-3文程度）で、絵文字も使ってください。
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt },
            { type: "image_url", image_url: { url: webcamImage, detail: "low" } },
            { type: "image_url", image_url: { url: screenImage, detail: "low" } }
          ]
        }
      ],
      max_tokens: 400,
      temperature: 0.8
    });

    const analysis = response.choices[0].message.content;

    ws.send(JSON.stringify({
      type: 'image_analysis_result',
      analysis,
      suggestions: ["水分補給", "目を休める", "軽いストレッチ"],
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Image analysis error:', error);
    ws.send(JSON.stringify({
      type: 'image_analysis_result',
      analysis: "お疲れさまです！勉強頑張ってますね✨ 少し休憩してリフレッシュしましょう♪",
      suggestions: ["水分補給", "目を休める", "深呼吸"],
      fallback: true,
      timestamp: new Date().toISOString()
    }));
  }
}

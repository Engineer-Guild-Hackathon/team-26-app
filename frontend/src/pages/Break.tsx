import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TalkAnimation from '../components/TalkAnimation'

// OpenAI Realtime API接続クラス
class OpenAIRealtimeClient {
  private ws: WebSocket | null = null
  private apiKey: string
  private onMessage: (message: any) => void
  private onAudioResponse: (audioData: string) => void

  constructor(apiKey: string, onMessage: (message: any) => void, onAudioResponse: (audioData: string) => void) {
    this.apiKey = apiKey
    this.onMessage = onMessage
    this.onAudioResponse = onAudioResponse
  }

  connect() {
    if (!this.apiKey || this.apiKey === 'your-openai-api-key-here') {
      console.error('OpenAI APIキーが設定されていません')
      this.onMessage({ type: 'error', message: 'APIキーが設定されていません。' })
      return
    }

    // 注意: OpenAI Realtime APIはブラウザから直接接続できません
    // 本来はバックエンドサーバー経由が必要ですが、開発用にダミー実装
    console.log('ダミーAI接続を開始（本来はバックエンド経由が必要）')
    
    // ダミーの接続成功を模擬
    setTimeout(() => {
      if (this.onMessage) {
        this.onMessage({ type: 'connected', message: 'AI接続完了！画像を見ながらお話しできます✨（ダミー実装）' })
      }
    }, 1000)

  }

  send(message: any) {
    // ダミー実装: ログ出力のみ
    console.log('ダミーAI送信:', message.type)
  }

  sendImages(webcamPhoto: string, screenPhoto: string) {
    console.log('ダミー画像分析開始:', { 
      webcamLength: webcamPhoto.length, 
      screenLength: screenPhoto.length 
    })
    
    // ダミーのAI応答を生成
    setTimeout(() => {
      const responses = [
        'お疲れさまです！勉強頑張ってますね✨ 少し休憩して、水分補給も忘れずに！',
        'いい感じに集中して勉強されてますね！💪 短い休憩で気分をリフレッシュしましょう。',
        'ずっと画面を見て大変でしたね😊 目を休めて、深呼吸してみてください！',
        '真剣に取り組んでいる姿が素晴らしいです！✨ この調子で頑張りましょう♪'
      ]
      const randomResponse = responses[Math.floor(Math.random() * responses.length)]
      this.onMessage({ type: 'ai_response', message: randomResponse })
    }, 1500)
  }

  sendAudio(audioData: string) {
    console.log('ダミー音声分析:', audioData.length)
    
    // ダミーの音声応答
    setTimeout(() => {
      const responses = [
        '音声でお話しいただき、ありがとうございます！😊',
        '声の調子から、少し疲れているように聞こえますね。大丈夫ですか？',
        'いい声ですね！リラックスして休憩を楽しんでください♪',
        '何かお困りのことがあれば、お気軽にお話しくださいね✨'
      ]
      const randomResponse = responses[Math.floor(Math.random() * responses.length)]
      this.onMessage({ type: 'ai_response', message: randomResponse })
    }, 2000)
  }

  disconnect() {
    console.log('ダミーAI接続終了')
    this.onMessage({ type: 'disconnected', message: 'AI接続が終了しました' })
  }
}

export default function Break() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<any>(null)
  const [breakElapsedTime, setBreakElapsedTime] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [conversation, setConversation] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImages, setCapturedImages] = useState<{
    webcamPhoto: string
    screenPhoto: string
    timestamp: string
  } | null>(null)
  
  // OpenAI Realtime API関連
  const [aiClient, setAiClient] = useState<OpenAIRealtimeClient | null>(null)
  const [isAiConnected, setIsAiConnected] = useState(false)
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const audioChunks = useRef<Blob[]>([])
  
  // 環境変数からAPIキーを取得
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || 'your-openai-api-key-here'

  // 休憩時間の計算（学習時間の1/5）
  const breakDuration = settings ? Math.floor(settings.targetTime / 5 * 60) : 300 // デフォルト5分

  // AI応答のメッセージハンドラ
  const handleAiMessage = (message: any) => {
    console.log('AI message:', message)
    if (message.type === 'connected') {
      setIsAiConnected(true)
      setConversation(prev => [...prev, `✨ ${message.message}`])
    } else if (message.type === 'ai_response') {
      setConversation(prev => [...prev, `キャラクター: ${message.message}`])
    } else if (message.type === 'error') {
      setConversation(prev => [...prev, `⚠️ ${message.message}`])
    } else if (message.type === 'disconnected') {
      setIsAiConnected(false)
      setConversation(prev => [...prev, `❌ ${message.message}`])
    }
  }

  // AI音声応答ハンドラ
  const handleAiAudio = (audioData: string) => {
    // PCM16音声データの再生処理
    console.log('AI音声データ受信:', audioData.length)
    // TODO: 音声再生実装
  }

  // 設定と撮影画像を読み込み
  useEffect(() => {
    const savedSettings = localStorage.getItem('studySettings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
    
    // 撮影した画像を読み込み
    const savedImages = localStorage.getItem('capturedImages')
    if (savedImages) {
      const parsedImages = JSON.parse(savedImages)
      setCapturedImages(parsedImages)
      console.log('撮影画像を読み込みました:', parsedImages)
    }
  }, [])

  // OpenAI Realtime API接続
  useEffect(() => {
    let isMounted = true
    
    const client = new OpenAIRealtimeClient(apiKey, handleAiMessage, handleAiAudio)
    
    if (isMounted) {
      setAiClient(client)
      // 接続開始
      client.connect()
    }
    
    return () => {
      isMounted = false
      client.disconnect()
      setAiClient(null)
      setIsAiConnected(false)
    }
  }, [apiKey])

  // 撮影画像が読み込まれたら自動でAIに送信
  useEffect(() => {
    if (capturedImages && aiClient && isAiConnected) {
      console.log('画像をAIに送信中...')
      setConversation(prev => [...prev, '📸 画像を分析中...'])
      aiClient.sendImages(capturedImages.webcamPhoto, capturedImages.screenPhoto)
    }
  }, [capturedImages, aiClient, isAiConnected])

  // Webカメラを開始
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true // 音声も必要
        })
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (error) {
        console.error('カメラアクセスエラー:', error)
      }
    }

    startCamera()
    
    // 初期メッセージ
    setConversation(['キャラクター: お疲れさま！少し休憩しましょう♪'])

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // 休憩タイマー
  useEffect(() => {
    const timer = setInterval(() => {
      setBreakElapsedTime(prev => {
        const newTime = prev + 1
        
        // 休憩時間終了でStudy画面に戻る
        if (newTime >= breakDuration) {
          navigate('/study')
          return newTime
        }
        
        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [breakDuration, navigate])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 音声録音開始/停止
  const handleStartRecording = async () => {
    if (!isRecording && stream) {
      if (!aiClient || !isAiConnected) {
        setConversation(prev => [...prev, '⚠️ AI未接続です'])
        return
      }

      try {
        setIsRecording(true)
        setConversation(prev => [...prev, '🎤 録音中...'])
        
        // 音声録音開始
        const mediaRecorder = new MediaRecorder(stream, { 
          mimeType: 'audio/webm; codecs=opus' 
        })
        
        audioChunks.current = []
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.current.push(event.data)
          }
        }
        
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' })
          
          // 音声をBase64に変換してAIに送信
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1]
            aiClient.sendAudio(base64Audio)
            setConversation(prev => [...prev.slice(0, -1), '🎤 音声送信完了、AI応答待ち...'])
          }
          reader.readAsDataURL(audioBlob)
        }
        
        setAudioRecorder(mediaRecorder)
        mediaRecorder.start()
        
        // 5秒後に自動停止
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop()
            setIsRecording(false)
          }
        }, 5000)
        
      } catch (error) {
        console.error('録音エラー:', error)
        setConversation(prev => [...prev.slice(0, -1), '⚠️ 録音エラーが発生しました'])
        setIsRecording(false)
      }
    } else if (isRecording && audioRecorder) {
      // 録音停止
      audioRecorder.stop()
      setIsRecording(false)
    }
  }

  const handleContinueStudy = () => {
    navigate('/study')
  }

  const handleEndStudy = () => {
    navigate('/')
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'grid',
      gridTemplateColumns: '350px 1fr',
      background: '#000'
    }}>
      {/* 左側: Webカメラ + 撮影画像 + 会話UI */}
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto'
      }}>
        <h3 style={{ color: 'white', marginTop: 0 }}>Webカメラ</h3>
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{
            width: '100%',
            maxWidth: '310px',
            borderRadius: '8px',
            border: '2px solid #333',
            marginBottom: '15px'
          }}
        />

        {/* 撮影した画像表示 */}
        {capturedImages && (
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ color: '#4ecdc4', marginTop: 0, marginBottom: '10px', fontSize: '14px' }}>
              📸 撮影画像（{new Date(capturedImages.timestamp).toLocaleTimeString()}）
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
              {/* Webカメラ画像 */}
              <div>
                <div style={{ color: '#ccc', fontSize: '12px', marginBottom: '4px' }}>Webカメラ</div>
                <img 
                  src={capturedImages.webcamPhoto} 
                  alt="Webcam capture"
                  style={{
                    width: '100%',
                    borderRadius: '4px',
                    border: '1px solid #333'
                  }}
                />
              </div>
              
              {/* スクリーンショット */}
              <div>
                <div style={{ color: '#ccc', fontSize: '12px', marginBottom: '4px' }}>スクリーン</div>
                <img 
                  src={capturedImages.screenPhoto} 
                  alt="Screen capture"
                  style={{
                    width: '100%',
                    borderRadius: '4px',
                    border: '1px solid #333'
                  }}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* 休憩時間 */}
        <div style={{
          padding: '15px',
          background: '#333',
          borderRadius: '8px',
          textAlign: 'center',
          marginBottom: '15px'
        }}>
          <div style={{ color: '#ccc', fontSize: '14px' }}>休憩時間</div>
          <div style={{ color: '#4ecdc4', fontSize: '24px', fontWeight: 'bold' }}>
            {formatTime(breakElapsedTime)}
          </div>
          <div style={{ color: '#ccc', fontSize: '12px' }}>
            残り: {formatTime(Math.max(0, breakDuration - breakElapsedTime))}
          </div>
        </div>

        {/* 会話ログ */}
        <div style={{
          background: '#2a2a2a',
          borderRadius: '8px',
          padding: '15px',
          marginBottom: '15px',
          overflowY: 'auto',
          height: '150px',
          flexShrink: 0
        }}>
          <div style={{ color: '#ccc', fontSize: '14px', marginBottom: '10px' }}>
            会話ログ
          </div>
          {conversation.map((message, index) => (
            <div 
              key={index} 
              style={{ 
                color: message.startsWith('キャラクター:') ? '#4ecdc4' : '#fff',
                marginBottom: '8px',
                fontSize: '14px',
                lineHeight: '1.4'
              }}
            >
              {message}
            </div>
          ))}
        </div>

        {/* AI接続状況 */}
        <div style={{
          padding: '10px',
          background: isAiConnected ? 'rgba(40, 167, 69, 0.2)' : 'rgba(255, 193, 7, 0.2)',
          borderRadius: '6px',
          border: `1px solid ${isAiConnected ? '#28a745' : '#ffc107'}`,
          fontSize: '12px',
          textAlign: 'center',
          marginBottom: '10px'
        }}>
          {isAiConnected ? '🟢 AI接続中（画像認識対応）' : '🟡 AI接続中...'}
        </div>

        {/* 音声入力ボタン */}
        <button
          onClick={handleStartRecording}
          disabled={isRecording || !isAiConnected}
          style={{
            padding: '15px',
            background: isRecording ? '#ffc107' : (isAiConnected ? '#28a745' : '#6c757d'),
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: (isRecording || !isAiConnected) ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            marginBottom: '10px',
            fontWeight: 'bold'
          }}
        >
          {isRecording ? '🎤 録音中...' : (isAiConnected ? '🎤 話しかける' : '🎤 AI接続待ち')}
        </button>

        {/* ナビゲーションボタン */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleContinueStudy}
            style={{
              flex: 1,
              padding: '12px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            復帰
          </button>
          <button
            onClick={handleEndStudy}
            style={{
              flex: 1,
              padding: '12px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            中断
          </button>
        </div>
      </div>

      {/* 右側: TalkAnimation */}
      <div style={{ position: 'relative' }}>
        <TalkAnimation />
        
        {/* 休憩中表示 */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4ecdc4' }}>
            😊 休憩中
          </div>
          <div style={{ fontSize: '14px', marginTop: '5px' }}>
            Study with me の休憩時間です
          </div>
        </div>

        {/* ランダムタイミング表示 */}
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>ランダムタイミング</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
            ポモドーロ±σ
          </div>
        </div>
      </div>
    </div>
  )
}

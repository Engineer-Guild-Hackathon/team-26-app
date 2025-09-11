import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TalkAnimation from '../components/TalkAnimation'

// CSS animations for speaking indicator
const styles = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.3; }
    100% { opacity: 1; }
  }
`

// Inject styles into head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style')
  styleElement.textContent = styles
  document.head.appendChild(styleElement)
}

// WebRTC Realtime AI Client
class WebRTCRealtimeClient {
  private pc: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private mediaStream: MediaStream | null = null
  private onMessage: (message: any) => void
  // private onAudioResponse: (audioData: string) => void - 現在未使用
  // private breakId: string - 現在未使用
  private isSending: boolean = false // 送信状態管理
  private isResponseActive: boolean = false // レスポンス状態管理

  constructor(breakId: string, onMessage: (message: any) => void, _onAudioResponse: (audioData: string) => void) {
    // this.breakId = breakId - 現在未使用
    this.onMessage = onMessage
    // this.onAudioResponse = _onAudioResponse - 現在未使用
  }

  async connect() {
    try {
      console.log('WebRTC接続開始...')
      
      // 1. ephemeral keyを取得
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
      const sessionResp = await fetch(`${apiUrl}/session/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (!sessionResp.ok) {
        throw new Error('セッション作成に失敗しました')
      }
      
      const sessionData = await sessionResp.json()
      console.log('Session created:', sessionData)

      // 2. RTCPeerConnection作成
      this.pc = new RTCPeerConnection()

      // 3. マイク音声を取得
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 24000
        }
      })
      
      this.mediaStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.mediaStream!)
      })

      // 4. データチャンネル作成
      this.dataChannel = this.pc.createDataChannel("oai-events")
      this.setupDataChannelEvents()

      // 5. WebRTCイベント設定
      this.pc.addEventListener("track", (event) => {
        console.log("Received track:", event.track.kind)
        if (event.track.kind === "audio") {
          const audio = new Audio()
          audio.srcObject = event.streams[0]
          audio.play()
        }
      })

      // 6. Offer作成・送信
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)

      const sdpResp = await fetch(`https://api.openai.com/v1/realtime?model=gpt-realtime`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sessionData.client_secret.value}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      })

      if (!sdpResp.ok) {
        throw new Error("SDP answer取得に失敗しました")
      }

      const answerSdp = await sdpResp.text()
      await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp })

      this.onMessage({ 
        type: 'connected', 
        message: 'WebRTC接続完了！リアルタイム音声会話が開始されました🎤' 
      })

    } catch (error) {
      console.error('WebRTC connection error:', error)
      this.onMessage({ type: 'error', message: `接続エラー: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  private setupDataChannelEvents() {
    if (!this.dataChannel) return

    this.dataChannel.addEventListener("open", () => {
      console.log("Data channel opened")
      
      // セッション設定（画像対応）
      const sessionUpdate = {
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          voice: "alloy",
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          instructions: `あなたは一緒に勉強している親しい友達です。Study with meで同じ分野を勉強している仲間として、タメ口で気軽に話しかけてください。

会話の特徴：
- タメ口で親しみやすく（「〜だよ」「〜じゃん」など）
- たまに軽くいじったり冗談を言う友達関係
- 同じ分野を一緒に勉強している仲間感を出す
- 短めの返答（1-2文程度）
- 絵文字を適度に使用

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
        },
      }
      this.dataChannel!.send(JSON.stringify(sessionUpdate))

      // DataChannel接続後に画像分析を実行
    setTimeout(() => {
        this.onMessage({ type: 'dataChannel_ready', message: 'DataChannel準備完了' })
    }, 1000)
    })

    this.dataChannel.addEventListener("message", (event) => {
      const data = JSON.parse(event.data)
      // 重要なメッセージのみログ出力
      if (data.type.includes('error') || data.type.includes('done') || data.type.includes('created')) {
        console.log("Data channel message:", data)
      }
      
      this.handleRealtimeMessage(data)
    })

    this.dataChannel.addEventListener("close", () => {
      console.warn("Data channel closed")
    })

    this.dataChannel.addEventListener("error", (error) => {
      console.error("Data channel error:", error)
      // エラー時は状態をリセット
      this.isSending = false
      this.isResponseActive = false
      this.onMessage({ 
        type: 'error', 
        message: 'DataChannel接続エラーが発生しました。再接続してください。' 
      })
    })
  }

  private handleRealtimeMessage(data: any) {
    switch (data.type) {
      case "response.audio.delta":
        if (data.delta) {
          console.log("Audio delta received, length:", data.delta.length)
          this.playAudioDelta(data.delta)
        }
        break

      case "response.audio.done":
        console.log("Audio response done")
        this.onMessage({ type: 'ai_audio_done', message: '🔊 音声応答完了' })
        break

      case "response.created":
        console.log("Response started")
        this.isResponseActive = true // レスポンス開始
        this.onMessage({ type: 'ai_response_started', message: '🤖 AI応答開始...' })
        break

      case "conversation.item.input_audio_transcription.completed":
        console.log("User transcription:", data.transcript)
        this.onMessage({ 
          type: 'user_transcription', 
          message: `🎤 あなた: ${data.transcript}`,
          transcript: data.transcript
        })
        break

      case "response.text.delta":
        if (data.delta) {
          this.onMessage({ 
            type: 'ai_text_delta', 
            content: data.delta 
          })
        }
        break

      case "response.text.done":
        console.log("Text response done:", data.text)
        this.onMessage({ 
          type: 'ai_text_done', 
          message: `🤖 キャラクター: ${data.text}` 
        })
        break

      case "response.done":
        console.log("Response completed")
        this.isResponseActive = false // レスポンス完了
        this.isSending = false // 送信状態もリセット
        
        if (data.response && data.response.status === 'failed') {
          console.error("🚨 Response failed:", data.response.status_details)
          this.onMessage({ 
            type: 'error', 
            message: `❌ AI応答エラー: ${data.response.status_details?.error?.message || 'Unknown error'}` 
          })
        } else {
          this.onMessage({ type: 'ai_response_done', message: '✅ 応答完了' })
        }
        break

      case "error":
        console.error("OpenAI API error:", data.error)
        this.onMessage({ type: 'error', message: `⚠️ エラー: ${data.error.message}` })
        break
    }
  }

  private playAudioDelta(delta: string) {
    try {
      const audioData = atob(delta)
      const audioArray = new Uint8Array(audioData.length)
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i)
      }
      this.playAudio(audioArray.buffer)
    } catch (error) {
      console.error('Audio playback error:', error)
    }
  }

  private playAudio(audioBuffer: ArrayBuffer) {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    audioContext.decodeAudioData(audioBuffer, (decodedData) => {
      const source = audioContext.createBufferSource()
      source.buffer = decodedData
      source.connect(audioContext.destination)
      source.start()
    }).catch(console.error)
  }

  // 画像圧縮関数（実際の画像処理版）
  private async compressImage(dataUrl: string, maxSizeKB: number = 200): Promise<string> {
    try {
      const originalSizeKB = (dataUrl.length * 0.75) / 1024
      console.log(`🖼️ 画像圧縮開始: ${originalSizeKB.toFixed(2)}KB → 目標: ${maxSizeKB}KB`)
      
      // 目標サイズ以下なら無加工で返す
      if (originalSizeKB <= maxSizeKB) {
        console.log('✅ 圧縮不要（目標サイズ以下）')
        return dataUrl
      }
      
      return new Promise<string>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(dataUrl)
            return
          }
          
          // 高品質を保ちつつ適度に縮小
          const maxDimension = maxSizeKB > 150 ? 800 : 600
          let { width, height } = img
          
          if (width > height) {
            if (width > maxDimension) {
              height = (height * maxDimension) / width
              width = maxDimension
            }
          } else {
            if (height > maxDimension) {
              width = (width * maxDimension) / height
              height = maxDimension
            }
          }
          
          canvas.width = Math.round(width)
          canvas.height = Math.round(height)
          
          // 高品質レンダリング設定
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          // 画像を描画
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          
          // 高品質JPEG（90-95%品質）
          let quality = 0.92
          let compressed = canvas.toDataURL('image/jpeg', quality)
          let compressedSizeKB = (compressed.length * 0.75) / 1024
          
          // 品質を段階的に下げて調整
          while (compressedSizeKB > maxSizeKB && quality > 0.7) {
            quality -= 0.05
            compressed = canvas.toDataURL('image/jpeg', quality)
            compressedSizeKB = (compressed.length * 0.75) / 1024
          }
          
          console.log(`✅ 圧縮完了: ${compressedSizeKB.toFixed(2)}KB (品質: ${(quality * 100).toFixed(0)}%)`)
          resolve(compressed)
        }
        
        img.onerror = () => {
          console.warn('⚠️ 画像読み込み失敗、元画像を返します')
          resolve(dataUrl)
        }
        
        img.src = dataUrl
      }).catch(() => dataUrl) // Promise エラー時も元画像を返す
      
    } catch (error) {
      console.error('画像圧縮エラー:', error)
      
      // エラー時は極小サイズの代替画像を作成
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          canvas.width = maxSizeKB <= 10 ? 100 : 160
          canvas.height = maxSizeKB <= 10 ? 75 : 120
          ctx.fillStyle = '#f0f0f0'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = '#999'
          ctx.font = '12px Arial'
          ctx.fillText('Image Error', 10, canvas.height / 2)
          return canvas.toDataURL('image/jpeg', 0.1)
        }
      } catch {}
      
      return dataUrl
    }
  }

  // 画像分析（OpenAI Realtime API公式ドキュメント通り）
  async sendImages(webcamPhoto: string, screenPhoto: string, studyContext: any) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('Data channel not open. State:', this.dataChannel?.readyState)
      return
    }

    if (this.isSending) {
      console.warn('既に画像送信中です。重複送信を防止します。')
      return
    }

    if (this.isResponseActive) {
      console.warn('AI応答中です。応答完了後に再試行してください。')
      return
    }

    this.isSending = true
    console.log('🖼️ 画像分析開始:', { 
      webcamLength: webcamPhoto.length, 
      screenLength: screenPhoto.length 
    })
    
    // 圧縮なし試行（生画像品質）
    console.log('🔍 圧縮なし試行開始...')
    const webcamOriginalSize = (webcamPhoto.length * 0.75) / 1024
    const screenOriginalSize = (screenPhoto.length * 0.75) / 1024
    console.log(`📊 元画像サイズ: Webcam=${webcamOriginalSize.toFixed(2)}KB, Screen=${screenOriginalSize.toFixed(2)}KB`)
    
    // 高品質画像処理（非同期圧縮）
    let webcamCompressed = webcamPhoto
    let screenCompressed = screenPhoto
    
    // 制限を超える場合のみ圧縮（高品質維持）
    if (webcamOriginalSize > 150) {
      console.log('📷 Webcam画像を高品質圧縮中...')
      webcamCompressed = await this.compressImage(webcamPhoto, 150)
    }
    
    if (screenOriginalSize > 250) {
      console.log('🖥️ Screen画像を高品質圧縮中...')  
      screenCompressed = await this.compressImage(screenPhoto, 250)
    }

    // 公式ドキュメント通りの形式でテキストメッセージ送信
    const textMessage = {
      type: "conversation.item.create",
      previous_item_id: null,
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: studyContext?.isInitialConversation ? 
              "こんにちは！休憩時間ですね✨ 以下の画像から学習状況を確認して、親しみやすく「どんな感じ？」「それ難しいよね〜」のような自然な話し方で声をかけてください。短めに2-3文で。" :
              studyContext?.isRefreshAnalysis ?
              "画面を更新しました📱 新しい学習状況を確認して、進捗やアドバイスをお願いします。短めに2-3文で。" :
              "学習状況を分析して、具体的なアドバイスをください。"
          }
        ]
      }
    }

    // ウェブカメラ画像送信（公式ドキュメント通り）
    const webcamMessage = {
      type: "conversation.item.create",
      previous_item_id: null,
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: webcamCompressed
          }
        ]
      }
    }

    // スクリーン画像送信（公式ドキュメント通り）
    const screenMessage = {
      type: "conversation.item.create", 
      previous_item_id: null,
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_image",
            image_url: screenCompressed
          }
        ]
      }
    }

    // 安全な送信関数
    const sendSafeMessage = (message: any, label: string): boolean => {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
        console.warn(`${label}: DataChannel not ready`)
        return false
      }
      
      const messageStr = JSON.stringify(message)
      const sizeKB = (messageStr.length * 0.75) / 1024
      
      if (sizeKB > 500) { // 圧縮なし対応（制限を大幅緩和）
        console.warn(`${label} 送信スキップ: ${sizeKB.toFixed(2)}KB (制限: 500KB)`)
        return false
      }
      
      try {
        this.dataChannel.send(messageStr)
        console.log(`${label} 送信成功: ${sizeKB.toFixed(2)}KB`)
        return true
      } catch (error) {
        console.error(`${label} 送信エラー:`, error)
        this.isSending = false // エラー時は状態リセット
        return false
      }
    }

    // 順次送信（エラー対応）
    sendSafeMessage(textMessage, '📝 テキスト')

    setTimeout(() => {
      sendSafeMessage(webcamMessage, '📸 ウェブカメラ')
    }, 100)

    setTimeout(() => {
      sendSafeMessage(screenMessage, '🖥️ スクリーン')
    }, 200)

    // 送信完了状態をリセット（バックエンドが自動応答するため、フロントは応答要求不要）
    setTimeout(() => {
      this.isSending = false
      console.log('🎤 画像送信完了：バックエンドで自動応答処理中...')
    }, 100)
  }

  disconnect() {
    // 状態をリセット
    this.isSending = false
    this.isResponseActive = false
    
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
  }
}

export default function Break() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<any>(null)
  const [breakElapsedTime, setBreakElapsedTime] = useState(0)
  const [partialText, setPartialText] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedImages, setCapturedImages] = useState<{
    webcamPhoto: string
    screenPhoto: string
    timestamp: string
  } | null>(null)
  
  // WebRTC Realtime AI関連
  const [aiClient, setAiClient] = useState<WebRTCRealtimeClient | null>(null)
  const [isAiConnected, setIsAiConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [breakId, setBreakId] = useState<string>('')
  const [hasInitialImageSent, setHasInitialImageSent] = useState(false) // 初回送信フラグ

  // 休憩時間の計算（学習時間の1/5）
  const breakDuration = settings ? Math.floor(settings.targetTime / 5 * 60) : 300 // デフォルト5分


  // AI応答のメッセージハンドラ（WebRTC対応）
  const handleAiMessage = async (message: any) => {
    console.log('AI message:', message)
    
    switch (message.type) {
      case 'connected':
      setIsAiConnected(true)
        setIsConnecting(false)
        break
        
      case 'user_transcription':
        // 文字起こし処理（ログなし）
        break
        
      case 'ai_response_started':
        setIsAISpeaking(true)
        break
        
      case 'ai_text_delta':
        setPartialText(prev => prev + message.content)
        break
        
      case 'ai_text_done':
        setPartialText('')
        break
        
      case 'ai_audio_done':
        setIsAISpeaking(false)
        break
        
      case 'ai_response_done':
        setIsAISpeaking(false)
        break
        
      case 'error':
        setIsConnecting(false)
      setIsAiConnected(false)
        break
        
      case 'disconnected':
      setIsAiConnected(false)
        setIsConnecting(false)
        break

      case 'dataChannel_ready':
        // DataChannel準備完了：Break画面で直接リアルタイム撮影して送信
        console.log('📡 DataChannel準備完了イベント受信', {
          settings: !!settings,
          hasInitialImageSent,
          aiClient: !!aiClient,
          settingsContent: settings ? `${settings.studyContent}` : 'null'
        })
        
        // DataChannel準備完了をマーク
        setIsAiConnected(true)
        
        // settingsが既にロードされている場合は即座に実行
        if (settings && !hasInitialImageSent) {
          console.log('🚀 DataChannel準備完了: Break画面で直接スクリーンショット撮影開始')
          setHasInitialImageSent(true) // 初回送信済みマーク
          
          // 初回専用撮影（isAiConnectedチェックなし）
          console.log('📸 handleInitialScreenCapture() 実行開始...')
          handleInitialScreenCapture()
        } else {
          console.log('⏭️ DataChannel準備完了: 初回送信条件に合わず', {
            settings: !!settings,
            hasInitialImageSent,
            reason: !settings ? 'settings not loaded - will retry when settings load' : 'already sent initial image'
          })
        }
        break
        
      default:
        console.log('Unhandled message type:', message.type)
    }
  }

  // AI音声応答ハンドラ
  const handleAiAudio = (audioData: string) => {
    // PCM16音声データの再生処理
    console.log('AI音声データ受信:', audioData.length)
    // TODO: 音声再生実装
  }

  // 設定読み込みと初期化（画像は直接Break画面で撮影）
  useEffect(() => {
    const savedSettings = localStorage.getItem('studySettings')
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings)
      setSettings(parsedSettings)
      console.log('⚙️ Settings読み込み完了:', {
        studyContent: parsedSettings.studyContent,
        startTime: parsedSettings.startTime,
        targetTime: parsedSettings.targetTime
      })
    } else {
      console.warn('⚠️ Settings not found in localStorage')
    }
    
    // Study画面からの古い画像データをクリア
    localStorage.removeItem('capturedImages')
    console.log('🔄 Study画面の画像データをクリア - Break画面で直接撮影を実行')
    
    // breakIdを生成（タイムスタンプベース）
    const generatedBreakId = `break_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setBreakId(generatedBreakId)
  }, [])

  // settingsロード後の初回撮影トリガー
  useEffect(() => {
    // settingsがロードされ、AI接続済み、かつ初回送信未完了の場合
    if (settings && isAiConnected && !hasInitialImageSent && aiClient) {
      console.log('⚙️ Settings + AI接続完了: 初回撮影を実行')
      setHasInitialImageSent(true)
      handleInitialScreenCapture()
    }
  }, [settings, isAiConnected, hasInitialImageSent, aiClient])

  // WebRTC Realtime AI接続
  const startConnection = async () => {
    if (isConnecting || isAiConnected) return
    
    setIsConnecting(true)
    const client = new WebRTCRealtimeClient(breakId, handleAiMessage, handleAiAudio)
      setAiClient(client)
    
    try {
      await client.connect()
      
      // DataChannel接続待ちの処理は削除（DataChannelのopenイベントで実行）
      
    } catch (error) {
      console.error('Connection failed:', error)
      setIsConnecting(false)
    }
  }

  const stopConnection = () => {
    if (aiClient) {
      aiClient.disconnect()
      setAiClient(null)
    }
      setIsAiConnected(false)
    setIsConnecting(false)
    setIsAISpeaking(false)
    }

  // 初期化時のbreakId生成
  useEffect(() => {
    const generatedBreakId = `break_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setBreakId(generatedBreakId)
  }, [])

  // 初回送信はDataChannel準備完了時に統一（重複送信を防ぐため、このuseEffectは無効化）
  // useEffect(() => {
  //   console.log('❌ この初回送信useEffectは無効化されました（重複送信防止）')
  // }, [])

  // Webカメラと音声を開始
  useEffect(() => {
    const startCamera = async () => {
      try {
        console.log('メディアデバイスのアクセスを要求中...')
        
        // より詳細な音声設定
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }, 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          }
        })
        
        console.log('メディアストリーム取得成功:', {
          videoTracks: mediaStream.getVideoTracks().length,
          audioTracks: mediaStream.getAudioTracks().length
        })
        
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
        
        // 音声トラックの状態を確認
        const audioTracks = mediaStream.getAudioTracks()
        if (audioTracks.length > 0) {
          console.log('音声トラック:', {
            enabled: audioTracks[0].enabled,
            readyState: audioTracks[0].readyState,
            settings: audioTracks[0].getSettings()
          })
        } else {
          console.warn('音声トラックが見つかりません')
        }
        
      } catch (error) {
        console.error('カメラ・音声アクセスエラー:', error)
      }
    }

    startCamera()
    
    // 初期メッセージ（ログなし）

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // 休憩タイマー（経過時間のみ - 自動遷移は無効化）
  useEffect(() => {
    const timer = setInterval(() => {
      setBreakElapsedTime(prev => prev + 1)
      
      // 【後で復活】自動遷移ロジックを一時的に無効化
      // setBreakElapsedTime(prev => {
      //   const newTime = prev + 1
      //   
      //   // 休憩時間終了でStudy画面に戻る
      //   if (newTime >= breakDuration) {
      //     navigate('/study')
      //     return newTime
      //   }
      //   
      //   return newTime
      // })
    }, 1000)

    return () => clearInterval(timer)
  }, [])  // 【後で復活】依存配列: [breakDuration, navigate]

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }


  // 初回専用画面撮影（AI接続チェックなし）
  const handleInitialScreenCapture = async () => {
    console.log('🎬 handleInitialScreenCapture() 関数開始', {
      aiClient: !!aiClient,
      settings: !!settings,
      videoRef: !!videoRef.current
    })
    
    if (!aiClient || !settings) {
      console.warn('⚠️ AI接続またはSettingsが不足しています', {
        aiClient: !!aiClient,
        settings: !!settings
      })
      return
    }

    try {
      console.log('🎬 初回画面撮影中: 新しいスクリーンショットを取得...')
      
      // 新しいWebカメラ写真を撮影
      let newWebcamPhoto = ''
      if (videoRef.current) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const video = videoRef.current
        
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          newWebcamPhoto = canvas.toDataURL('image/jpeg', 0.95)
          console.log('✅ 初回Webカメラ撮影成功')
        } else {
          console.warn('❌ 初回Webカメラ撮影失敗 - フォールバック処理')
        }
      }

      // 新しいスクリーン写真を撮影
      let newScreenPhoto = ''
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        })
        
        const video = document.createElement('video')
        video.srcObject = displayStream
        video.muted = true
        await video.play()

        // 動画が安定するまで待機
        await new Promise(resolve => setTimeout(resolve, 500))

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        console.log('📺 初回ビデオ状態チェック:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          currentTime: video.currentTime
        })
        
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          newScreenPhoto = canvas.toDataURL('image/jpeg', 0.95)
          console.log('✅ 初回スクリーンショット撮影成功:', {
            width: video.videoWidth,
            height: video.videoHeight,
            dataLength: newScreenPhoto.length,
            preview: newScreenPhoto.substring(0, 100) + '...'
          })
        } else {
          console.error('❌ 初回スクリーンショット撮影失敗:', {
            ctx: !!ctx,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          })
        }

        // ストリームを停止
        displayStream.getTracks().forEach(track => track.stop())
      } catch (error) {
        console.error('初回スクリーンキャプチャエラー:', error)
        // エラーの場合は既存の画像を使用
        newScreenPhoto = capturedImages?.screenPhoto || ''
      }

      // 画像検証とログ
      console.log('初回取得した画像の検証:', {
        webcam: {
          hasData: !!newWebcamPhoto,
          length: newWebcamPhoto.length,
          isValidDataUrl: newWebcamPhoto.startsWith('data:image/')
        },
        screen: {
          hasData: !!newScreenPhoto,
          length: newScreenPhoto.length,
          isValidDataUrl: newScreenPhoto.startsWith('data:image/')
        }
      })

      // 新しい画像でcapturedImagesを更新
      const newCapturedImages = {
        webcamPhoto: newWebcamPhoto || capturedImages?.webcamPhoto || '',
        screenPhoto: newScreenPhoto || capturedImages?.screenPhoto || '',
        timestamp: new Date().toISOString()
      }
      setCapturedImages(newCapturedImages)

      // 画像の最終確認
      if (!newCapturedImages.screenPhoto || newCapturedImages.screenPhoto.length < 1000) {
        console.warn('初回スクリーン画像が正常に取得できませんでした。')
        return
      }

      // 初回コンテキストでAI分析実行
      const studyContext = {
        studyContent: settings.studyContent,
        elapsedTime: Date.now() - new Date(settings.startTime).getTime(),
        targetTime: settings.targetTime,
        pomodoroTime: settings.pomodoroTime,
        isInitialConversation: true // 初回会話フラグ
      }
      
      console.log('🚀 初回撮影完了: AIに現在の画面を送信中...', {
        webcamSize: newCapturedImages.webcamPhoto.length,
        screenSize: newCapturedImages.screenPhoto.length,
        timestamp: newCapturedImages.timestamp,
        webcamPreview: newCapturedImages.webcamPhoto.substring(0, 50),
        screenPreview: newCapturedImages.screenPhoto.substring(0, 50),
        isInitialCapture: true,
        captureLocation: 'Break画面初回撮影'
      })
      await aiClient.sendImages(newCapturedImages.webcamPhoto, newCapturedImages.screenPhoto, studyContext)
        
    } catch (error) {
      console.error('初回画面撮影エラー:', error)
    }
  }

  // 画面更新＋再分析処理（新しいスクリーンショットを取得）
  const handleRefreshAndAnalyze = async () => {
    if (!aiClient || !isAiConnected || !settings) {
      console.warn('AI接続が確立されていません')
        return
      }

      try {
      console.log('画面更新中: 新しいスクリーンショットを取得...')
      
      // 新しいWebカメラ写真を撮影
      let newWebcamPhoto = ''
      if (videoRef.current) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const video = videoRef.current

        if (video.videoWidth && video.videoHeight && ctx) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          newWebcamPhoto = canvas.toDataURL('image/jpeg', 0.95)
          console.log('新しいWebカメラ撮影成功')
        }
      }

      // 新しいスクリーン写真を撮影
      let newScreenPhoto = ''
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: false
        })
        
        const video = document.createElement('video')
        video.srcObject = displayStream
        video.muted = true
        await video.play()

        // 動画が安定するまで待機
        await new Promise(resolve => setTimeout(resolve, 500))

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        console.log('📺 ビデオ状態チェック:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          currentTime: video.currentTime
        })
        
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
          newScreenPhoto = canvas.toDataURL('image/jpeg', 0.95)
          console.log('✅ 新しいスクリーンショット撮影成功:', {
            width: video.videoWidth,
            height: video.videoHeight,
            dataLength: newScreenPhoto.length,
            preview: newScreenPhoto.substring(0, 100) + '...'
          })
        } else {
          console.error('❌ スクリーンショット撮影失敗:', {
            ctx: !!ctx,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight
          })
        }

        // ストリームを停止
        displayStream.getTracks().forEach(track => track.stop())
      } catch (error) {
        console.error('スクリーンショット撮影エラー:', error)
        // エラーの場合は既存の画像を使用
        newScreenPhoto = capturedImages?.screenPhoto || ''
      }

      // 画像検証とログ
      console.log('取得した画像の検証:', {
        webcam: {
          hasData: !!newWebcamPhoto,
          length: newWebcamPhoto.length,
          isValidDataUrl: newWebcamPhoto.startsWith('data:image/')
        },
        screen: {
          hasData: !!newScreenPhoto,
          length: newScreenPhoto.length,
          isValidDataUrl: newScreenPhoto.startsWith('data:image/')
        }
      })

      // 新しい画像でcapturedImagesを更新
      const newCapturedImages = {
        webcamPhoto: newWebcamPhoto || capturedImages?.webcamPhoto || '',
        screenPhoto: newScreenPhoto || capturedImages?.screenPhoto || '', // フォールバック追加
        timestamp: new Date().toISOString()
      }
      setCapturedImages(newCapturedImages)

      // 画像の最終確認
      if (!newCapturedImages.screenPhoto || newCapturedImages.screenPhoto.length < 1000) {
        console.warn('スクリーン画像が正常に取得できませんでした。既存画像を使用します。')
        newCapturedImages.screenPhoto = capturedImages?.screenPhoto || ''
      }

      // 更新されたコンテキストでAI分析実行
      const studyContext = {
        studyContent: settings.studyContent,
        elapsedTime: Date.now() - new Date(settings.startTime).getTime(),
        targetTime: settings.targetTime,
        pomodoroTime: settings.pomodoroTime,
        isRefreshAnalysis: true // 更新分析フラグ
      }
      
      const isInitialCapture = !hasInitialImageSent
      console.log(`🚀 ${isInitialCapture ? '初回' : '更新'}撮影完了: AIに現在の画面を送信中...`, {
        webcamSize: newCapturedImages.webcamPhoto.length,
        screenSize: newCapturedImages.screenPhoto.length,
        timestamp: newCapturedImages.timestamp,
        webcamPreview: newCapturedImages.webcamPhoto.substring(0, 50),
        screenPreview: newCapturedImages.screenPhoto.substring(0, 50),
        isInitialCapture,
        captureLocation: 'Break画面直接撮影'
      })
      await aiClient.sendImages(newCapturedImages.webcamPhoto, newCapturedImages.screenPhoto, studyContext)
        
      } catch (error) {
      console.error('画面更新エラー:', error)
    }
  }

  const handleContinueStudy = () => {
    navigate('/study')
  }

  // デバッグ用：キャッシュクリア機能
  const handleClearCache = () => {
    localStorage.removeItem('capturedImages')
    setCapturedImages(null)
    setHasInitialImageSent(false)
    console.log('🗑️ キャッシュをクリアしました')
    alert('画像キャッシュをクリアしました。新しいスクリーンショットを撮影してください。')
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
          {/* 【後で復活】残り時間表示を一時的に無効化 */}
          {/* <div style={{ color: '#ccc', fontSize: '12px' }}>
            残り: {formatTime(Math.max(0, breakDuration - breakElapsedTime))}
          </div> */}
        </div>

        {/* Zoom風のシンプル通話UI */}
        <div style={{
          background: '#2a2a2a',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          {/* AI音声インジケーター */}
          {isAISpeaking && (
            <div style={{
          marginBottom: '15px',
              color: '#4ecdc4',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#4ecdc4',
                borderRadius: '50%',
                animation: 'pulse 1s infinite'
              }}></div>
              🤖 キャラクターが話しています...
          </div>
          )}
          
          {/* 接続状態表示 */}
          <div style={{
            fontSize: '16px',
            color: isAiConnected ? '#4ecdc4' : '#ff6b6b',
            marginBottom: '10px'
          }}>
            {isAiConnected ? '🔗 AIキャラクターと接続中' : '❌ 接続していません'}
          </div>
          
          {/* 部分的なテキスト表示（リアルタイム） */}
          {partialText && (
            <div style={{
              background: 'rgba(78, 205, 196, 0.1)',
              borderRadius: '8px',
              padding: '10px',
              margin: '10px 0',
                fontSize: '14px',
              color: '#4ecdc4',
              fontStyle: 'italic'
            }}>
              💭 {partialText}
            </div>
          )}
        </div>

        {/* AI接続状況 */}
        <div style={{
          padding: '10px',
          background: isAiConnected ? 'rgba(40, 167, 69, 0.2)' : 
                     isConnecting ? 'rgba(255, 193, 7, 0.2)' : 'rgba(220, 53, 69, 0.2)',
          borderRadius: '6px',
          border: `1px solid ${isAiConnected ? '#28a745' : 
                                isConnecting ? '#ffc107' : '#dc3545'}`,
          fontSize: '12px',
          textAlign: 'center',
          marginBottom: '10px'
        }}>
          {isAiConnected ? '🟢 WebRTC接続中（リアルタイム音声対話）' : 
           isConnecting ? '🟡 接続中...' : '🔴 未接続'}
        </div>

        {/* AI状態表示 */}
        {isAISpeaking && (
          <div style={{
            padding: '8px',
            background: 'rgba(76, 175, 80, 0.2)',
            borderRadius: '4px',
            fontSize: '12px',
            marginBottom: '10px',
            color: '#4caf50',
            textAlign: 'center'
          }}>
            🤖 AIが話しています...
          </div>
        )}

        {/* 現在生成中のテキスト */}
        {partialText && (
          <div style={{
            padding: '10px',
            background: 'rgba(33, 150, 243, 0.1)',
            borderRadius: '6px',
            marginBottom: '10px',
            fontSize: '14px',
            color: '#2196f3',
            opacity: 0.7
          }}>
            🤖 生成中: {partialText}
          </div>
        )}

        {/* AI接続状態に応じたボタン表示 */}
        {!isAiConnected && !isConnecting ? (
          /* 音声対話開始ボタン */
          <div style={{ marginBottom: '15px' }}>
        <button
              onClick={startConnection}
          style={{
            padding: '15px',
                background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
                cursor: 'pointer',
            fontSize: '16px',
                fontWeight: 'bold',
                width: '100%'
          }}
        >
              🎤 リアルタイム音声対話を開始
        </button>
          </div>
        ) : (
          /* AI接続中のコントロール */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
            <button
              onClick={stopConnection}
              style={{
                padding: '12px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              🔇 音声対話を終了
            </button>
          </div>
        )}

        {/* 画面更新ボタン（AI接続中のみ、独立して表示） */}
        {isAiConnected && (
          <div style={{ marginBottom: '15px' }}>
            <button
              onClick={handleRefreshAndAnalyze}
              style={{
                padding: '12px',
                background: 'linear-gradient(45deg, #17a2b8, #20c997)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                width: '100%',
                boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              🔄 画面更新＋再分析
            </button>
          </div>
        )}

        {/* ナビゲーションボタン */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
          
          {/* デバッグ用キャッシュクリアボタン */}
          <button
            onClick={handleClearCache}
            style={{
              padding: '8px',
              background: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              opacity: 0.7
            }}
          >
            🗑️ 画像キャッシュクリア（デバッグ用）
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

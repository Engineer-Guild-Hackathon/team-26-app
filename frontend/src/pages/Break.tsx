import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import TalkAnimation from '../components/TalkAnimation'
import { type MaterialFolder, type MaterialFile, firebaseMaterialsService } from '../services/firebaseMaterials'

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
  // private isResponseActive: boolean = false // 現在未使用
  constructor(_breakId: string, onMessage: (message: any) => void, _onAudioResponse: (audioData: string) => void) {
    this.onMessage = onMessage
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
        throw new Error(`SDP送信失敗: ${sdpResp.status}`)
      }

      const answerSdp = await sdpResp.text()
      await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp })

      console.log('WebRTC接続完了')
    } catch (error) {
      console.error('WebRTC接続エラー:', error)
      throw error
    }
  }

  private setupDataChannelEvents() {
    if (!this.dataChannel) return

    this.dataChannel.addEventListener("open", () => {
      console.log("DataChannel opened")
      this.onMessage({ type: 'connected', message: '🔗 WebRTC接続完了' })
    })

    this.dataChannel.addEventListener("message", (event) => {
      try {
      const data = JSON.parse(event.data)
      this.handleRealtimeMessage(data)
      } catch (error) {
        console.error("Message parsing error:", error)
      }
    })

    this.dataChannel.addEventListener("close", () => {
      console.log("DataChannel closed")
      this.onMessage({ type: 'disconnected', message: '❌ 接続が切断されました' })
    })

    this.dataChannel.addEventListener("error", (error) => {
      console.error("DataChannel error:", error)
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
        // this.isResponseActive = true
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
        // this.isResponseActive = false
        this.onMessage({ type: 'ai_response_completed', message: '✅ AI応答完了' })
        break

      default:
        console.log("Unhandled message type:", data.type, data)
        break
    }
  }

  private playAudioDelta(base64Audio: string) {
    // PCM16音声データの再生処理
    console.log('AI音声データ受信:', base64Audio.length)
    // TODO: 音声再生実装
  }

  // 公開メソッド：メッセージ送信
  sendMessage(message: any) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(message))
    } else {
      console.warn('DataChannel is not open')
    }
  }

  // 公開メソッド：DataChannel状態確認
  isDataChannelOpen(): boolean {
    return this.dataChannel !== null && this.dataChannel.readyState === 'open'
  }

  disconnect() {
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
  const [_settings, setSettings] = useState<any>(null)
  const [breakElapsedTime, setBreakElapsedTime] = useState(0)
  const [partialText, setPartialText] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  
  // WebRTC Realtime AI関連
  const [aiClient, setAiClient] = useState<WebRTCRealtimeClient | null>(null)
  const [isAiConnected, setIsAiConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [breakId, setBreakId] = useState<string>('')
  
  // 教材選択関連
  const [allFolders, setAllFolders] = useState<MaterialFolder[]>([])
  const [currentFolder, setCurrentFolder] = useState<MaterialFolder | null>(null)
  const [files, setFiles] = useState<MaterialFile[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialFile | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<MaterialFolder[]>([])
  
  // フリック操作関連
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number, y: number } | null>(null)

  // 教材管理ロジック
  const fetchAllFolders = async () => {
    try {
      const rootFolders = await firebaseMaterialsService.getFolders()
      const allFoldersData: MaterialFolder[] = [...rootFolders]
      
      for (const folder of rootFolders) {
        const childFolders = await loadChildFolders(folder.id, allFoldersData)
        allFoldersData.push(...childFolders)
      }
      
      setAllFolders(allFoldersData)
    } catch (error) {
      console.error('フォルダ取得エラー:', error)
    }
  }

  const loadChildFolders = async (parentId: string, currentFolders: MaterialFolder[]): Promise<MaterialFolder[]> => {
    try {
      const childFolders = await firebaseMaterialsService.getChildFolders(parentId)
      const allChildren: MaterialFolder[] = [...childFolders]
      
      for (const child of childFolders) {
        const grandChildren = await loadChildFolders(child.id, [...currentFolders, ...allChildren])
        allChildren.push(...grandChildren)
      }
      
      return allChildren
    } catch (error) {
      console.error(`子フォルダ取得エラー (parentId: ${parentId}):`, error)
      return []
    }
  }

  const fetchFiles = async (folderId: string | null) => {
    if (!folderId) {
      setFiles([])
      return
    }

    try {
      const filesData = await firebaseMaterialsService.getFiles(folderId)
      setFiles(filesData)
    } catch (error) {
      console.error('ファイル取得エラー:', error)
    }
  }

  // パンくずリスト生成
  const generateBreadcrumbs = (folder: MaterialFolder | null) => {
    if (!folder) return []
    
    const breadcrumbs: MaterialFolder[] = []
    let currentItem: MaterialFolder | undefined = folder
    
    while (currentItem) {
      breadcrumbs.unshift(currentItem)
      currentItem = allFolders.find(f => f.id === currentItem?.parentId)
    }
    
    setBreadcrumbs(breadcrumbs)
    return breadcrumbs
  }

  // フォルダナビゲーション
  const handleFolderClick = (folder: MaterialFolder) => {
    setCurrentFolder(folder)
    fetchFiles(folder.id)
    generateBreadcrumbs(folder)
  }

  const handleNavigateToRoot = () => {
    setCurrentFolder(null)
    fetchFiles(null)
    setBreadcrumbs([])
  }

  // 教材選択
  const handleMaterialSelect = (file: MaterialFile) => {
    setSelectedMaterial(file)
  }

  // フリック操作のハンドラ（Study.tsxと同じロジック）
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setTouchEnd(null)
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const distanceX = touchStart.x - touchEnd.x
    const distanceY = touchStart.y - touchEnd.y
    const isLeftSwipe = distanceX > 50
    const isRightSwipe = distanceX < -50
    const isUpSwipe = distanceY > 50
    const isDownSwipe = distanceY < -50

    // 横フリック：同階層のファイル間移動
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe && files.length > 0) {
        const nextIndex = (currentFileIndex + 1) % files.length
        setCurrentFileIndex(nextIndex)
        setSelectedMaterial(files[nextIndex])
      } else if (isRightSwipe && files.length > 0) {
        const prevIndex = currentFileIndex === 0 ? files.length - 1 : currentFileIndex - 1
        setCurrentFileIndex(prevIndex)
        setSelectedMaterial(files[prevIndex])
      }
    }
    // 縦フリック：階層間移動
    else {
      if (isUpSwipe && currentFolder) {
        const parentFolder = allFolders.find(f => f.id === currentFolder.parentId)
        if (parentFolder) {
          setCurrentFolder(parentFolder)
          fetchFiles(parentFolder.id)
          generateBreadcrumbs(parentFolder)
        } else {
          handleNavigateToRoot()
        }
      } else if (isDownSwipe && childFolders.length > 0) {
        const firstChild = childFolders[0]
        handleFolderClick(firstChild)
      }
    }
  }

  // ファイル変更時にインデックスをリセット
  useEffect(() => {
    setCurrentFileIndex(0)
    if (files.length > 0) {
      setSelectedMaterial(files[0])
    } else {
      setSelectedMaterial(null)
    }
  }, [files])

  // 教材をAIに送信
  const sendMaterialToAI = async () => {
    if (!selectedMaterial || !aiClient || !isAiConnected) {
      alert('教材が選択されていないか、AI接続が確立されていません')
      return
    }

    try {
      console.log('教材をAIに送信:', selectedMaterial)
      
      if (selectedMaterial.type === 'text' && selectedMaterial.content) {
        // テキスト教材の場合：session.updateでシステムメッセージとして設定
        const sessionUpdateMessage = {
          type: 'session.update',
          session: {
            instructions: `あなたは学習支援AIです。現在、学習者は以下の教材について勉強中です：

【教材名】${selectedMaterial.name}
【内容】
${selectedMaterial.content}

この教材について、学習者が理解しやすいよう説明し、質問に答えて、一緒に学習をサポートしてください。学習者が質問していない場合は、この教材について何か分からないことがないか優しく聞いてください。`
          }
        }
        
        aiClient.sendMessage(sessionUpdateMessage)
        
        // 初回挨拶メッセージ
        const greetingMessage = {
          type: 'conversation.item.create',
      item: {
            type: 'message',
            role: 'user',
        content: [
          {
                type: 'text',
                text: `こんにちは！今「${selectedMaterial.name}」について勉強しています。この教材について一緒に学習しませんか？`
              }
            ]
          }
        }
        
        aiClient.sendMessage(greetingMessage)
        
      } else if (selectedMaterial.type === 'image') {
        // 画像教材の場合：通常のメッセージとして送信
        const message = {
          type: 'conversation.item.create',
      item: {
            type: 'message',
            role: 'user',
        content: [
          {
                type: 'text',
                text: `こんにちは！今「${selectedMaterial.name}」という画像教材について勉強しています。3D空間に表示されている画像について、何か質問があったら教えてください。`
              }
            ]
          }
        }
        
        aiClient.sendMessage(message)
      }

      // 会話生成のリクエスト
      const responseRequest = {
        type: 'response.create',
        response: {
          modalities: ['text', 'audio']
        }
      }

      aiClient.sendMessage(responseRequest)
      
      const materialType = selectedMaterial.type === 'text' ? 'テキスト' : '画像'
      alert(`${materialType}教材「${selectedMaterial.name}」をAIに送信しました！`)
      
    } catch (error) {
      console.error('教材送信エラー:', error)
      alert('教材の送信に失敗しました')
    }
  }

  // AI応答のメッセージハンドラ
  const handleAiMessage = async (message: any) => {
    console.log('AI message:', message)
    
    switch (message.type) {
      case 'connected':
      setIsAiConnected(true)
        setIsConnecting(false)
        break
        
      case 'user_transcription':
        break
        
      case 'ai_response_started':
        setIsAISpeaking(true)
        setPartialText('')
        break
        
      case 'ai_text_delta':
        setPartialText(prev => prev + message.content)
        break
        
      case 'ai_text_done':
        setPartialText('')
        break
        
      case 'ai_response_completed':
        setIsAISpeaking(false)
        setPartialText('')
        break
        
      case 'disconnected':
      setIsAiConnected(false)
        setIsConnecting(false)
        setIsAISpeaking(false)
        setPartialText('')
        break
    }
  }

  const handleAiAudio = (audioData: string) => {
    console.log('AI音声データ受信:', audioData.length)
  }

  // 設定読み込みと初期化
  useEffect(() => {
    const savedSettings = localStorage.getItem('studySettings')
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings)
      setSettings(parsedSettings)
    }
    
    // 選択された教材を読み込み
    const savedMaterial = localStorage.getItem('selectedMaterial')
    if (savedMaterial) {
      try {
        const material = JSON.parse(savedMaterial)
        setSelectedMaterial(material)
        console.log('📚 Study画面から教材を引き継ぎ:', material)
      } catch (error) {
        console.error('教材データの読み込みエラー:', error)
      }
    }
    
    // 教材フォルダを取得
    fetchAllFolders()
    fetchFiles(null)
    
    // breakIdを生成
    const generatedBreakId = `break_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setBreakId(generatedBreakId)
    
    // 自動WebRTC接続をチェック
    const autoConnect = localStorage.getItem('autoConnectWebRTC')
    if (autoConnect === 'true') {
      console.log('🚀 自動WebRTC接続を開始')
      localStorage.removeItem('autoConnectWebRTC')
      setTimeout(() => {
        startConnection()
      }, 1000)
    }
  }, [])

  // WebRTC Realtime AI接続
  const startConnection = async () => {
    if (isConnecting || isAiConnected) return
    
    setIsConnecting(true)
    const client = new WebRTCRealtimeClient(breakId, handleAiMessage, handleAiAudio)
      setAiClient(client)
    
    try {
      await client.connect()
    } catch (error) {
      console.error('Connection failed:', error)
      setIsConnecting(false)
    }
  }

  // const stopConnection = () => {
  //   if (aiClient) {
  //     aiClient.disconnect()
  //     setAiClient(null)
  //   }
  //   setIsAiConnected(false)
  //   setIsConnecting(false)
  //   setIsAISpeaking(false)
  // }

  // Webカメラを開始
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
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

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // タイマー機能
  useEffect(() => {
    const timer = setInterval(() => {
      setBreakElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 現在のフォルダの子フォルダ
  const childFolders = allFolders.filter(folder => 
    folder.parentId === (currentFolder?.id || null)
  )

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* 左側：教材選択エリア */}
      <div style={{
        width: '300px', 
        padding: '20px',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Webカメラ */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            color: 'white', 
            fontSize: '16px',
            textAlign: 'center'
          }}>
            Webカメラ
          </h3>
          <div style={{
            width: '100%',
            height: '150px',
            background: '#000',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative'
          }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{
            width: '100%',
                height: '100%',
                objectFit: 'cover'
                  }}
                />
              </div>
              </div>
        
        {/* 経過時間 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            color: 'white', 
            fontSize: '16px'
          }}>
            経過時間
          </h3>
              <div style={{
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: 'white',
            fontFamily: 'monospace'
          }}>
            {formatTime(breakElapsedTime)}
          </div>
              </div>
              
        {/* フリック対応 階層ナビゲーション */}
        <div 
                  style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            touchAction: 'none'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <h3 style={{ 
            margin: '0 0 12px 0', 
            color: 'white', 
            fontSize: '16px'
          }}>
            教材選択
            <span style={{ fontSize: '12px', opacity: 0.7 }}>
              (フリックで移動)
            </span>
          </h3>
          
          {/* 現在の位置とファイル表示 */}
        <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '12px',
            color: 'white'
          }}>
            <div style={{ marginBottom: '4px' }}>
              📍 {breadcrumbs.length > 0 ? breadcrumbs.map(folder => folder.name).join(' > ') : 'ルート'}
          </div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>
              📁 {childFolders.length}フォルダ | 📄 {files.length}ファイル
              {files.length > 0 && selectedMaterial && (
                <span> | 選択中: {currentFileIndex + 1}/{files.length}</span>
              )}
            </div>
        </div>

          {/* 現在選択中の教材 */}
          {selectedMaterial && (
        <div style={{
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
        }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
                gap: '8px',
                marginBottom: '8px'
            }}>
                <span style={{ fontSize: '20px' }}>
                  {selectedMaterial.type === 'text' ? '📄' : '🖼️'}
                </span>
                <div>
              <div style={{
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: 'white'
                  }}>
                    {selectedMaterial.name}
          </div>
            <div style={{
                    fontSize: '11px', 
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    {selectedMaterial.type === 'text' ? 'テキスト教材' : '画像教材'} (3D表示中)
            </div>
        </div>
        </div>
          </div>
        )}

          {/* パンくずリスト */}
          <div style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            marginBottom: '12px',
            fontSize: '12px',
            flexWrap: 'wrap'
          }}>
        <button
              onClick={handleNavigateToRoot}
          style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
            color: 'white',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '10px'
          }}
        >
              🏠 ルート
        </button>
            
            {breadcrumbs.map((folder, index) => (
              <div key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>/</span>
            <button
                  onClick={() => handleFolderClick(folder)}
              style={{
                    background: index === breadcrumbs.length - 1 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                    color: 'white',
                    cursor: index === breadcrumbs.length - 1 ? 'default' : 'pointer',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: index === breadcrumbs.length - 1 ? '600' : '400'
                  }}
                >
                  {folder.name}
            </button>
          </div>
            ))}
          </div>

          {/* フォルダ一覧 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {childFolders.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '14px', 
                  color: 'white' 
                }}>
                  📂 フォルダ
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {childFolders.slice(0, 3).map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => handleFolderClick(folder)}
              style={{
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <span>📁</span>
                      <span style={{ fontSize: '12px', color: 'white', fontWeight: '500' }}>
                        {folder.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ファイル一覧 */}
            {files.length > 0 && (
              <div>
                <h4 style={{ 
                  margin: '0 0 8px 0', 
                fontSize: '14px',
                  color: 'white' 
                }}>
                  📄 教材
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {files.slice(0, 5).map((file) => (
                    <div
                      key={file.id}
                      onClick={() => handleMaterialSelect(file)}
                      style={{
                        padding: '8px 12px',
                        background: selectedMaterial?.id === file.id ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                        border: selectedMaterial?.id === file.id ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedMaterial?.id !== file.id) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedMaterial?.id !== file.id) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                        }
                      }}
                    >
                      <span>{file.type === 'text' ? '📄' : '🖼️'}</span>
                      <span style={{ fontSize: '12px', color: 'white', fontWeight: '500' }}>
                        {file.name}
                      </span>
                    </div>
                  ))}
                </div>
          </div>
        )}

            {/* 送信ボタン */}
            {selectedMaterial && (
              <div style={{ marginTop: '16px' }}>
          <button
                  onClick={sendMaterialToAI}
                  disabled={!isAiConnected}
            style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: isAiConnected ? 'rgba(16, 185, 129, 0.8)' : 'rgba(107, 114, 128, 0.5)',
              color: 'white',
              border: 'none',
                    borderRadius: '12px',
                    cursor: isAiConnected ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    if (isAiConnected) {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 1)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isAiConnected) {
                      e.currentTarget.style.background = 'rgba(16, 185, 129, 0.8)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }
                  }}
                >
                  📤 送信
          </button>
                {!isAiConnected && (
                  <p style={{ 
                    margin: '8px 0 0 0', 
                    fontSize: '12px', 
                    color: 'rgba(239, 68, 68, 0.8)',
                    textAlign: 'center'
                  }}>
                    AI接続中...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右側：TalkAnimationエリア */}
      <div style={{ 
        flex: 1, 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <TalkAnimation selectedMaterial={selectedMaterial} />
        
        {/* AI接続状態表示 */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 10,
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: isAiConnected ? '#10b981' : isConnecting ? '#f59e0b' : '#ef4444'
          }} />
          <span style={{ 
            fontSize: '14px', 
            fontWeight: '600',
            color: '#333'
          }}>
            {isAiConnected ? 'AI接続中' : isConnecting ? '接続中...' : 'AI未接続'}
          </span>
        </div>

        {/* AI接続ボタン（未接続時のみ） */}
        {!isAiConnected && !isConnecting && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 10
          }}>
          <button
              onClick={startConnection}
            style={{
                padding: '12px 24px',
                background: 'rgba(16, 185, 129, 0.8)',
              color: 'white',
              border: 'none',
                borderRadius: '16px',
              cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.8)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              AI接続開始
            </button>
          </div>
        )}

        {/* Study画面に戻るボタン */}
        <div style={{
          position: 'absolute',
          top: '80px',
          right: '20px',
          zIndex: 10
        }}>
          <button
            onClick={() => navigate('/study')}
            style={{
              padding: '12px 24px',
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            勉強に戻る
          </button>
      </div>

        {/* AI音声インジケーター */}
        {isAISpeaking && (
        <div style={{
          position: 'absolute',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(16, 185, 129, 0.9)',
          color: 'white',
            padding: '12px 24px',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: 'white',
              borderRadius: '50%',
              animation: 'pulse 1s infinite'
            }}></div>
            🤖 キャラクターが話しています...
          </div>
        )}

        {/* 部分的なテキスト表示 */}
        {partialText && (
        <div style={{
          position: 'absolute',
            bottom: '140px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(59, 130, 246, 0.9)',
          color: 'white',
            padding: '16px 24px',
            borderRadius: '16px',
            maxWidth: '600px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            fontStyle: 'italic'
          }}>
            💭 {partialText}...
          </div>
        )}

        {/* 選択教材の表示 */}
        {selectedMaterial && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            maxWidth: '400px'
          }}>
            <span style={{ fontSize: '20px' }}>
              {selectedMaterial.type === 'text' ? '📄' : '🖼️'}
            </span>
            <div>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: '#333',
                marginBottom: '4px'
              }}>
                選択中: {selectedMaterial.name}
        </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#666'
              }}>
                この教材についてキャラクターと話そう
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

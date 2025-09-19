import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import TalkAnimation from '../components/TalkAnimation'
import { type MaterialFolder, type MaterialFile, firebaseMaterialsService } from 'src/services/firebaseMaterials'


// CSS for animations and styling
const styles = `
 @keyframes pulse {
   0% { opacity: 1; transform: scale(1); }
   50% { opacity: 0.5; transform: scale(0.9); }
   100% { opacity: 1; transform: scale(1); }
 }
 .no-scrollbar::-webkit-scrollbar {
   display: none;
 }
 .no-scrollbar {
   -ms-overflow-style: none;
   scrollbar-width: none;
 }
`
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


 constructor(_breakId: string, onMessage: (message: any) => void, _onAudioResponse: (audioData: string) => void) {
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


教材についてフランクに話し、学習者を励ましてください。`,
       },
     }
     this.dataChannel!.send(JSON.stringify(sessionUpdate))


     this.onMessage({ type: 'connected' })
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


 // 画像圧縮関数（Blob版）
 private async compressImageBlob(blob: Blob, maxSizeKB: number): Promise<string> {
   return new Promise((resolve, reject) => {
       const img = new Image()
       img.onload = () => {
         const canvas = document.createElement('canvas')
         const ctx = canvas.getContext('2d')
         if (!ctx) {
         reject(new Error('Canvas context not available'))
           return
         }
        
       // 適度に縮小（maxSizeKBに応じてサイズ調整）
       const maxDimension = maxSizeKB > 80 ? 600 : 400
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
        
       // 高品質レンダリング
         ctx.imageSmoothingEnabled = true
         ctx.imageSmoothingQuality = 'high'
         ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
       // 品質を段階的に下げて調整
       let quality = 0.85
         let compressed = canvas.toDataURL('image/jpeg', quality)
         let compressedSizeKB = (compressed.length * 0.75) / 1024
        
       while (compressedSizeKB > maxSizeKB && quality > 0.5) {
           quality -= 0.05
           compressed = canvas.toDataURL('image/jpeg', quality)
           compressedSizeKB = (compressed.length * 0.75) / 1024
         }
        
         resolve(compressed)
       }
      
     img.onerror = () => reject(new Error('Image load failed'))
     img.src = URL.createObjectURL(blob)
   })
 }


 // 教材送信機能
 async sendMaterial(material: MaterialFile, content?: string) {
   if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
     console.error('Data channel not open. State:', this.dataChannel?.readyState)
     return
   }


   if (this.isSending) {
     console.warn('既に送信中です。重複送信を防止します。')
     return
   }


   if (this.isResponseActive) {
     console.warn('AI応答中です。応答完了後に再試行してください。')
     return
   }


   this.isSending = true
   console.log('📚 教材送信開始:', material.name)


   try {
     if (material.type === 'text' && content) {
       // テキスト教材の場合
   const textMessage = {
     type: "conversation.item.create",
     item: {
       type: "message",
       role: "user",
       content: [
         {
           type: "input_text",
               text: `「${material.name}」について話そう！\n\n【内容】\n${content}`
             }
           ]
         }
       }
       this.dataChannel.send(JSON.stringify(textMessage))
      
     } else if (material.type === 'image' && material.downloadURL) {
       // 画像教材の場合：テキストと画像の両方を送信
       const textMessage = {
     type: "conversation.item.create",
     item: {
       type: "message",
       role: "user",
       content: [
         {
               type: "input_text",
               text: `「${material.name}」という画像について話そう！`
             }
           ]
         }
       }
       this.dataChannel.send(JSON.stringify(textMessage))
      
       // 画像をbase64に変換して送信
       setTimeout(async () => {
         try {
           console.log('🖼️ 画像をbase64に変換中:', material.downloadURL)
           const response = await fetch(material.downloadURL)
           const blob = await response.blob()
          
           // 画像を圧縮してからBase64変換
           const compressedBase64 = await this.compressImageBlob(blob, 100) // 100KB制限
           console.log('✅ 圧縮済みBase64変換完了:', compressedBase64.substring(0, 100) + '...')
           console.log('📊 圧縮後サイズ:', Math.round((compressedBase64.length * 0.75) / 1024), 'KB')
          
           const imageMessage = {
     type: "conversation.item.create",
     item: {
       type: "message",
       role: "user",
       content: [
         {
           type: "input_image",
                   image_url: compressedBase64
                 }
               ]
             }
           }
          
           // メッセージサイズをチェック
           const messageStr = JSON.stringify(imageMessage)
           const messageSizeKB = (messageStr.length * 0.75) / 1024
           console.log('📦 メッセージサイズ:', messageSizeKB.toFixed(2), 'KB')
          
           if (messageSizeKB > 150) {
             console.warn('⚠️ メッセージが大きすぎます:', messageSizeKB.toFixed(2), 'KB')
             return
           }
          
           this.dataChannel!.send(messageStr)
          
     } catch (error) {
           console.error('❌ 画像処理エラー:', error)
     }
       }, 100)
   }


   setTimeout(() => {
       const responseRequest = {
         type: 'response.create',
         response: {
           modalities: ['text', 'audio']
         }
       }
       this.dataChannel!.send(JSON.stringify(responseRequest))
       this.isSending = false
   }, 200)


   } catch (error) {
     console.error('教材送信エラー:', error)
     this.isSending = false
   }
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
 const [breakElapsedTime, setBreakElapsedTime] = useState(0)
 const [partialText, setPartialText] = useState('')
 const videoRef = useRef<HTMLVideoElement>(null)
 const [stream, setStream] = useState<MediaStream | null>(null)
  // WebRTC Realtime AI関連
 const [aiClient, setAiClient] = useState<WebRTCRealtimeClient | null>(null)
 const [isAiConnected, setIsAiConnected] = useState(false)
 const [isConnecting, setIsConnecting] = useState(false)
 const [isAISpeaking, setIsAISpeaking] = useState(false)
 const [conversationLog, setConversationLog] = useState<{role: 'user' | 'ai', text: string}[]>([])
 const conversationEndRef = useRef<HTMLDivElement>(null);


 // 教材選択関連の状態
 const [allFolders, setAllFolders] = useState<MaterialFolder[]>([])
 const [currentFolder, setCurrentFolder] = useState<MaterialFolder | null>(null)
 const [files, setFiles] = useState<MaterialFile[]>([])
 const [selectedMaterial, setSelectedMaterial] = useState<MaterialFile | null>(null)
 const [breadcrumbs, setBreadcrumbs] = useState<MaterialFolder[]>([])
 const [_textContent, setTextContent] = useState<string | null>(null)
 const [_isContentLoading, setIsContentLoading] = useState(false)
  const [currentItemIndex, setCurrentItemIndex] = useState(0)
 const [currentItems, setCurrentItems] = useState<(MaterialFolder | MaterialFile)[]>([])
 const interactionPanelRef = useRef<HTMLDivElement>(null);
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const itemRefs = useRef<(HTMLDivElement | null)[]>([]);




 const handleAiMessage = useCallback((data: any) => {
   switch (data.type) {
     case 'connected': setIsAiConnected(true); setIsConnecting(false); break;
     case 'disconnected': setIsAiConnected(false); setIsConnecting(false); setIsAISpeaking(false); break;
     case 'response.created': setIsAISpeaking(true); setPartialText(''); break;
     case 'response.done': setIsAISpeaking(false); break;
     case "conversation.item.input_audio_transcription.completed":
       setConversationLog(prev => [...prev, { role: 'user', text: data.transcript }]);
       break;
     case "response.text.delta": setPartialText(prev => prev + data.delta); break;
     case "response.text.done":
       setConversationLog(prev => [...prev, { role: 'ai', text: data.text }]);
       setPartialText('');
       break;
     case "error":
       alert(`AIエラー: ${data.error?.message || '不明なエラー'}`);
       setIsConnecting(false);
       setIsAiConnected(false);
       break;
   }
 }, []);


 const fetchAllFolders = useCallback(async () => {
   try {
     const rootFolders = await firebaseMaterialsService.getFolders();
     let allFoldersData: MaterialFolder[] = [...rootFolders];
     for (const folder of rootFolders) {
       const childFolders = await loadChildFolders(folder.id, allFoldersData);
       allFoldersData.push(...childFolders);
     }
     setAllFolders(allFoldersData);
   } catch (error) { console.error('フォルダ取得エラー:', error); }
 }, []);


 const loadChildFolders = async (parentId: string, currentFolders: MaterialFolder[]): Promise<MaterialFolder[]> => {
   try {
     const childFolders = await firebaseMaterialsService.getChildFolders(parentId)
     let allChildren: MaterialFolder[] = [...childFolders]
     for (const child of childFolders) {
       const grandChildren = await loadChildFolders(child.id, [...currentFolders, ...allChildren])
       allChildren = [...allChildren, ...grandChildren]
     }
     return allChildren
   } catch (error) {
     console.error(`子フォルダ取得エラー (parentId: ${parentId}):`, error)
     return []
   }
 };


 const fetchFiles = useCallback(async (folderId: string | null) => {
   try {
     const filesData = folderId ? await firebaseMaterialsService.getFiles(folderId) : [];
     setFiles(filesData);
   } catch (error) { console.error('ファイル取得エラー:', error); setFiles([]); }
 }, []);
  const generateBreadcrumbs = useCallback((folder: MaterialFolder | null) => {
   if (!folder) { setBreadcrumbs([]); return; }
   const newBreadcrumbs: MaterialFolder[] = [];
   let currentItem: MaterialFolder | undefined = folder;
   while (currentItem) {
     newBreadcrumbs.unshift(currentItem);
     currentItem = allFolders.find(f => f.id === currentItem?.parentId);
   }
   setBreadcrumbs(newBreadcrumbs);
 }, [allFolders]);


 const handleFolderClick = useCallback((folder: MaterialFolder) => {
   setCurrentFolder(folder);
   fetchFiles(folder.id);
   generateBreadcrumbs(folder);
 }, [allFolders, fetchFiles, generateBreadcrumbs]);


 const handleNavigateToRoot = useCallback(() => {
   setCurrentFolder(null);
   fetchFiles(null);
   setBreadcrumbs([]);
 }, [fetchFiles]);


 useEffect(() => {
   fetchAllFolders();
   const autoConnect = localStorage.getItem('autoConnectWebRTC');
   if (autoConnect === 'true') {
     localStorage.removeItem('autoConnectWebRTC');
     setTimeout(() => startConnection(), 1000);
   }
 }, [fetchAllFolders]);


 useEffect(() => {
   if (allFolders.length > 0 && !currentFolder) {
     fetchFiles(null)
   }
 }, [allFolders, currentFolder, fetchFiles]);


 const startConnection = useCallback(async () => {
   if (isConnecting || isAiConnected) return;
   setIsConnecting(true);
   const client = new WebRTCRealtimeClient('break_session', handleAiMessage, () => {});
   setAiClient(client);
   try {
     await client.connect();
   } catch (error) {
     console.error('Connection failed:', error);
     setIsConnecting(false);
   }
 }, [isConnecting, isAiConnected, handleAiMessage]);


 const sendMaterialToAI = useCallback(async () => {
   if (!selectedMaterial || !aiClient || !isAiConnected) return;
  
   let materialContent = ''
   if (selectedMaterial.type === 'text') {
       try {
           const content = await firebaseMaterialsService.getTextContent(selectedMaterial.id);
           materialContent = content;
       } catch (e) {
           console.error("Failed to fetch text content for AI");
       }
   }


   await aiClient.sendMaterial(selectedMaterial, materialContent);
 }, [selectedMaterial, aiClient, isAiConnected]);


 const handleKeyDown = useCallback((e: KeyboardEvent) => {
   if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
   switch (e.key) {
     case 'ArrowRight': e.preventDefault(); if (currentItems.length > 0) setCurrentItemIndex(i => (i + 1) % currentItems.length); break;
     case 'ArrowLeft': e.preventDefault(); if (currentItems.length > 0) setCurrentItemIndex(i => (i - 1 + currentItems.length) % currentItems.length); break;
     case 'ArrowUp': {
       e.preventDefault();
       const parent = currentFolder ? allFolders.find(f => f.id === currentFolder.parentId) : null;
       if (parent) handleFolderClick(parent);
       else if (currentFolder) handleNavigateToRoot();
       break;
     }
     case 'ArrowDown': {
       e.preventDefault();
       const item = currentItems[currentItemIndex];
       if (item && 'parentId' in item) handleFolderClick(item as MaterialFolder);
       break;
     }
   }
 }, [currentItemIndex, currentItems, currentFolder, allFolders, handleFolderClick, handleNavigateToRoot]);


 useEffect(() => {
   const newChildFolders = allFolders.filter(folder => folder.parentId === (currentFolder?.id || null));
   const items = [...newChildFolders, ...files];
   setCurrentItems(items);
   setCurrentItemIndex(0);
   itemRefs.current = itemRefs.current.slice(0, items.length);
 }, [currentFolder, files, allFolders]);
  useEffect(() => {
   const item = currentItems[currentItemIndex];
   if (item && 'type' in item) {
       setSelectedMaterial(item as MaterialFile);
       // テキストファイルの場合は内容を取得
       if ((item as MaterialFile).type === 'text') {
         setIsContentLoading(true);
         firebaseMaterialsService.getTextContent((item as MaterialFile).id)
           .then(content => {
             setTextContent(content);
             setIsContentLoading(false);
           })
           .catch(error => {
             console.error('テキスト内容取得エラー:', error);
             setTextContent(null);
             setIsContentLoading(false);
           });
       } else {
         setTextContent(null);
       }
       } else {
       setSelectedMaterial(null);
       setTextContent(null);
   }
 }, [currentItemIndex, currentItems]);
  useEffect(() => {
   const container = scrollContainerRef.current;
   const item = itemRefs.current[currentItemIndex];
   if (container && item) {
       const scrollLeft = item.offsetLeft - (container.offsetWidth / 2) + (item.offsetWidth / 2);
       container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
   }
 }, [currentItemIndex]);


 useEffect(() => {
   conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [conversationLog, partialText]);
  useEffect(() => {
   window.addEventListener('keydown', handleKeyDown);
   return () => window.removeEventListener('keydown', handleKeyDown);
 }, [handleKeyDown]);


 useEffect(() => {
   const startCamera = async () => {
     try {
       const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
       setStream(mediaStream)
       if (videoRef.current) videoRef.current.srcObject = mediaStream
     } catch (error) { console.error('カメラアクセスエラー:', error) }
   }
   startCamera();
   return () => stream?.getTracks().forEach(track => track.stop());
 }, []);


 useEffect(() => {
   const timer = setInterval(() => setBreakElapsedTime(prev => prev + 1), 1000);
   return () => clearInterval(timer);
 }, []);


 const formatTime = (seconds: number) => {
   const mins = Math.floor(seconds / 60);
   const secs = seconds % 60;
   return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 };


 const parentFolder = currentFolder ? allFolders.find(f => f.id === currentFolder.parentId) : null;
 const selectedItem = currentItems.length > 0 ? currentItems[currentItemIndex] : null;
 const isSelectedItemFolder = selectedItem && 'parentId' in selectedItem;


 return (
   <div style={{ width: '100vw', height: '100vh', display: 'flex', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
     {/* Left Panel */}
     <div style={{ width: '300px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
       <div style={{ background: 'rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '16px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
         <h3 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '16px', textAlign: 'center' }}>Webカメラ</h3>
         <div style={{ width: '100%', height: '150px', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
           <video ref={videoRef} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
             </div>
             </div>
       <div style={{ background: 'rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '20px', border: '1px solid rgba(255, 255, 255, 0.2)', textAlign: 'center' }}>
         <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px' }}>休憩時間</h3>
         <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', fontFamily: 'monospace' }}>{formatTime(breakElapsedTime)}</div>
           </div>
       <div ref={interactionPanelRef} style={{ flex: 1, background: 'rgba(255, 255, 255, 0.15)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
         <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px', flexShrink: 0 }}>教材で話す</h3>
         <div style={{ marginBottom: '8px', fontSize: '12px', color: 'white', wordBreak: 'break-all', flexShrink: 0 }}>📍 {breadcrumbs.map(f => f.name).join(' / ') || 'ルート'}</div>
         <div onClick={() => parentFolder ? handleFolderClick(parentFolder) : (currentFolder && handleNavigateToRoot())} style={{ textAlign: 'center', padding: '4px 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', opacity: currentFolder ? 1 : 0.4, cursor: currentFolder ? 'pointer' : 'default', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '5px' }}>
           <span>↑ {parentFolder ? parentFolder.name : (currentFolder ? 'ルートに戻る' : '')}</span>
         </div>
         <div ref={scrollContainerRef} className="no-scrollbar" style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', padding: '10px 0' }}>
           {currentItems.length > 0 ? (
             <div style={{ display: 'flex', padding: `0 calc(50% - 50px)` }}>
               {currentItems.map((item, index) => (
                 <div ref={(el) => { itemRefs.current[index] = el; }} key={item.id} onClick={() => setCurrentItemIndex(index)} style={{ padding: '10px', background: index === currentItemIndex ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.05)', border: `2px solid ${index === currentItemIndex ? 'rgba(59, 130, 246, 0.7)' : 'transparent'}`, borderRadius: '12px', margin: '0 5px', transition: 'all 0.3s ease', transform: index === currentItemIndex ? 'scale(1.08)' : 'scale(0.95)', opacity: index === currentItemIndex ? 1 : 0.7, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', flexShrink: 0, width: '90px', height: '90px', cursor: 'pointer' }}>
                   <span style={{ fontSize: '32px' }}>{'parentId' in item ? '📁' : (item.type === 'text' ? '📄' : '🖼️')}</span>
                   <span style={{ color: 'white', fontWeight: '500', fontSize: '12px', textAlign: 'center', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
         </div>
               ))}
       </div>
           ) : <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', width: '100%' }}><p>空のフォルダ</p></div>}
         </div>
         <div onClick={() => isSelectedItemFolder && handleFolderClick(selectedItem as MaterialFolder)} style={{ textAlign: 'center', padding: '4px 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', height: '20px', opacity: isSelectedItemFolder ? 1 : 0.4, cursor: isSelectedItemFolder ? 'pointer' : 'default', borderTop: '1px solid rgba(255, 255, 255, 0.1)', marginTop: '5px' }}>
           {isSelectedItemFolder && selectedItem ? <span>↓ {selectedItem.name} を開く</span> : <span></span>}
         </div>
         <button onClick={sendMaterialToAI} disabled={!isAiConnected || !selectedMaterial} style={{ width: '100%', padding: '10px', background: isAiConnected && selectedMaterial ? 'rgba(16, 185, 129, 0.8)' : 'rgba(107, 114, 128, 0.5)', color: 'white', border: 'none', borderRadius: '12px', cursor: isAiConnected && selectedMaterial ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600', marginTop: '10px' }}>AIに送信</button>
           </div>
       </div>


     {/* Right Panel */}
     <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
       <div style={{ flex: 1, position: 'relative' }}>
         <TalkAnimation selectedMaterial={null} />
       </div>
       <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
         <div style={{ width: '90%', height: '90%', background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(5px)', borderRadius: '16px', padding: '20px', overflow: 'auto', color: 'white', display: 'flex', flexDirection: 'column', gap: '15px' }}>
           {conversationLog.map((entry, index) => (
             <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: entry.role === 'user' ? 'flex-end' : 'flex-start' }}>
               <div style={{ order: entry.role === 'user' ? 2 : 1, fontSize: '24px' }}>{entry.role === 'user' ? '👤' : '🤖'}</div>
               <p style={{ order: entry.role === 'user' ? 1 : 2, background: entry.role === 'user' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.2)', padding: '10px 15px', borderRadius: '12px', margin: 0, maxWidth: '80%' }}>{entry.text}</p>
             </div>
           ))}
       {isAISpeaking && (
             <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
               <div style={{ fontSize: '24px' }}>🤖</div>
               <p style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '10px 15px', borderRadius: '12px', margin: 0, maxWidth: '80%', opacity: 0.8 }}>
                 {partialText || <span style={{animation: 'pulse 1.5s infinite'}}>...</span>}
               </p>
         </div>
       )}
           <div ref={conversationEndRef} />
         </div>
         </div>
       <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
         <button onClick={() => navigate('/study')} style={{ padding: '12px 24px', background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>勉強に戻る</button>
         </div>
       <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10, background: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)' }}>
         <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isAiConnected ? '#10b981' : isConnecting ? '#f59e0b' : '#ef4444', animation: isConnecting ? 'pulse 1.5s infinite' : 'none' }} />
         <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{isAiConnected ? 'AI接続中' : isConnecting ? '接続中...' : 'AI未接続'}</span>
       </div>
       {!isAiConnected && !isConnecting && (
         <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
           <button onClick={startConnection} style={{ padding: '12px 24px', background: 'rgba(16, 185, 129, 0.8)', color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>AIと話す</button>
         </div>
       )}
     </div>
   </div>
 )
}

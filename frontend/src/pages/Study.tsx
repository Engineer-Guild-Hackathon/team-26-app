import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StudyAnimation from 'src/components/StudyAnimation'
import { type MaterialFolder, type MaterialFile, firebaseMaterialsService } from 'src/services/firebaseMaterials'


export default function Study() {
 const navigate = useNavigate()
 const [settings, setSettings] = useState<any>(null)
 const [elapsedTime, setElapsedTime] = useState(0) // 経過時間（秒）
 const [nextBreakTime, setNextBreakTime] = useState(0) // 次の休憩までの時間


 // Webカメラ
 const videoRef = useRef<HTMLVideoElement>(null)
 const [stream, setStream] = useState<MediaStream | null>(null)


 // スコア（3秒ごとに更新）
 const [faceScore, setFaceScore] = useState(0)
 const [orientationScore, setOrientationScore] = useState(0)
 const [statusMessage, setStatusMessage] = useState('') // 中央下のメッセージ


 // 教材選択関連の状態
 const [allFolders, setAllFolders] = useState<MaterialFolder[]>([])
 const [currentFolder, setCurrentFolder] = useState<MaterialFolder | null>(null)
 const [files, setFiles] = useState<MaterialFile[]>([])
 const [selectedMaterial, setSelectedMaterial] = useState<MaterialFile | null>(null)
 const [breadcrumbs, setBreadcrumbs] = useState<MaterialFolder[]>([])
 const [_loading, setLoading] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null);
 const [isContentLoading, setIsContentLoading] = useState(false);
 const [preloadedImages, setPreloadedImages] = useState<Record<string, string>>({});


 const [currentItemIndex, setCurrentItemIndex] = useState(0)
 const [currentItems, setCurrentItems] = useState<(MaterialFolder | MaterialFile)[]>([])
 const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null)
 const [touchEnd, setTouchEnd] = useState<{ x: number, y: number } | null>(null)
 const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
 const interactionPanelRef = useRef<HTMLDivElement>(null);
 const isFlickTransitioning = useRef(false);
  // カルーセルUI用のRef
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const itemRefs = useRef<(HTMLDivElement | null)[]>([]);


 // アイコンコンポーネント
 const BackIcon = () => (
   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5">
     <path d="m9 19-7-7 7-7"/>
     <path d="M28 12H5"/>
   </svg>
 )


 // ----------------------------
 // 初期データ取得
 // ----------------------------
 useEffect(() => {
   const initializeData = async () => {
     await fetchAllFolders()
   }
   initializeData()
 }, [])


 useEffect(() => {
   if (allFolders.length > 0 && !currentFolder) {
     fetchFiles(null)
   }
 }, [allFolders, currentFolder])


 const fetchAllFolders = async () => {
   try {
     setLoading(true)
     const rootFolders = await firebaseMaterialsService.getFolders()
     let allFoldersData: MaterialFolder[] = [...rootFolders]
    
     for (const folder of rootFolders) {
       const childFolders = await loadChildFolders(folder.id, allFoldersData)
       allFoldersData = [...allFoldersData, ...childFolders]
     }
    
     setAllFolders(allFoldersData)
   } catch (error) {
     console.error('フォルダ取得エラー:', error)
   } finally {
     setLoading(false)
   }
 }


 const loadChildFolders = async (parentId: string, currentFolders: MaterialFolder[]): Promise<MaterialFolder[]> => {
   try {
     const childFolders = await firebaseMaterialsService.getChildFolders(parentId)
     let allChildren: MaterialFolder[] = [...childFolders]
    
     for (const child of childFolders) {
       const grandChildren = await loadChildFolders(child.id, [...currentFolders, ...allChildren])
       allChildren = [...allChildren, ...grandChildren]
     }
    
     return allChildren
   } catch (error)
   {
     console.error(`子フォルダ取得エラー (parentId: ${parentId}):`, error)
     return []
   }
 }


 const fetchFiles = async (folderId: string | null) => {
   try {
     const filesData = folderId ? await firebaseMaterialsService.getFiles(folderId) : [];
     setFiles(filesData);
    
     const imageUrls: Record<string, string> = {};
     filesData.forEach(file => {
       if (file.type === 'image' && file.downloadURL) {
         const img = new Image();
         img.src = file.downloadURL;
         imageUrls[file.id] = file.downloadURL;
       }
     });
     setPreloadedImages(imageUrls);


   } catch (error) {
     console.error('ファイル取得エラー:', error);
     setFiles([]);
   }
 }


 const generateBreadcrumbs = (folder: MaterialFolder | null) => {
   if (!folder) {
       setBreadcrumbs([])
       return
   }
  
   const newBreadcrumbs: MaterialFolder[] = []
   let currentItem: MaterialFolder | undefined = folder
  
   while (currentItem) {
     newBreadcrumbs.unshift(currentItem)
     currentItem = allFolders.find(f => f.id === currentItem?.parentId)
   }
  
   setBreadcrumbs(newBreadcrumbs)
 }


 const handleFolderClick = useCallback((folder: MaterialFolder) => {
   setCurrentFolder(folder)
   fetchFiles(folder.id)
   generateBreadcrumbs(folder)
 }, [allFolders]);


 const handleNavigateToRoot = useCallback(() => {
   setCurrentFolder(null)
   fetchFiles(null)
   setBreadcrumbs([])
 }, []);


 // ----------------------------
 // フリック/スクロール/キー操作
 // ----------------------------
 const handleTouchStart = useCallback((e: TouchEvent) => {
   e.preventDefault();
   const touch = e.targetTouches[0];
   setTouchEnd(null);
   setTouchStart({ x: touch.clientX, y: touch.clientY });
 }, []);


 const handleTouchMove = useCallback((e: TouchEvent) => {
   e.preventDefault();
   const touch = e.targetTouches[0];
   setTouchEnd({ x: touch.clientX, y: touch.clientY });
 }, []);


 const handleTouchEnd = useCallback(() => {
   if (isFlickTransitioning.current) return;
   if (!touchStart || !touchEnd) return;


   const distanceX = touchStart.x - touchEnd.x;
   const distanceY = touchStart.y - touchEnd.y;
   const minFlickDistance = 50;


   if (Math.abs(distanceY) > Math.abs(distanceX) && Math.abs(distanceY) > minFlickDistance) {
       let stateChanged = false;
       const isUpSwipe = distanceY > minFlickDistance;
       const isDownSwipe = distanceY < -minFlickDistance;


       if (isUpSwipe) {
           const parentFolder = currentFolder ? allFolders.find(f => f.id === currentFolder.parentId) : null;
           if (parentFolder) handleFolderClick(parentFolder);
           else if (currentFolder) handleNavigateToRoot();
           stateChanged = true;
       } else if (isDownSwipe) {
           const selectedItem = currentItems[currentItemIndex];
           if (selectedItem && 'parentId' in selectedItem) {
               handleFolderClick(selectedItem as MaterialFolder);
               stateChanged = true;
           }
       }
       if (stateChanged) {
         isFlickTransitioning.current = true;
         setTimeout(() => { isFlickTransitioning.current = false; }, 250);
       }
   } else if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minFlickDistance) {
       const isLeftSwipe = distanceX > minFlickDistance;
       const isRightSwipe = distanceX < -minFlickDistance;
       if (currentItems.length > 0) {
           if (isLeftSwipe) {
             setCurrentItemIndex(i => (i + 1) % currentItems.length);
           } else if (isRightSwipe) {
             setCurrentItemIndex(i => (i - 1 + currentItems.length) % currentItems.length);
           }
           isFlickTransitioning.current = true;
           setTimeout(() => { isFlickTransitioning.current = false; }, 250);
       }
   }
  
   setTouchStart(null);
   setTouchEnd(null);
 }, [touchStart, touchEnd, currentItems, currentItemIndex, currentFolder, allFolders, handleFolderClick, handleNavigateToRoot]);


 const handleWheel = useCallback((e: WheelEvent) => {
   e.preventDefault();
   if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);


   wheelTimeoutRef.current = setTimeout(() => {
       const { deltaX, deltaY } = e;
       const minDelta = 10;


       if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minDelta) {
           if (deltaY > 0) { // Down
               const selectedItem = currentItems[currentItemIndex];
               if (selectedItem && 'parentId' in selectedItem) {
                   handleFolderClick(selectedItem as MaterialFolder);
               }
           } else { // Up
               const parentFolder = currentFolder ? allFolders.find(f => f.id === currentFolder.parentId) : null;
               if (parentFolder) handleFolderClick(parentFolder);
               else if (currentFolder) handleNavigateToRoot();
           }
       } else if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minDelta) {
           if (currentItems.length > 0) {
               if (deltaX > 0) setCurrentItemIndex(i => (i + 1) % currentItems.length);
               else setCurrentItemIndex(i => (i - 1 + currentItems.length) % currentItems.length);
           }
       }
   }, 50);
 }, [currentItems, currentItemIndex, currentFolder, allFolders, handleFolderClick, handleNavigateToRoot]);


 useEffect(() => {
   const panel = interactionPanelRef.current;
   if (!panel) return;


   panel.addEventListener('touchstart', handleTouchStart, { passive: false });
   panel.addEventListener('touchmove', handleTouchMove, { passive: false });
   panel.addEventListener('touchend', handleTouchEnd, { passive: false });
   panel.addEventListener('wheel', handleWheel, { passive: false });


   return () => {
     panel.removeEventListener('touchstart', handleTouchStart);
     panel.removeEventListener('touchmove', handleTouchMove);
     panel.removeEventListener('touchend', handleTouchEnd);
     panel.removeEventListener('wheel', handleWheel);
   };
 }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);


 const handleKeyDown = useCallback((e: KeyboardEvent) => {
   if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
     return;
   }
  
   switch (e.key) {
     case 'ArrowRight':
       e.preventDefault();
       if (currentItems.length > 0) {
         setCurrentItemIndex(i => (i + 1) % currentItems.length);
       }
       break;
     case 'ArrowLeft':
       e.preventDefault();
       if (currentItems.length > 0) {
         setCurrentItemIndex(i => (i - 1 + currentItems.length) % currentItems.length);
       }
       break;
     case 'ArrowUp':
       e.preventDefault();
       {
         const parentFolder = currentFolder ? allFolders.find(f => f.id === currentFolder.parentId) : null;
         if (parentFolder) {
           handleFolderClick(parentFolder);
         } else if (currentFolder) {
           handleNavigateToRoot();
         }
       }
       break;
     case 'ArrowDown':
       e.preventDefault();
       {
         const selectedItem = currentItems[currentItemIndex];
         if (selectedItem && 'parentId' in selectedItem) { // is folder
           handleFolderClick(selectedItem as MaterialFolder);
         }
       }
       break;
     default:
       break;
   }
 }, [currentItemIndex, currentItems, currentFolder, allFolders, handleFolderClick, handleNavigateToRoot]);


 useEffect(() => {
   window.addEventListener('keydown', handleKeyDown);
   return () => {
     window.removeEventListener('keydown', handleKeyDown);
   };
 }, [handleKeyDown]);




 useEffect(() => {
   const newChildFolders = allFolders.filter(folder => folder.parentId === (currentFolder?.id || null));
   const items: (MaterialFolder | MaterialFile)[] = [...newChildFolders, ...files];
   setCurrentItems(items);
   setCurrentItemIndex(0);
   itemRefs.current = itemRefs.current.slice(0, items.length);
 }, [currentFolder, files, allFolders]);


 useEffect(() => {
   if (currentItems.length > 0 && currentItemIndex < currentItems.length) {
       const item = currentItems[currentItemIndex];
       if (item && 'type' in item) {
           setSelectedMaterial(item as MaterialFile);
       } else {
           setSelectedMaterial(null);
       }
   } else {
       setSelectedMaterial(null);
   }
 }, [currentItemIndex, currentItems]);


 useEffect(() => {
   if (currentItems.length > 0 && itemRefs.current[currentItemIndex] && scrollContainerRef.current) {
       const container = scrollContainerRef.current;
       const item = itemRefs.current[currentItemIndex];
       if (item) {
           const scrollLeft = item.offsetLeft - (container.offsetWidth / 2) + (item.offsetWidth / 2);
           container.scrollTo({
               left: scrollLeft,
               behavior: 'smooth'
           });
       }
   }
 }, [currentItemIndex, currentItems]);


 useEffect(() => {
   const fetchContent = async () => {
       if (selectedMaterial && selectedMaterial.type === 'text') {
           setIsContentLoading(true);
           setTextContent(null);
           try {
               const content = await firebaseMaterialsService.getTextContent(selectedMaterial.id);
               setTextContent(content);
           } catch (error) {
               console.error("テキスト内容の取得に失敗:", error);
               setTextContent("エラー: 内容を読み込めませんでした。");
           } finally {
               setIsContentLoading(false);
           }
       } else {
           setTextContent(null);
       }
   };
   fetchContent();
 }, [selectedMaterial]);


 const handleBreak = useCallback(() => {
   localStorage.setItem('autoConnectWebRTC', 'true')
   if (selectedMaterial) {
     localStorage.setItem('selectedMaterial', JSON.stringify(selectedMaterial))
   }
   navigate('/break')
 }, [navigate, selectedMaterial]);


 // ----------------------------
 // 設定ロード
 // ----------------------------
 useEffect(() => {
   const savedSettings = localStorage.getItem('studySettings')
   if (savedSettings) {
     const parsedSettings = JSON.parse(savedSettings)
     setSettings(parsedSettings)
     const pomodoroSeconds = parsedSettings.pomodoroTime * 60
     setNextBreakTime(pomodoroSeconds)
   } else {
     navigate('/study-settings')
   }
 }, [navigate])


 // ----------------------------
 // カメラ起動 + video 再生（readyState 確保）
 // ----------------------------
 useEffect(() => {
   const startCamera = async () => {
     try {
       console.log('[Concentration] startCamera: requesting user media...')
       const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
       setStream(mediaStream)
       if (videoRef.current) {
         videoRef.current.srcObject = mediaStream
         videoRef.current.onloadedmetadata = () => {
           console.log('[Concentration] video onloadedmetadata: readyState=', videoRef.current?.readyState,
             'size=', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight)
           videoRef.current?.play().then(() => {
             console.log('[Concentration] video play() resolved')
           }).catch(err => {
             console.error('[Concentration] video play() error:', err)
           })
         }
       }
       console.log('[Concentration] startCamera: got stream:', mediaStream)
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
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])


 // ----------------------------
 // 顔の有無＆向きの軽量推論（streamが来てからセットアップ）／3秒ごとに1フレームだけ
 // ----------------------------
 useEffect(() => {
   if (!stream || !videoRef.current) return


   let detector: any = null
   let timer: NodeJS.Timeout | null = null
   let cancelled = false


   // ✅ JS版 MediaPipe FaceDetection の detection 形に対応
   // detection = { boundingBox: {xCenter, yCenter, width, height, ...}, landmarks: [{x,y}, ...] }
   // ざっくり：鼻の x と枠中心のズレが少ないほど高得点（0〜100）
   const calcOrientationScore = (detection: any) => {
     try {
       const box = detection?.boundingBox
       const lm = detection?.landmarks
       if (!box || !lm || lm.length < 3) return 0


       const nose = lm[2] // noseTip
       const centerX = box.xCenter
       const halfW = (box.width ?? 0) / 2


       if (nose?.x == null || centerX == null || halfW <= 0) return 0


       const dev = Math.abs(nose.x - centerX)
       const norm = Math.min(dev / halfW, 1)   // 0(正面)〜1(大幅ズレ)
       const score = Math.max(0, Math.round(100 * (1 - norm)))
       return score
     } catch (e) {
       console.error('[Concentration] calcOrientationScore error:', e)
       return 0
     }
   }


   const videoReady = () => {
     const v = videoRef.current!
     return v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0
   }


   const updateMessage = (face: number, ori: number) => {
     if (face === 0) {
       setStatusMessage('あれ、どっかいっちゃった？')
     } else if (ori >= 80) {
       setStatusMessage('しっかり集中してるね')
     } else if (ori >= 30) {
       setStatusMessage('ちょっと気が逸れちゃってる？')
     } else {
       setStatusMessage('集中切れちゃった？')
     }
   }


   const runOnce = async () => {
     console.log('[Concentration] runOnce tick')
     if (cancelled || !videoRef.current || !detector) return
     if (!videoReady()) {
       console.log('[Concentration] runOnce: video not ready, skip')
       return
     }
     try {
       console.log('[Concentration] detector.send start')
       await detector.send({ image: videoRef.current })
       console.log('[Concentration] detector.send done')
     } catch (e) {
       console.error('[Concentration] FaceDetection error in runOnce:', e)
     }
   }


   ;(async () => {
     console.log('[Concentration] detector setup start')
     if (!stream) {
       console.log('[Concentration] detector setup skipped: stream is null')
       return
     }


     const faceDetection = await import('@mediapipe/face_detection')
     console.log('[Concentration] importing @mediapipe/face_detection...')
     detector = new faceDetection.FaceDetection({
       locateFile: (file: string) =>
         `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
     })
     detector.setOptions({
       model: 'short',
       minDetectionConfidence: 0.6,
     })


     detector.onResults((results: any) => {
       const det = results?.detections?.[0]
       const detCount = results?.detections?.length ?? 0
       console.log('[Concentration] onResults: detections=', detCount, det)


       const hasFace = !!det
       const faceVal = hasFace ? 100 : 0
       setFaceScore(faceVal)


       if (hasFace) {
         const ori = calcOrientationScore(det)
         console.log('[Concentration] orientationScore=', ori)
         setOrientationScore(ori)
         updateMessage(faceVal, ori)
       } else {
         setOrientationScore(0)
         updateMessage(0, 0)
       }
     })


     // ★ 3秒おきに1フレームだけ推論
     timer = setInterval(runOnce, 3000)
     console.log('[Concentration] interval started (3s)')
     runOnce() // 初回即時
   })()


   return () => {
     cancelled = true
     if (timer) {
       clearInterval(timer)
       console.log('[Concentration] interval cleared')
     }
     detector = null
     console.log('[Concentration] detector cleanup done')
   }
 }, [stream])


 // ----------------------------
 // ポモドーロ計時（元コードのまま／明示掲載）
 // ----------------------------
 useEffect(() => {
   if (!nextBreakTime) return
   const timer = setInterval(() => {
     setElapsedTime(prev => {
       const newElapsed = prev + 1
       if (newElapsed >= nextBreakTime) {
         clearInterval(timer)
         handleBreak()
         return newElapsed
       }
       return newElapsed
     })
   }, 1000)
   return () => clearInterval(timer)
 }, [nextBreakTime, handleBreak])


 const formatTime = (seconds: number) => {
   const hrs = Math.floor(seconds / 3600)
   const mins = Math.floor((seconds % 3600) / 60)
   const secs = seconds % 60
   return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
 }


 const parentFolder = currentFolder ? allFolders.find(f => f.id === currentFolder.parentId) : null;
 const selectedItem = currentItems.length > 0 ? currentItems[currentItemIndex] : null;
 const isSelectedItemFolder = selectedItem && 'parentId' in selectedItem;


 if (!settings) {
   return <div>設定を読み込み中...</div>
 }


 return (
   <div style={{
     width: '100vw',
     height: '100vh',
     display: 'flex',
     background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
   }}>
                 <button
             onClick={() => navigate('/')}
             style={{
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               background: 'rgba(255, 255, 255, 0.2)',
               border: '1px solid rgba(255, 255, 255, 0.3)',
               borderRadius: '16px',
               width: '48px',
               height: '48px',
               cursor: 'pointer',
               marginRight: '20px',
               color: 'white',
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
             <BackIcon />
           </button>
     {/* Left Panel */}
     <div
       style={{
         width: '300px',
         padding: '20px',
         display: 'flex',
         flexDirection: 'column',
         gap: '20px',
       }}
     >
       {/* Web Camera */}
       <div style={{
         background: 'rgba(255, 255, 255, 0.15)',
         borderRadius: '16px',
         padding: '16px',
         border: '1px solid rgba(255, 255, 255, 0.2)'
       }}>
         <h3 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '16px', textAlign: 'center' }}>
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
             playsInline
             style={{
               width: '100%',
               height: '100%',
               objectFit: 'cover'
             }}
           />
         </div>
       </div>
      
       {/* Timer */}
       <div style={{
         background: 'rgba(255, 255, 255, 0.15)',
         borderRadius: '16px',
         padding: '20px',
         border: '1px solid rgba(255, 255, 255, 0.2)',
         textAlign: 'center'
       }}>
         <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px' }}>
           経過時間
         </h3>
         <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', fontFamily: 'monospace' }}>
           {formatTime(elapsedTime)}
         </div>
         <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '8px' }}>
           次の休憩まで: {formatTime(Math.max(0, nextBreakTime - elapsedTime))}
         </div>
       </div>


       {/* Material Selection */}
       <div
         ref={interactionPanelRef}
         style={{
           flex: 1,
           background: 'rgba(255, 255, 255, 0.15)',
           borderRadius: '16px',
           padding: '16px',
           border: '1px solid rgba(255, 255, 255, 0.2)',
           display: 'flex',
           flexDirection: 'column',
           touchAction: 'none',
           userSelect: 'none',
           overflow: 'hidden'
         }}
       >
         <h3 style={{ margin: '0 0 8px 0', color: 'white', fontSize: '16px', flexShrink: 0 }}>
           教材選択
         </h3>
        
         <div style={{ marginBottom: '8px', fontSize: '12px', color: 'white', wordBreak: 'break-all', flexShrink: 0 }}>
           📍 {breadcrumbs.length > 0 ? breadcrumbs.map(folder => folder.name).join(' / ') : 'ルート'}
         </div>


         <div
           onClick={() => {
             if (parentFolder) handleFolderClick(parentFolder);
             else if (currentFolder) handleNavigateToRoot();
           }}
           style={{
             textAlign: 'center',
             padding: '4px 0',
             fontSize: '12px',
             color: 'rgba(255, 255, 255, 0.8)',
             opacity: currentFolder ? 1 : 0.4,
             cursor: currentFolder ? 'pointer' : 'default',
             transition: 'all 0.2s ease',
             borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
             marginBottom: '5px',
           }}>
           <span>↑ {parentFolder ? parentFolder.name : (currentFolder ? 'ルートに戻る' : '')}</span>
         </div>


         <div
           ref={scrollContainerRef}
           className="no-scrollbar"
           style={{
             display: 'flex',
             alignItems: 'center',
             overflowX: 'auto',
             padding: '10px 0',
             scrollbarWidth: 'none',
             msOverflowStyle: 'none',
           }}
         >
           <style>{`
             .no-scrollbar::-webkit-scrollbar {
               display: none;
             }
           `}</style>
           {currentItems.length > 0 ? (
             <div style={{display: 'flex', paddingLeft: `calc(50% - 45px - 5px)`, paddingRight: `calc(50% - 45px - 5px)`}}>
               {currentItems.map((item, index) => (
                 <div
                   ref={el => itemRefs.current[index] = el}
                   key={item.id}
                   style={{
                     padding: '10px',
                     background: index === currentItemIndex ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.05)',
                     border: `2px solid ${index === currentItemIndex ? 'rgba(59, 130, 246, 0.7)' : 'transparent'}`,
                     borderRadius: '12px',
                     margin: '0 5px',
                     transition: 'all 0.3s ease',
                     transform: index === currentItemIndex ? 'scale(1.08)' : 'scale(0.95)',
                     opacity: index === currentItemIndex ? 1 : 0.7,
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     justifyContent: 'center',
                     gap: '8px',
                     flexShrink: 0,
                     width: '90px',
                     height: '90px',
                     cursor: 'pointer',
                   }}
                   onClick={() => setCurrentItemIndex(index)}
                 >
                   <span style={{ fontSize: '32px' }}>{'parentId' in item ? '📁' : (item.type === 'text' ? '📄' : '🖼️')}</span>
                   <span style={{
                       color: 'white',
                       fontWeight: '500',
                       fontSize: '12px',
                       textAlign: 'center',
                       width: '100%',
                       overflow: 'hidden',
                       textOverflow: 'ellipsis',
                       whiteSpace: 'nowrap'
                   }}>{item.name}</span>
                 </div>
               ))}
             </div>
           ) : (
             <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', width: '100%' }}>
               <div style={{ fontSize: '32px', opacity: 0.5 }}>🗂️</div>
               <p>空のフォルダ</p>
             </div>
           )}
         </div>


         <div
           onClick={() => {
             if (isSelectedItemFolder && selectedItem) {
               handleFolderClick(selectedItem as MaterialFolder);
             }
           }}
           style={{
             textAlign: 'center',
             padding: '4px 0',
             fontSize: '12px',
             color: 'rgba(255, 255, 255, 0.8)',
             height: '20px',
             opacity: isSelectedItemFolder ? 1 : 0.4,
             cursor: isSelectedItemFolder ? 'pointer' : 'default',
             transition: 'all 0.2s ease',
             borderTop: '1px solid rgba(255, 255, 255, 0.1)',
             marginTop: '5px',
           }}>
           {isSelectedItemFolder && selectedItem ? <span>↓ {selectedItem.name} を開く</span> : <span></span>}
         </div>
       </div>
     </div>


     {/* Right Panel: Split View */}
     <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
       {/* Left side: Animation */}
       <div style={{flex: 1, position: 'relative'}}>
         <StudyAnimation selectedMaterial={null} textContent={null} />
       </div>


       {/* Right side: Material Display */}
       <div style={{
         flex: 1,
         display: 'flex',
         alignItems: 'center',
         justifyContent: 'center',
         padding: '20px',
       }}>
         <div style={{
           width: '90%',
           height: '80%',
           background: 'rgba(0, 0, 0, 0.3)',
           backdropFilter: 'blur(5px)',
           borderRadius: '16px',
           padding: '20px',
           overflow: 'auto',
           color: 'white'
         }}>
           {isContentLoading ? (
             <p>読み込み中...</p>
           ) : selectedMaterial?.type === 'image' && selectedMaterial.downloadURL ? (
             <img src={preloadedImages[selectedMaterial.id] || selectedMaterial.downloadURL} alt={selectedMaterial.name} style={{ width: '100%', height: '100%', borderRadius: '8px', margin: 'auto' }} />
           ) : selectedMaterial?.type === 'text' ? (
             <pre style={{ fontSize: '16px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
               {textContent}
             </pre>
           ) : (
             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.7)'}}>
               <p>教材を選択するとここに表示されます</p>
             </div>
           )}
         </div>
       </div>


       <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
         <button
           onClick={handleBreak}
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
           onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
           onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; e.currentTarget.style.transform = 'translateY(0)' }}
         >
           休憩に入る
         </button>
       </div>
     </div>


     {/* --- 中央下の小さいコンポーネント（メッセージ表示） --- */}
     <div
       style={{
         position: 'fixed',
         left: '50%',
         bottom: 20,
         transform: 'translateX(-50%)',
         background: 'rgba(0,0,0,0.6)',
         color: 'white',
         border: '1px solid rgba(255,255,255,0.25)',
         borderRadius: 12,
         padding: '8px 14px',
         fontSize: 14,
         backdropFilter: 'blur(6px)',
         zIndex: 9999,
         pointerEvents: 'none',
         minWidth: 220,
         textAlign: 'center',
       }}
     >
       {statusMessage}
     </div>
   </div>
 )
}

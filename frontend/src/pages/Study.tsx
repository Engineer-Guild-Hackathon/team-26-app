import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StudyAnimation from 'src/components/StudyAnimation'
import { type MaterialFolder, type MaterialFile, firebaseMaterialsService } from 'src/services/firebaseMaterials'


// --- Original Component Code ---

export default function Study() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0) // 経過時間（秒）
  const [nextBreakTime, setNextBreakTime] = useState(0) // 次の休憩までの時間

  // Homeに戻る処理
  const handleGoHome = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Webカメラ
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // スコア（3秒ごとに更新）
  const [_faceScore, setFaceScore] = useState(0)
  const [_orientationScore, setOrientationScore] = useState(0)
  const [statusMessage, setStatusMessage] = useState('') // 中央下のメッセージ
  const [statusHistory, setStatusHistory] = useState<string[]>([]); // 履歴グラフ用の状態

  // 教材選択関連の状態
  const [allFolders, setAllFolders] = useState<MaterialFolder[]>([])
  const [currentFolder, setCurrentFolder] = useState<MaterialFolder | null>(null)
  const [files, setFiles] = useState<MaterialFile[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialFile | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<MaterialFolder[]>([])
  const [_loading, setLoading] = useState(false)
  
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);
  
  // 確認ダイアログの状態
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
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
    localStorage.setItem('shouldAutoConnectWebRTC', 'true')
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
      const pomodoroSeconds = (parsedSettings.pomodoroTime || 25) * 60
      setNextBreakTime(pomodoroSeconds)
    } else {
      setSettings({ pomodoroTime: 25 });
      setNextBreakTime(25 * 60);
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
      let newStatusMessage = '';
      let messageCategory = '';
      if (face === 0) {
        newStatusMessage = 'あれ、どっかいっちゃった？';
        messageCategory = 'no-face';
      } else if (ori >= 80) {
        newStatusMessage = 'しっかり集中してるね';
        messageCategory = 'high-focus';
      } else if (ori >= 30) {
        newStatusMessage = 'ちょっと気が逸れちゃってる？';
        messageCategory = 'mid-focus';
      } else {
        newStatusMessage = '集中切れちゃった？';
        messageCategory = 'low-focus';
      }
      setStatusMessage(newStatusMessage);
      setStatusHistory(prevHistory => {
        const newHistory = [...prevHistory, messageCategory];
        if (newHistory.length > 20) {
          return newHistory.slice(newHistory.length - 20);
        }
        return newHistory;
      });
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
        console.log('[Concentration] detector setup skipped: stream is null');
        return;
      }
      
      const scriptId = 'mediapipe-face-detection-script';
      const initializeDetector = () => {
        if (!(window as any).FaceDetection) {
            console.error('FaceDetection not found on window object.');
            return;
        }
        detector = new (window as any).FaceDetection({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
        });
        detector.setOptions({
          model: 'short',
          minDetectionConfidence: 0.6,
        });
        detector.onResults((results: any) => {
          const det = results?.detections?.[0];
          const hasFace = !!det;
          const faceVal = hasFace ? 100 : 0;
          setFaceScore(faceVal);
          if (hasFace) {
            const ori = calcOrientationScore(det);
            setOrientationScore(ori);
            updateMessage(faceVal, ori);
          } else {
            setOrientationScore(0);
            updateMessage(0, 0);
          }
        });
        timer = setInterval(runOnce, 3000);
        runOnce();
      };
      
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js';
        script.crossOrigin = 'anonymous';
        document.body.appendChild(script);
        script.onload = initializeDetector;
      } else {
        initializeDetector();
      }
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
  
  // --- Chart Helper Functions ---
  const getStatusValue = (status: string) => {
    switch (status) {
      case 'high-focus': return 1;
      case 'mid-focus': return 0.6;
      case 'low-focus': return 0.3;
      case 'no-face':
      default:
        return 0;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'high-focus': return '#4ade80'; // Green
      case 'mid-focus': return '#facc15'; // Yellow
      case 'low-focus': return '#f87171'; // Red
      case 'no-face':
      default:
        return '#9ca3af'; // Gray
    }
  };

  const parentFolder = currentFolder ? allFolders.find(f => f.id === currentFolder.parentId) : null;
  const selectedItem = currentItems.length > 0 ? currentItems[currentItemIndex] : null;
  const isSelectedItemFolder = selectedItem && 'parentId' in selectedItem;

  if (!settings) {
    return <div>設定を読み込み中...</div>
  }
  
  // --- Chart Drawing Logic ---
  const chartWidth = 260;
  const chartHeight = 50;
  const chartPadding = 5;
  const points = statusHistory.length > 1 
    ? statusHistory.map((status, index) => {
        const x = chartPadding + (index / (statusHistory.length - 1)) * (chartWidth - 2 * chartPadding);
        const y = chartHeight - chartPadding - (getStatusValue(status) * (chartHeight - 2 * chartPadding));
        return `${x},${y}`;
      }).join(' ')
    : '';


  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>

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
          
          <div style={{ marginBottom: '8px', fontSize: '15px', color: 'white', wordBreak: 'break-all', flexShrink: 0 }}>
            📍 {breadcrumbs.length > 0 ? breadcrumbs.map(folder => folder.name).join(' / ') : 'ルート'}
          </div>

          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', marginBottom: '5px', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
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
                  flex: 1
                }}>
                <span>↑ {parentFolder ? parentFolder.name : (currentFolder ? 'ルートに戻る' : '')}</span>
              </div>
            </div>
            
            {/* 2分木のナビゲーション説明 */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '12px', 
              padding: '8px 12px', 
              background: 'rgba(255, 255, 255, 0.08)', 
              borderRadius: '8px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '2px', fontSize: '14px' }}>📁</div>
                <div>⬆ 親</div>
              </div>
              <div style={{ 
                borderLeft: '1px solid rgba(255, 255, 255, 0.3)', 
                height: '20px' 
              }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '2px', fontSize: '14px' }}>⬅ 📄 ➡</div>
                <div>隣接選択</div>
              </div>
              <div style={{ 
                borderLeft: '1px solid rgba(255, 255, 255, 0.3)', 
                height: '20px' 
              }}></div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: '2px', fontSize: '14px' }}>📁</div>
                <div>⬇ 子</div>
              </div>
            </div>
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
                    ref={el => { itemRefs.current[index] = el }}
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
                    <span style={{ fontSize: '32px' }}>{'type' in item ? (item.type === 'text' ? '📄' : '🖼️') : '📁'}</span>
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
          <StudyAnimation selectedMaterial={selectedMaterial} textContent={textContent} />
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
              <img src={preloadedImages[selectedMaterial.id] || selectedMaterial.downloadURL} alt={selectedMaterial.name} style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'contain' }} />
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

      </div>

      {/* --- 中央下の小さいコンポーネント（メッセージ表示） --- */}
      <div
        style={{
          position: 'fixed',
          left: '38%',
          bottom: 830,
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

      {/* --- 履歴グラフ --- */}
      <div style={{
        position: 'fixed',
        left: '38%',
        bottom: '20px',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 9998,
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease',
        opacity: statusHistory.length > 0 ? 1 : 0,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.3))',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '16px',
        backdropFilter: 'blur(8px)',
        padding: '10px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          color: '#FFFFFF',
          fontSize: '14px',
          fontWeight: '600',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)'
        }}>
          📈 集中度
        </div>
        <div style={{
          color: '#FFFFFF',
          fontSize: '10px', 
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          letterSpacing: '1px',
          borderLeft: '1px solid rgba(255,255,255,0.3)',
          paddingLeft: '8px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          opacity: 0.7
        }}>
          低
        </div>
        <svg width={chartWidth} height={chartHeight + 30} style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor: '#60a5fa', stopOpacity: 0.8}} />
              <stop offset="50%" style={{stopColor: '#34d399', stopOpacity: 1}} />
              <stop offset="100%" style={{stopColor: '#fbbf24', stopOpacity: 0.8}} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.6)" />
            </marker>
          </defs>
          
          {/* 時系列矢印 */}
          <line
            x1={chartPadding}
            y1={chartHeight + 15}
            x2={chartWidth - chartPadding - 10}
            y2={chartHeight + 15}
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="2"
            markerEnd="url(#arrowhead)"
          />
          <text
            x={chartPadding}
            y={chartHeight + 12}
            fill="rgba(255,255,255,0.6)"
            fontSize="9"
            fontWeight="500"
          >
            過去
          </text>
          <text
            x={chartWidth - chartPadding - 5}
            y={chartHeight + 12}
            fill="rgba(255,255,255,0.6)"
            fontSize="9"
            fontWeight="500"
            textAnchor="end"
          >
            現在
          </text>
          
          {/* 背景グリッド */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio, index) => (
            <line
              key={index}
              x1={chartPadding}
              y1={chartHeight - chartPadding - (ratio * (chartHeight - 2 * chartPadding))}
              x2={chartWidth - chartPadding}
              y2={chartHeight - chartPadding - (ratio * (chartHeight - 2 * chartPadding))}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          ))}
          
          <polyline
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="3"
              points={points}
              style={{ 
                transition: 'all 0.3s ease',
                filter: 'url(#glow)'
              }}
          />
          {statusHistory.map((status, index) => {
              const x = chartPadding + (index / (statusHistory.length > 1 ? statusHistory.length - 1 : 1)) * (chartWidth - 2 * chartPadding);
              const y = chartHeight - chartPadding - (getStatusValue(status) * (chartHeight - 2 * chartPadding));
              const isLatest = index === statusHistory.length - 1;
              
              return (
                <g key={index}>
                  <circle 
                    cx={x} 
                    cy={y} 
                    r="5" 
                    fill={getStatusColor(status)} 
                    opacity="0.3"
                    style={{ transition: 'all 0.3s ease' }}
                  />
                  <circle 
                    cx={x} 
                    cy={y} 
                    r="3" 
                    fill={getStatusColor(status)} 
                    stroke="#FFFFFF"
                    strokeWidth={isLatest ? "2" : "1"}
                    style={{ 
                      transition: 'all 0.3s ease',
                      filter: 'url(#glow)'
                    }}
                  />
                  {/* 最新ポイントにマーク */}
                  {isLatest && (
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.8)"
                      fontSize="8"
                    >
                      ●
                    </text>
                  )}
                </g>
              );
          })}
        </svg>
        <div style={{
          color: '#FFFFFF',
          fontSize: '10px', 
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          letterSpacing: '1px',
          borderRight: '1px solid rgba(255,255,255,0.3)',
          paddingRight: '8px',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          opacity: 0.7
        }}>
          高
        </div>
      </div>


      {/* 右上のボタン */}
      <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 20, display: 'flex', gap: '12px' }}>
        <button onClick={() => setShowConfirmDialog(true)} style={{ padding: '12px 24px', background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>Homeに戻る</button>
        <button onClick={() => {
          localStorage.setItem('shouldAutoConnectWebRTC', 'true');
          navigate('/break');
        }} style={{ padding: '12px 24px', background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>休憩する</button>
      </div>

      {/* 確認ダイアログ */}
      {showConfirmDialog && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '24px',
            padding: '32px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
            animation: 'dialogSlideIn 0.3s ease-out'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.25rem', 
              fontWeight: '600',
              color: 'white',
              textAlign: 'center',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              勉強を中断してもよろしいですか？
            </h3>
            <p style={{ 
              margin: '0 0 24px 0', 
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.8)',
              textAlign: 'center',
              lineHeight: '1.5'
            }}>
              現在の進行状況を保存してHomeに戻ります。
            </p>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'center' 
            }}>
              <button
                onClick={() => setShowConfirmDialog(false)}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(107, 114, 128, 0.8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(107, 114, 128, 1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(107, 114, 128, 0.8)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  handleGoHome();
                }}
                style={{
                  padding: '12px 24px',
                  background: 'rgba(239, 68, 68, 0.8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 1)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                Homeに戻る
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dialogSlideIn {
          from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}


import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StudyAnimation from 'src/components/StudyAnimation'
import { type MaterialFolder, type MaterialFile, firebaseMaterialsService } from 'src/services/firebaseMaterials'

export default function Study() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0) // 経過時間（秒）
  const [nextBreakTime, setNextBreakTime] = useState(0) // 次の休憩までの時間
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // 教材選択関連の状態
  const [allFolders, setAllFolders] = useState<MaterialFolder[]>([])
  const [currentFolder, setCurrentFolder] = useState<MaterialFolder | null>(null)
  const [files, setFiles] = useState<MaterialFile[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialFile | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<MaterialFolder[]>([])
  const [_loading, setLoading] = useState(false)
  
  // --- ファイル内容プレビュー機能 ---
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);

  // --- フリック/ホイール操作改善 ---
  const [currentItemIndex, setCurrentItemIndex] = useState(0)
  const [currentItems, setCurrentItems] = useState<(MaterialFolder | MaterialFile)[]>([])
  const [touchStart, setTouchStart] = useState<{ x: number, y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number, y: number } | null>(null)
  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const interactionPanelRef = useRef<HTMLDivElement>(null); // イベントリスナーを設定するDOM要素への参照

  // 教材フォルダとファイル取得
  useEffect(() => {
    const initializeData = async () => {
      await fetchAllFolders()
    }
    initializeData()
  }, [])

  // allFoldersが更新されたら、ルートのファイルを取得
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
    } catch (error) {
      console.error('ファイル取得エラー:', error);
      setFiles([]);
    }
  }

  // パンくずリスト生成
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

  // フォルダナビゲーション
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

  // --- イベントハンドラ (useCallbackでメモ化) ---
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
    if (!touchStart || !touchEnd) return;

    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const minFlickDistance = 50;

    if (Math.abs(distanceY) > Math.abs(distanceX) && Math.abs(distanceY) > minFlickDistance) {
        const isUpSwipe = distanceY > minFlickDistance;
        const isDownSwipe = distanceY < -minFlickDistance;

        if (isUpSwipe) {
            const parentFolder = currentFolder ? allFolders.find(f => f.id === currentFolder.parentId) : null;
            if (parentFolder) handleFolderClick(parentFolder);
            else if (currentFolder) handleNavigateToRoot();
        } else if (isDownSwipe) {
            const selectedItem = currentItems[currentItemIndex];
            if (selectedItem && 'parentId' in selectedItem) {
                handleFolderClick(selectedItem as MaterialFolder);
            }
        }
    } else if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minFlickDistance) {
        const isLeftSwipe = distanceX > minFlickDistance;
        const isRightSwipe = distanceX < -minFlickDistance;
        if (currentItems.length > 0) {
            if (isLeftSwipe) setCurrentItemIndex(i => (i + 1) % currentItems.length);
            else if (isRightSwipe) setCurrentItemIndex(i => (i - 1 + currentItems.length) % currentItems.length);
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
            if (deltaY > 0) { // 下へ
                const selectedItem = currentItems[currentItemIndex];
                if (selectedItem && 'parentId' in selectedItem) {
                    handleFolderClick(selectedItem as MaterialFolder);
                }
            } else { // 上へ
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

  // --- passive: falseでイベントリスナーを登録 ---
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

  // --- ナビゲーションリストと3D表示の連携 (改善版) ---
  useEffect(() => {
    const newChildFolders = allFolders.filter(folder => folder.parentId === (currentFolder?.id || null));
    const items: (MaterialFolder | MaterialFile)[] = [...newChildFolders, ...files];
    setCurrentItems(items);
    setCurrentItemIndex(0);
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

  // --- 選択された教材の内容を取得 ---
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

  // WebRTCの自動接続フラグを設定してBreak画面へ
  const handleBreak = useCallback(() => {
    localStorage.setItem('autoConnectWebRTC', 'true')
    if (selectedMaterial) {
      localStorage.setItem('selectedMaterial', JSON.stringify(selectedMaterial))
    }
    navigate('/break')
  }, [navigate, selectedMaterial]);

  // 設定を読み込み
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

  // Webカメラを開始
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
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
      {/* 左側：情報・プレビューエリア */}
    <div 
      style={{
        width: '300px', 
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
        {/* Webカメラ */}
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

        {/* --- 教材表示 --- */}
        <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            <h3 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '16px', flexShrink: 0 }}>
                教材表示
            </h3>
            <div style={{ flex: 1, overflow: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '12px', color: 'white' }}>
                {isContentLoading ? (
                    <p>読み込み中...</p>
                ) : selectedMaterial?.type === 'image' && selectedMaterial.downloadURL ? (
                    <img src={selectedMaterial.downloadURL} alt={selectedMaterial.name} style={{ width: '100%', height: 'auto', borderRadius: '8px' }} />
                ) : selectedMaterial?.type === 'text' ? (
                    <pre style={{ fontSize: '12px', color: 'white', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                        {textContent}
                    </pre>
                ) : (
                    <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: '20px' }}>
                        ファイルを選択するとここに内容が表示されます。
                    </p>
                )}
            </div>
        </div>
      </div>

      {/* 右側：StudyAnimationエリア */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <StudyAnimation selectedMaterial={selectedMaterial} />
        
        {/* --- 左下：教材選択ナビゲーション (修正) --- */}
        <div 
            ref={interactionPanelRef}
            style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px', // ★ rightからleftに変更
                width: '300px',
                height: '45%',
                zIndex: 10,
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                touchAction: 'none',
                userSelect: 'none'
            }}
        >
          <h3 style={{ margin: '0 0 12px 0', color: 'white', fontSize: '16px', flexShrink: 0 }}>
            教材選択 
            <span style={{ fontSize: '12px', opacity: 0.7 }}> (フリックで操作)</span>
          </h3>
          
          <div style={{ marginBottom: '12px', fontSize: '12px', color: 'white', wordBreak: 'break-all', flexShrink: 0 }}>
            📍 {breadcrumbs.length > 0 ? breadcrumbs.map(folder => folder.name).join(' / ') : 'ルート'}
          </div>

          <div style={{ marginBottom: '8px', flexShrink: 0, background: 'rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '12px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.4' }}>
            <div style={{ fontWeight: '600' }}>📱 操作方法</div>
            <div>↔️ 左右: 項目選択</div>
            <div>⬆️ 上: 親フォルダへ</div>
            <div>⬇️ 下: フォルダを開く</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
              {currentItems.length > 0 ? (
                currentItems.map((item, index) => (
                  <div key={item.id} style={{ padding: '8px 12px', background: index === currentItemIndex ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)', border: `2px solid ${index === currentItemIndex ? 'rgba(59, 130, 246, 0.6)' : 'transparent'}`, borderRadius: '12px', marginBottom: '8px', transition: 'all 0.2s ease-in-out', transform: index === currentItemIndex ? 'scale(1.02)' : 'scale(1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>{'parentId' in item ? '📁' : (item.type === 'text' ? '📄' : '🖼️')}</span>
                    <span style={{ color: 'white', fontWeight: '500', fontSize: '14px' }}>{item.name}</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)', paddingTop: '20px' }}><div style={{ fontSize: '32px', opacity: 0.5 }}>🗂️</div><p>空のフォルダ</p></div>
              )}
            </div>
        </div>
        
        <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
          <button onClick={handleBreak} style={{ padding: '12px 24px', background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '16px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'; e.currentTarget.style.transform = 'translateY(-2px)' }} onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; e.currentTarget.style.transform = 'translateY(0)' }}>
            休憩に入る
          </button>
        </div>
        
      </div>
    </div>
  )
}


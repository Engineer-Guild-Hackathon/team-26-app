import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { type MaterialFolder, type MaterialFile, firebaseMaterialsService } from '../services/firebaseMaterials'
import FileExplorer from '../components/FileExplorer'

// アイコンコンポーネント
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5">
    <path d="m9 19-7-7 7-7"/>
    <path d="M28 12H5"/>
  </svg>
)

const FolderIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const UploadIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7,10 12,15 17,10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)


const TrashIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3,6 5,6 21,6"/>
    <path d="m19,6v14a2 2 0 0 1-2,2H7a2 2 0 0 1-2-2V6m3,0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2,2v2"/>
  </svg>
)

export default function Materials() {
  const navigate = useNavigate()
  // 状態管理
  const [allFolders, setAllFolders] = useState<MaterialFolder[]>([])
  const [currentFolder, setCurrentFolder] = useState<MaterialFolder | null>(null)
  const [files, setFiles] = useState<MaterialFile[]>([])
  const [loading, setLoading] = useState(false)
  
  // フォルダ作成
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null)
  
  // ファイル表示オーバーレイ関連
  const [showFileOverlay, setShowFileOverlay] = useState(false)
  const [overlayFile, setOverlayFile] = useState<MaterialFile | null>(null)
  const [overlayContent, setOverlayContent] = useState<string>('')
  const [isLoadingOverlay, setIsLoadingOverlay] = useState(false)
  
  // ファイル管理
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [textContent, setTextContent] = useState('')
  const [textFileName, setTextFileName] = useState('')
  const [showTextEditor, setShowTextEditor] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 初期化
  useEffect(() => {
    fetchAllFolders()
    fetchFiles(undefined) // ルートフォルダのファイル
  }, [])

  // 全フォルダ取得（階層表示用）
  const fetchAllFolders = async () => {
    try {
      setLoading(true)
      // 全フォルダを取得（階層問わず）
      const rootFolders = await firebaseMaterialsService.getFolders()
      const allFoldersData: MaterialFolder[] = [...rootFolders]
      
      // 各フォルダの子フォルダも取得
      for (const folder of rootFolders) {
        const childFolders = await loadChildFolders(folder.id, allFoldersData)
        allFoldersData.push(...childFolders)
      }
      
      setAllFolders(allFoldersData)
    } catch (error) {
      console.error('フォルダ取得エラー:', error)
      alert('フォルダ一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 子フォルダ再帰取得
  const loadChildFolders = async (parentId: string, currentFolders: MaterialFolder[]): Promise<MaterialFolder[]> => {
    try {
      const childFolders = await firebaseMaterialsService.getChildFolders(parentId)
      const allChildren: MaterialFolder[] = [...childFolders]
      
      // 孫フォルダも再帰的に取得
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

  // ファイル一覧取得
  const fetchFiles = async (folderId: string | null | undefined) => {
    if (!folderId) {
      setFiles([])
      return
    }
    
    try {
      const filesData = await firebaseMaterialsService.getFiles(folderId)
      setFiles(filesData)
    } catch (error) {
      console.error('ファイル取得エラー:', error)
      alert('ファイル一覧の取得に失敗しました')
    }
  }

  // フォルダ作成
  const createFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      setLoading(true)
      const newFolder = await firebaseMaterialsService.createFolder(
        newFolderName.trim(), 
        createFolderParentId || undefined
      )
      
      // リアルタイムでフォルダ追加
      setAllFolders(prev => [...prev, newFolder])
      
      setNewFolderName('')
      setShowFolderForm(false)
      setCreateFolderParentId(null)
      
      alert(`フォルダ「${newFolder.name}」を作成しました`)
    } catch (error) {
      console.error('フォルダ作成エラー:', error)
      alert('フォルダ作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // フォルダ削除
  const deleteFolder = async (folder: MaterialFolder) => {
    if (!confirm(`フォルダ「${folder.name}」とその中身をすべて削除しますか？`)) return

    try {
      setLoading(true)
      await firebaseMaterialsService.deleteFolder(folder.id)
      
      // フォルダリストから削除
      setAllFolders(prev => prev.filter(f => f.id !== folder.id))
      
      // 現在のフォルダが削除された場合はルートに戻る
      if (currentFolder?.id === folder.id) {
        setCurrentFolder(null)
        fetchFiles(undefined)
      }
      
      alert('フォルダを削除しました')
    } catch (error) {
      console.error('フォルダ削除エラー:', error)
      alert('フォルダ削除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // ファイルアップロード
  const uploadFile = async () => {
    if (!selectedFile || !selectedFolder) return

    try {
      setLoading(true)
      await firebaseMaterialsService.uploadFile(selectedFile, selectedFolder)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      fetchFiles(selectedFolder)
      alert('画像をアップロードしました')
    } catch (error) {
      console.error('ファイルアップロードエラー:', error)
      alert(error instanceof Error ? error.message : 'ファイルアップロードに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // テキストファイル作成
  const createTextFile = async () => {
    if (!textContent.trim() || !selectedFolder) return

    try {
      setLoading(true)
      await firebaseMaterialsService.createTextFile(textContent, selectedFolder, textFileName || undefined)
      setTextContent('')
      setTextFileName('')
      // 作成後もテキストタブは開いたままにする
      fetchFiles(selectedFolder)
      alert('テキストファイルを作成しました')
    } catch (error) {
      console.error('テキストファイル作成エラー:', error)
      alert(error instanceof Error ? error.message : 'テキストファイル作成に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // ファイル削除
  const deleteFile = async (file: MaterialFile) => {
    if (!confirm(`${file.name} を削除しますか？`)) return

    try {
      setLoading(true)
      await firebaseMaterialsService.deleteFile(file.id)
      fetchFiles(currentFolder?.id || undefined)
    } catch (error) {
      console.error('ファイル削除エラー:', error)
      alert('ファイル削除に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // フォルダクリック（ナビゲーション）
  const handleFolderClick = (folder: MaterialFolder) => {
    setCurrentFolder(folder)
    setSelectedFolder(folder.id)
    fetchFiles(folder.id)
  }

  // ファイルクリック（オーバーレイ表示）
  const handleFileClick = async (file: MaterialFile) => {
    console.log('ファイルクリック:', file)
    setOverlayFile(file)
    setShowFileOverlay(true)
    setIsLoadingOverlay(true)
    
    try {
      if (file.type === 'text') {
        const content = await firebaseMaterialsService.getTextContent(file.id)
        setOverlayContent(content)
      } else {
        setOverlayContent('') // 画像の場合は内容なし
      }
    } catch (error) {
      console.error('ファイル内容取得エラー:', error)
      setOverlayContent('ファイル内容の取得に失敗しました。')
    } finally {
      setIsLoadingOverlay(false)
    }
  }


  // ルートに戻る
  const handleNavigateToRoot = () => {
    setCurrentFolder(null)
    setSelectedFolder('')
    fetchFiles(null)
  }

  // フォルダ選択（右クリック等）
  const handleFolderSelect = (folder: MaterialFolder) => {
    setSelectedFolder(folder.id)
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      overflow: 'hidden'
    }}>
      {/* グラスモーフィズム背景 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
      }}>
        {/* コンテナ */}
        <div style={{ 
          width: '100%', 
          height: '100%', 
          padding: '32px', 
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* ヘッダー */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '32px'
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
            <div>
              <h1 style={{ 
                margin: 0, 
                color: 'white',
                fontSize: '2.5rem',
                fontWeight: '700',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                📚 教材管理
              </h1>
              <p style={{
                margin: '8px 0 0 0',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '1.1rem'
              }}>
                授業で使用する教材を整理・管理できます ✨
              </p>
            </div>
          </div>

          {/* メインコンテンツエリア */}
          <div style={{ 
            display: 'flex', 
            gap: '24px', 
            flex: 1,
            minHeight: 0
          }}>
            {/* 左側：ファイルエクスプローラー */}
            <div style={{ 
              flex: '1',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 16px 64px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <FileExplorer
                currentFolder={currentFolder}
                allFolders={allFolders}
                files={files}
                loading={loading}
                onFolderClick={handleFolderClick}
                onFileClick={handleFileClick}
                onFileDelete={deleteFile}
                onNavigateToRoot={handleNavigateToRoot}
                onFolderSelect={handleFolderSelect}
              />
            </div>

            {/* 右側：操作パネル */}
            <div style={{ 
              width: '360px',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}>
              {/* 操作パネル */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 16px 64px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  padding: '24px 24px 16px 24px',
                  flexShrink: 0
                }}>
                  <h3 style={{ 
                    margin: '0 0 16px 0', 
                    fontSize: '1.4rem', 
                    fontWeight: '600', 
                    color: 'white',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}>
                    🛠️ 操作パネル
                  </h3>
                </div>

                <div style={{ 
                  padding: '0 24px 24px 24px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '20px',
                  overflowY: 'auto',
                  flex: 1
                }}>
                  {/* フォルダ作成 */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <FolderIcon />
                      <h4 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: 'white' }}>
                        フォルダ作成
                      </h4>
                    </div>
                    {!showFolderForm ? (
                      <button
                        onClick={() => {
                          setShowFolderForm(true)
                          setCreateFolderParentId(currentFolder?.id || null)
                        }}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          background: 'rgba(59, 130, 246, 0.8)',
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
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 1)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        + 新しいフォルダ
                      </button>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="フォルダ名"
                          style={{
                            padding: '12px 16px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: 'white',
                            backdropFilter: 'blur(10px)',
                            outline: 'none'
                          }}
                          onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={createFolder}
                            disabled={!newFolderName.trim()}
                            style={{
                              flex: '1',
                              padding: '8px 12px',
                              background: newFolderName.trim() ? 'rgba(16, 185, 129, 0.8)' : 'rgba(107, 114, 128, 0.5)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            作成
                          </button>
                          <button
                            onClick={() => {
                              setShowFolderForm(false)
                              setNewFolderName('')
                            }}
                            style={{
                              flex: '1',
                              padding: '8px 12px',
                              background: 'rgba(107, 114, 128, 0.8)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ファイル作成・アップロード */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <UploadIcon />
                      <h4 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: 'white' }}>
                        ファイル作成・アップロード
                      </h4>
                    </div>
                    
                    {/* タブ切り替え */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <button
                        onClick={() => setShowTextEditor(false)}
                        style={{
                          flex: '1',
                          padding: '8px 12px',
                          background: !showTextEditor ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        📷 画像
                      </button>
                      <button
                        onClick={() => setShowTextEditor(true)}
                        style={{
                          flex: '1',
                          padding: '8px 12px',
                          background: showTextEditor ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.1)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '600',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        📄 テキスト
                      </button>
                    </div>

                    {/* 画像アップロード */}
                    {!showTextEditor && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: 'white',
                            backdropFilter: 'blur(10px)',
                            outline: 'none',
                            boxSizing: 'border-box',
                            maxWidth: '100%'
                          }}
                        />
                        <button
                          onClick={uploadFile}
                          disabled={!selectedFile || !selectedFolder}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: (selectedFile && selectedFolder) ? 'rgba(16, 185, 129, 0.8)' : 'rgba(107, 114, 128, 0.5)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: (selectedFile && selectedFolder) ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.3s ease',
                            backdropFilter: 'blur(10px)'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedFile && selectedFolder) {
                              e.currentTarget.style.background = 'rgba(16, 185, 129, 1)'
                              e.currentTarget.style.transform = 'translateY(-2px)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedFile && selectedFolder) {
                              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.8)'
                              e.currentTarget.style.transform = 'translateY(0)'
                            }
                          }}
                        >
                          アップロード
                        </button>
                      </div>
                    )}

                    {/* テキストファイル作成 */}
                    {showTextEditor && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input
                          type="text"
                          value={textFileName}
                          onChange={(e) => setTextFileName(e.target.value)}
                          placeholder="ファイル名（省略可）"
                          style={{
                            padding: '12px 16px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: 'white',
                            backdropFilter: 'blur(10px)',
                            outline: 'none'
                          }}
                        />
                        <textarea
                          value={textContent}
                          onChange={(e) => setTextContent(e.target.value)}
                          placeholder="テキスト内容"
                          rows={4}
                          style={{
                            padding: '12px 16px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: 'white',
                            resize: 'vertical',
                            fontFamily: 'monospace',
                            backdropFilter: 'blur(10px)',
                            outline: 'none',
                            minHeight: '80px'
                          }}
                        />
                        <button
                          onClick={createTextFile}
                          disabled={!textContent.trim() || !selectedFolder}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: (textContent.trim() && selectedFolder) ? 'rgba(16, 185, 129, 0.8)' : 'rgba(107, 114, 128, 0.5)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: (textContent.trim() && selectedFolder) ? 'pointer' : 'not-allowed',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.3s ease',
                            backdropFilter: 'blur(10px)'
                          }}
                          onMouseEnter={(e) => {
                            if (textContent.trim() && selectedFolder) {
                              e.currentTarget.style.background = 'rgba(16, 185, 129, 1)'
                              e.currentTarget.style.transform = 'translateY(-2px)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (textContent.trim() && selectedFolder) {
                              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.8)'
                              e.currentTarget.style.transform = 'translateY(0)'
                            }
                          }}
                        >
                          作成
                        </button>
                      </div>
                    )}

                    {/* 共通の注意書き */}
                    {!selectedFolder && (
                      <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: 'rgba(239, 68, 68, 0.8)' }}>
                        ※ フォルダを選択してください
                      </p>
                    )}
                  </div>

                  {/* 選択フォルダ削除 */}
                  {currentFolder && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      borderRadius: '16px',
                      padding: '20px',
                      border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <TrashIcon />
                        <h4 style={{ margin: '0', fontSize: '16px', fontWeight: '600', color: 'white' }}>
                          フォルダ削除
                        </h4>
                      </div>
                      <button
                        onClick={() => deleteFolder(currentFolder)}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
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
                        「{currentFolder.name}」を削除
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ファイル内容表示オーバーレイ */}
      {showFileOverlay && overlayFile && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '40px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '24px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '85%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* ヘッダー */}
            <div style={{
              padding: '24px 32px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>
                  {overlayFile.type === 'text' ? '📄' : '🖼️'}
                </span>
                <h3 style={{ 
                  margin: '0', 
                  fontSize: '1.5rem', 
                  fontWeight: '600',
                  color: 'white',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  {overlayFile.name}
                </h3>
              </div>
              <button
                onClick={() => setShowFileOverlay(false)}
                style={{
                  background: 'rgba(239, 68, 68, 0.8)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '12px 16px',
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
                ✕ 閉じる
              </button>
            </div>

            {/* コンテンツ */}
            <div style={{
              padding: '32px',
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isLoadingOverlay ? (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '16px',
                  color: 'white',
                  fontSize: '18px'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '3px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '3px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  読み込み中...
                </div>
              ) : overlayFile.type === 'image' && overlayFile.downloadURL ? (
                <img 
                  src={overlayFile.downloadURL} 
                  alt={overlayFile.name}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    objectFit: 'contain',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
                  }} 
                />
              ) : overlayFile.type === 'text' ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '16px',
                  padding: '24px',
                  overflow: 'auto'
                }}>
                  <pre style={{ 
                    fontSize: '16px', 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word', 
                    margin: '0',
                    color: 'white',
                    fontFamily: 'monospace',
                    lineHeight: '1.6'
                  }}>
                    {overlayContent}
                  </pre>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '18px'
                }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.6 }}>📄</div>
                  <p>このファイルは表示できません</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

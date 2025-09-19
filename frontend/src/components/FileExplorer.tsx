import React, { useState } from 'react'
import { type MaterialFolder, type MaterialFile, firebaseMaterialsService } from '../services/firebaseMaterials'

interface FileExplorerProps {
  currentFolder: MaterialFolder | null
  allFolders: MaterialFolder[]
  files: MaterialFile[]
  loading: boolean
  onFolderClick: (folder: MaterialFolder) => void
  onFileClick: (file: MaterialFile) => void
  onFileDelete: (file: MaterialFile) => void
  onNavigateToRoot: () => void
  onFolderSelect: (folder: MaterialFolder) => void
}

// パンくずリスト生成
const generateBreadcrumbs = (currentFolder: MaterialFolder | null, allFolders: MaterialFolder[]) => {
  if (!currentFolder) return []
  
  const breadcrumbs: MaterialFolder[] = []
  let folder: MaterialFolder | undefined = currentFolder
  
  while (folder) {
    breadcrumbs.unshift(folder)
    folder = allFolders.find(f => f.id === folder?.parentId)
  }
  
  return breadcrumbs
}

export default function FileExplorer({
  currentFolder,
  allFolders,
  files,
  loading,
  onFolderClick,
  onFileClick,
  onFileDelete,
  onNavigateToRoot,
  onFolderSelect
}: FileExplorerProps) {
  const [editingFile, setEditingFile] = useState<MaterialFile | null>(null)
  const [editingContent, setEditingContent] = useState('')

  // パンくずリスト
  const breadcrumbs = generateBreadcrumbs(currentFolder, allFolders)
  
  // 現在のフォルダの子フォルダ
  const childFolders = allFolders.filter(folder => 
    folder.parentId === (currentFolder?.id || null)
  )

  // ファイル編集開始
  const startEditingFile = async (file: MaterialFile) => {
    if (file.type !== 'text') return
    
    try {
      const content = await firebaseMaterialsService.getTextContent(file.id)
      setEditingFile(file)
      setEditingContent(content)
    } catch (error) {
      console.error('テキスト内容取得エラー:', error)
      alert('テキスト内容の取得に失敗しました')
    }
  }

  // ファイル編集保存
  const saveEditingFile = async () => {
    if (!editingFile) return
    
    try {
      await firebaseMaterialsService.updateTextContent(editingFile.id, editingContent)
      setEditingFile(null)
      setEditingContent('')
      alert('ファイルを更新しました')
    } catch (error) {
      console.error('ファイル更新エラー:', error)
      alert('ファイル更新に失敗しました')
    }
  }

  // ファイル編集キャンセル
  const cancelEditingFile = () => {
    setEditingFile(null)
    setEditingContent('')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <div style={{ 
          fontSize: '18px', 
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            border: '2px solid #e5e7eb',
            borderTop: '2px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          読み込み中...
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ヘッダー */}
      <div style={{ 
        padding: '24px 24px 16px 24px'
      }}>
        <h3 style={{ 
          margin: '0', 
          fontSize: '1.4rem', 
          fontWeight: '600', 
          color: 'white',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          📁 ファイルエクスプローラー
        </h3>
        
        {/* パンくずリスト */}
        <div style={{ 
          marginTop: '12px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          fontSize: '14px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={onNavigateToRoot}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: '500',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            🏠 ルート
          </button>
          
          {breadcrumbs.map((folder, index) => (
            <React.Fragment key={folder.id}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>/</span>
              <button
                onClick={() => onFolderClick(folder)}
                style={{
                  background: index === breadcrumbs.length - 1 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: index === breadcrumbs.length - 1 ? 'default' : 'pointer',
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontWeight: index === breadcrumbs.length - 1 ? '600' : '400',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  if (index !== breadcrumbs.length - 1) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (index !== breadcrumbs.length - 1) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                {folder.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* コンテンツエリア */}
      <div style={{ 
        padding: '16px 24px 24px 24px', 
        flex: 1, 
        overflowY: 'auto' 
      }}>
        {/* フォルダ一覧 */}
        {childFolders.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}>
              📂 フォルダ
            </h4>
            <div style={{ display: 'grid', gap: '12px' }}>
              {childFolders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => onFolderClick(folder)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onFolderSelect(folder)
                  }}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <span style={{ fontSize: '20px' }}>📁</span>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: 'white', flex: 1 }}>
                    {folder.name}
                  </span>
                  {folder.hasChildren && (
                    <span style={{ 
                      fontSize: '11px', 
                      color: 'rgba(255, 255, 255, 0.7)',
                      background: 'rgba(59, 130, 246, 0.3)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: '1px solid rgba(59, 130, 246, 0.5)'
                    }}>
                      サブフォルダあり
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ファイル一覧 */}
        {files.length > 0 && (
          <div>
            <h4 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}>
              📄 ファイル
            </h4>
            <div style={{ display: 'grid', gap: '12px' }}>
              {files.map((file) => (
                <div
                  key={file.id}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '12px',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>
                      {file.type === 'text' ? '📄' : '🖼️'}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: 'white', flex: 1 }}>
                      {file.name}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {file.type === 'text' && (
                        <button
                          onClick={() => startEditingFile(file)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            background: 'rgba(59, 130, 246, 0.8)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.3s ease',
                            backdropFilter: 'blur(10px)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 1)'
                            e.currentTarget.style.transform = 'translateY(-1px)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.8)'
                            e.currentTarget.style.transform = 'translateY(0)'
                          }}
                        >
                          編集
                        </button>
                      )}
                      <button
                        onClick={() => onFileClick(file)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: 'rgba(16, 185, 129, 0.8)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.3s ease',
                          backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 1)'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(16, 185, 129, 0.8)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        選択
                      </button>
                      <button
                        onClick={() => onFileDelete(file)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          background: 'rgba(239, 68, 68, 0.8)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.3s ease',
                          backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 1)'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 空の状態 */}
        {childFolders.length === 0 && files.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 20px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.6 }}>📁</div>
            <p style={{ 
              margin: '0', 
              fontSize: '18px', 
              fontWeight: '600', 
              color: 'white',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)'
            }}>
              このフォルダは空です
            </p>
            <p style={{ 
              margin: '12px 0 0 0', 
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)'
            }}>
              右側のパネルからフォルダやファイルを作成してください ✨
            </p>
          </div>
        )}
      </div>

      {/* ファイル編集モーダル */}
      {editingFile && (
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '32px',
            borderRadius: '24px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '80%',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            <h3 style={{ 
              margin: '0 0 24px 0', 
              fontSize: '1.5rem', 
              fontWeight: '600',
              color: 'white',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              📝 {editingFile.name} を編集
            </h3>
            <textarea
              value={editingContent}
              onChange={(e) => setEditingContent(e.target.value)}
              style={{
                width: '100%',
                height: '350px',
                padding: '16px 20px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                fontSize: '14px',
                color: 'white',
                fontFamily: 'monospace',
                resize: 'vertical',
                backdropFilter: 'blur(10px)',
                outline: 'none'
              }}
              placeholder="テキスト内容を入力..."
            />
            <div style={{ 
              marginTop: '24px', 
              display: 'flex', 
              gap: '12px', 
              justifyContent: 'flex-end' 
            }}>
              <button
                onClick={cancelEditingFile}
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
                onClick={saveEditingFile}
                style={{
                  padding: '12px 24px',
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
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

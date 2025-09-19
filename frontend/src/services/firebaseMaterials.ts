// Firebase Materials Service - 教材管理用サービス

export interface MaterialFolder {
  id: string
  name: string
  parentId: string | null
  path: string
  level: number
  hasChildren?: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface MaterialFile {
  id: string
  name: string
  extension: string
  type: 'text' | 'image'
  content?: string
  storagePath?: string
  downloadURL?: string
  folderId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export class FirebaseMaterialsService {
  private apiUrl: string

  constructor() {
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-User-ID': 'demo-user' // 実際の実装では認証から取得
    }
  }

  // フォルダ一覧取得（指定親フォルダの子フォルダのみ）
  async getFolders(parentId?: string): Promise<MaterialFolder[]> {
    const params = new URLSearchParams()
    if (parentId) {
      params.append('parentId', parentId)
    }
    
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/folders?${params}`, {
      headers: { 'X-User-ID': 'demo-user' }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`フォルダ取得に失敗しました: ${response.status}`)
    }
    
    const data = await response.json()
    return data.folders
  }

  // フォルダ内ファイル一覧取得
  async getFiles(folderId: string): Promise<MaterialFile[]> {
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/folders/${folderId}/files`, {
      headers: { 'X-User-ID': 'demo-user' }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`ファイル取得に失敗しました: ${response.status}`)
    }
    
    const data = await response.json()
    return data.files
  }

  // フォルダ作成
  async createFolder(name: string, parentId?: string): Promise<MaterialFolder> {
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/folders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, parentId })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`フォルダ作成に失敗しました: ${response.status}`)
    }
    
    const data = await response.json()
    return data.folder
  }

  // フォルダ名変更
  async updateFolder(folderId: string, name: string): Promise<MaterialFolder> {
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/folders/${folderId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ name })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`フォルダ更新に失敗しました: ${response.status}`)
    }
    
    const data = await response.json()
    return data.folder
  }

  // フォルダ削除
  async deleteFolder(folderId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/folders/${folderId}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': 'demo-user' }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`フォルダ削除に失敗しました: ${response.status}`)
    }
  }

  // テキストファイル作成
  async createTextFile(content: string, folderId: string, name?: string): Promise<MaterialFile> {
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/text`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ 
        name: name || `テキストファイル_${Date.now()}`,
        content, 
        folderId 
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`テキストファイル作成に失敗しました: ${response.status}`)
    }
    
    const data = await response.json()
    return data.material
  }

  // 画像ファイルアップロード
  async uploadFile(file: File, folderId: string): Promise<MaterialFile> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folderId', folderId)

    const response = await fetch(`${this.apiUrl}/api/firebase-materials/upload`, {
      method: 'POST',
      headers: { 'X-User-ID': 'demo-user' },
      body: formData
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`ファイルアップロードに失敗しました: ${response.status}`)
    }
    
    const data = await response.json()
    return data.material
  }

  // テキストファイル内容取得
  async getTextContent(materialId: string): Promise<string> {
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/files/${materialId}/content`, {
      headers: { 'X-User-ID': 'demo-user' }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`テキスト内容取得に失敗しました: ${response.status}`)
    }
    
    const data = await response.json()
    return data.content
  }

  // テキストファイル内容更新
  async updateTextContent(materialId: string, content: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/files/${materialId}/content`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ content })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`テキスト内容更新に失敗しました: ${response.status}`)
    }
  }

  // ファイル削除
  async deleteFile(materialId: string): Promise<void> {
    const response = await fetch(`${this.apiUrl}/api/firebase-materials/files/${materialId}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': 'demo-user' }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API Error:', response.status, errorText)
      throw new Error(`ファイル削除に失敗しました: ${response.status}`)
    }
  }

  // 子フォルダ取得（階層表示用）
  async getChildFolders(parentId: string): Promise<MaterialFolder[]> {
    return this.getFolders(parentId)
  }
}

// シングルトンインスタンス
export const firebaseMaterialsService = new FirebaseMaterialsService()

// API設定
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
  WS_URL: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
  ENDPOINTS: {
    // 学習セッション
    STUDY_SESSION_START: '/api/study/session/start',
    STUDY_SESSION_BREAK: '/api/study/session/break',
    STUDY_SESSION_RESUME: '/api/study/session/resume',
    STUDY_SESSION_END: '/api/study/session/end',
    STUDY_SESSION_GET: (sessionId: string) => `/api/study/session/${sessionId}`,
    STUDY_BREAK_GET: (breakId: string) => `/api/study/break/${breakId}`,
    
    // AI機能
    AI_ANALYZE_IMAGES: '/api/ai/analyze-images',
    AI_CHAT: '/api/ai/chat',
    AI_TRANSCRIBE: '/api/ai/transcribe',
    AI_SYNTHESIZE: '/api/ai/synthesize',
    
    // ユーザー
    USER_STATS: (userId: string) => `/api/user/${userId}/stats`,
    USER_SESSIONS: (userId: string) => `/api/user/${userId}/sessions`,
    USER_STATS_UPDATE: (userId: string) => `/api/user/${userId}/stats/update`,
    USER_PREFERENCES: (userId: string) => `/api/user/${userId}/preferences`,
    
    // WebSocket
    WS_REALTIME: (breakId: string) => `/ai/realtime/${breakId}`
  }
};

// API呼び出し用のヘルパー関数
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_CONFIG.BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    try {
      const response = await fetch(url, finalOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // PUT request
  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  // DELETE request
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// デフォルトのAPIクライアントインスタンス
export const apiClient = new ApiClient();

// WebSocket接続用のヘルパークラス
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private breakId: string;
  private onMessage: (message: any) => void;
  private onError: (error: Event) => void;
  private onClose: () => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(
    breakId: string,
    onMessage: (message: any) => void,
    onError: (error: Event) => void = () => {},
    onClose: () => void = () => {}
  ) {
    this.breakId = breakId;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onClose = onClose;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${API_CONFIG.WS_URL}${API_CONFIG.ENDPOINTS.WS_REALTIME(this.breakId)}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log(`WebSocket connected for break: ${this.breakId}`);
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.onMessage(message);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log(`WebSocket closed for break: ${this.breakId}`);
          this.ws = null;
          this.onClose();
          
          // 自動再接続（必要に応じて）
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
              this.connect();
            }, 2000 * this.reconnectAttempts);
          }
        };

        this.ws.onerror = (error) => {
          console.error(`WebSocket error for break: ${this.breakId}`, error);
          this.onError(error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  sendMessage(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// 型定義
export interface StudySession {
  sessionId: string;
  userId?: string;
  studyContent: string;
  targetTime: number;
  pomodoroTime: number;
  motivationalMessage?: string;
  startTime: string;
  nextBreakTime: number;
  status: 'active' | 'completed' | 'paused';
  breaks: string[];
}

export interface BreakData {
  breakId: string;
  sessionId: string;
  webcamImage: string;
  screenImage: string;
  elapsedTime: number;
  timestamp: string;
  status: 'active' | 'completed';
}

export interface UserStats {
  period: string;
  weeklyData: number[];
  studyContent: {
    math: number;
    english: number;
    science: number;
    other: number;
  };
  totalHours: number;
  sessionsCount: number;
  averageSessionTime: number;
  streak: number;
  lastUpdated: string;
}

export interface AIAnalysisResult {
  breakId: string;
  analysis: string;
  suggestions: string[];
  encouragement: string;
  timestamp: string;
  fallback?: boolean;
}

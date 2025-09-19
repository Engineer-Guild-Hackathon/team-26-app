import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// アイコンコンポーネント
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="5">
    <path d="m9 19-7-7 7-7"/>
    <path d="M28 12H5"/>
  </svg>
)

const BookIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)

const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12,6 12,12 16,14"/>
  </svg>
)

const MessageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
  </svg>
)

export default function StudySettings() {
  const navigate = useNavigate()
  const [studyContent, setStudyContent] = useState('')
  const [targetTime, setTargetTime] = useState(25) // デフォルト25分
  const [pomodoroTime, setPomodoroTime] = useState(25) // デフォルト25分
  const [motivationalMessage, setMotivationalMessage] = useState('')

  const handleStart = () => {
    // 設定をローカルストレージに保存（後でFirebaseに変更予定）
    const settings = {
      studyContent,
      targetTime,
      pomodoroTime,
      motivationalMessage,
      startTime: new Date().toISOString()
    }
    localStorage.setItem('studySettings', JSON.stringify(settings))
    navigate('/study')
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
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px',
        boxSizing: 'border-box'
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(20px)',
          borderRadius: '32px',
          padding: '48px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.1)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          {/* ヘッダー */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '40px' 
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
                fontSize: '2rem',
                fontWeight: '700',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                📚 Study with me の設定
              </h1>
              <p style={{
                margin: '8px 0 0 0',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '1rem'
              }}>
                あなたの学習スタイルに合わせてカスタマイズしよう
              </p>
            </div>
          </div>

          {/* 設定フォーム */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* 学習内容の設定 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <BookIcon />
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  color: 'white',
                  fontSize: '1.2rem'
                }}>
                  📖 学習内容
                </label>
              </div>
              <input
                type="text"
                value={studyContent}
                onChange={(e) => setStudyContent(e.target.value)}
                placeholder="例: 数学の微分積分"
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#333',
                  outline: 'none',
                  transition: 'all 0.3s ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)'
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* 時間設定 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <ClockIcon />
                <h3 style={{
                  margin: 0,
                  fontWeight: '600',
                  color: 'white',
                  fontSize: '1.2rem'
                }}>
                  ⏰ 時間設定
                </h3>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '24px'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '12px',
                    fontWeight: '500',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '1rem'
                  }}>
                    🎯 目標時間
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={targetTime}
                      onChange={(e) => setTargetTime(Number(e.target.value))}
                      min="1"
                      max="300"
                      style={{
                        width: '100%',
                        padding: '16px 50px 16px 20px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '16px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        background: 'rgba(255, 255, 255, 0.9)',
                        color: '#333',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)'
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                    <span style={{ 
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '14px', 
                      color: '#666',
                      fontWeight: '500'
                    }}>分</span>
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '12px',
                    fontWeight: '500',
                    color: 'rgba(255,255,255,0.9)',
                    fontSize: '1rem'
                  }}>
                    🍅 ポモドーロ時間
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      value={pomodoroTime}
                      onChange={(e) => setPomodoroTime(Number(e.target.value))}
                      min="1"
                      max="120"
                      style={{
                        width: '100%',
                        padding: '16px 50px 16px 20px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '16px',
                        fontSize: '16px',
                        boxSizing: 'border-box',
                        background: 'rgba(255, 255, 255, 0.9)',
                        color: '#333',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)'
                        e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                    <span style={{ 
                      position: 'absolute',
                      right: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '14px', 
                      color: '#666',
                      fontWeight: '500'
                    }}>分</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 意気込みメッセージ */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderRadius: '20px',
              padding: '28px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <MessageIcon />
                <label style={{
                  display: 'block',
                  fontWeight: '600',
                  color: 'white',
                  fontSize: '1.2rem'
                }}>
                  💪 今日の意気込み
                </label>
              </div>
              <textarea
                value={motivationalMessage}
                onChange={(e) => setMotivationalMessage(e.target.value)}
                placeholder="今日は頑張るぞ！"
                rows={3}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '16px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#333',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)'
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.3)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* 開始ボタン */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <button
                onClick={handleStart}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '20px 48px',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                  color: '#333',
                  border: 'none',
                  borderRadius: '24px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  fontWeight: '700',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 8px 32px rgba(255, 215, 0, 0.4)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.05)'
                  e.currentTarget.style.boxShadow = '0 12px 48px rgba(255, 215, 0, 0.6)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 215, 0, 0.4)'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🚀</span>
                勉強を開始する！
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
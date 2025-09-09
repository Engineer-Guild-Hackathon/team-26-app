import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import TalkAnimation from '../components/TalkAnimation'

// ダミーデータ
const dummyWeeklyData = [2, 3, 1, 4, 2, 5, 6] // 1週間の学習時間（時間）
const dummyStudyContent = {
  math: 40,
  english: 30,
  science: 20,
  other: 10
}

// キャラクターセリフ集
const characterMessages = [
  "今日も一緒に勉強しよう！📚",
  "頑張ってるね〜！✨",
  "休憩も大切だよ〜☕",
  "目標達成まであと少し！💪",
  "今日のやる気はどう？😊",
  "一緒に成長していこう！🌟",
  "学習のペースはいい感じ？🎯",
  "今日も素敵な一日にしよう！🌈"
]

// アイコンコンポーネント
const StudyIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
)

const StatsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 20V10"/>
    <path d="M12 20V4"/>
    <path d="M6 20v-6"/>
  </svg>
)

const TargetIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
)

export default function Home() {
  const navigate = useNavigate()
  const [currentMessage, setCurrentMessage] = useState(characterMessages[0])

  const totalWeeklyHours = dummyWeeklyData.reduce((sum, hours) => sum + hours, 0)

  // キャラクターメッセージをランダムに変更
  useEffect(() => {
    const messageInterval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * characterMessages.length)
      setCurrentMessage(characterMessages[randomIndex])
    }, 5000) // 5秒ごとに変更

    return () => clearInterval(messageInterval)
  }, [])

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
          boxSizing: 'border-box'
        }}>
          {/* ヘッダー */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '40px'
          }}>
            <div>
              <h1 style={{ 
                margin: 0, 
                color: 'white',
                fontSize: '2.5rem',
                fontWeight: '700',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                ✨ Study Dashboard
              </h1>
              <p style={{
                margin: '8px 0 0 0',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '1.1rem'
              }}>
                今週も頑張ろう！📚
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
                }}
                onClick={() => navigate('/study-settings')}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.3)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <StudyIcon />
                勉強開始
              </button>
              <button 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.9)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                }}
              >
                ⚙️ 設定
              </button>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gridTemplateRows: '1fr 1fr',
            gap: '24px',
            height: 'calc(100vh - 180px)'
          }}>
            {/* 学習記録 - 2列にまたがる */}
            <div style={{
              gridColumn: '1 / 3',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <StatsIcon />
                <h2 style={{ margin: 0, color: 'white', fontSize: '1.8rem', fontWeight: '600' }}>
                  📊 今週の学習記録
                </h2>
              </div>
              
              {/* 棒グラフ（コンパクト版） */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'end', 
                justifyContent: 'space-around',
                height: '160px',
                marginBottom: '20px',
                padding: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {dummyWeeklyData.map((hours, index) => (
                  <div key={index} style={{ textAlign: 'center', position: 'relative' }}>
                    <div 
                      style={{
                        width: '48px',
                        height: `${Math.max(hours * 20, 8)}px`,
                        background: `linear-gradient(135deg, 
                          hsl(${180 + index * 25}, 70%, 60%) 0%, 
                          hsl(${180 + index * 25}, 80%, 45%) 100%)`,
                        borderRadius: '8px 8px 4px 4px',
                        marginBottom: '12px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05) translateY(-4px)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1) translateY(0)'
                      }}
                    />
                    <div style={{ 
                      position: 'absolute',
                      top: '-30px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: 'rgba(0,0,0,0.6)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      opacity: hours > 0 ? 1 : 0
                    }}>
                      {hours}h
                    </div>
                    <div style={{ 
                      color: 'rgba(255,255,255,0.8)', 
                      fontSize: '14px',
                      fontWeight: '500' 
                    }}>
                      {['月', '火', '水', '木', '金', '土', '日'][index]}
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '20px 24px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}>
                <div>
                  <p style={{ fontSize: '1.4rem', margin: '0', color: 'white', fontWeight: '600' }}>
                    🔥 今週の合計: <span style={{ color: '#FFD700' }}>{totalWeeklyHours}時間</span>
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', margin: '4px 0 0 0', fontSize: '1rem' }}>
                    📈 平均: {(totalWeeklyHours / 7).toFixed(1)}時間/日
                  </p>
                </div>
                <div style={{
                  fontSize: '3rem',
                  filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.5))'
                }}>
                  {totalWeeklyHours >= 20 ? '🏆' : totalWeeklyHours >= 10 ? '⭐' : '📚'}
                </div>
              </div>
            </div>

            {/* 学習分野 - 右上 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              padding: '20px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <TargetIcon />
                  <h3 style={{ margin: 0, color: 'white', fontSize: '1.4rem', fontWeight: '600' }}>
                    📚 学習分野
                  </h3>
                </div>
                
                {/* 円グラフ（モダン版） */}
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: `conic-gradient(
                      #ff6b9d 0% ${dummyStudyContent.math}%,
                      #4ecdc4 ${dummyStudyContent.math}% ${dummyStudyContent.math + dummyStudyContent.english}%,
                      #45b7d1 ${dummyStudyContent.math + dummyStudyContent.english}% ${dummyStudyContent.math + dummyStudyContent.english + dummyStudyContent.science}%,
                      #96ceb4 ${dummyStudyContent.math + dummyStudyContent.english + dummyStudyContent.science}% 100%
                    )`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '60px',
                      height: '60px',
                      background: 'rgba(255,255,255,0.9)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem'
                    }}>
                      🎯
                    </div>
                  </div>
                </div>

                {/* 凡例 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { label: '📐 数学', color: '#ff6b9d', value: dummyStudyContent.math, emoji: '📊' },
                    { label: '🗣️ 英語', color: '#4ecdc4', value: dummyStudyContent.english, emoji: '💬' },
                    { label: '🔬 理科', color: '#45b7d1', value: dummyStudyContent.science, emoji: '⚗️' },
                    { label: '📚 その他', color: '#96ceb4', value: dummyStudyContent.other, emoji: '✨' }
                  ].map((item, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.3s ease',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                    }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: item.color,
                          boxShadow: `0 0 10px ${item.color}50`
                        }} />
                        <span style={{ color: 'white', fontWeight: '500' }}>{item.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', fontWeight: '600' }}>
                          {item.value}%
                        </span>
                        <span style={{ fontSize: '16px' }}>{item.emoji}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            {/* 今日の目標 - 左下 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              padding: '20px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ margin: '0 0 20px 0', color: 'white', fontSize: '1.4rem', fontWeight: '600' }}>
                  🎯 今日の目標
                </h3>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,193,7,0.1) 100%)',
                  padding: '20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255,215,0,0.3)',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⏰</div>
                  <p style={{ margin: '0 0 8px 0', color: 'white', fontSize: '1.1rem', fontWeight: '600' }}>
                    2時間勉強
                  </p>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>
                    あと少し！頑張って✨
                  </p>
                </div>
              </div>

            {/* 3Dキャラクター - 右下 */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              position: 'relative',
              overflow: 'hidden'
            }}>
                <h3 style={{ 
                  margin: '0 0 16px 0', 
                  color: 'white', 
                  fontSize: '1.2rem', 
                  fontWeight: '600',
                  textAlign: 'center'
                }}>
                  💬 一緒に頑張ろう！
                </h3>
                <div style={{
                  position: 'absolute',
                  top: '50px',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                }}>
                  <TalkAnimation />
                </div>
                
                {/* キャラクターセリフ吹き出し */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  borderRadius: '16px',
                  padding: '6px 10px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  maxWidth: '100px',
                  zIndex: 10
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: '0.8rem',
                    color: '#333',
                    textAlign: 'center',
                    fontWeight: '500',
                    transition: 'opacity 0.3s ease'
                  }}>
                    {currentMessage}
                  </p>
                  {/* 吹き出しの尻尾 */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-6px',
                    left: '20px',
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: '8px solid rgba(255, 255, 255, 0.9)'
                  }} />
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  )
}

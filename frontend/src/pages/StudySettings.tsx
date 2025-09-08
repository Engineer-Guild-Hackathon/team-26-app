import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
      padding: '20px',
      boxSizing: 'border-box',
      background: '#f8f9fa',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '40px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        width: '100%'
      }}>
        {/* ヘッダー */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '30px' 
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              marginRight: '15px',
              color: '#666'
            }}
          >
            ←
          </button>
          <h1 style={{ margin: 0, color: '#333' }}>Study with me の設定</h1>
        </div>

        {/* 設定フォーム */}
        <div style={{ space: '24px' }}>
          {/* 学習内容の設定 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              学習内容の設定
            </label>
            <input
              type="text"
              value={studyContent}
              onChange={(e) => setStudyContent(e.target.value)}
              placeholder="例: 数学の微分積分"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* 目標時間 */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '20px',
            marginBottom: '24px'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                目標時間
              </label>
              <input
                type="number"
                value={targetTime}
                onChange={(e) => setTargetTime(Number(e.target.value))}
                min="1"
                max="300"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '14px', color: '#666' }}>分</span>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                ポモドーロ設定
              </label>
              <input
                type="number"
                value={pomodoroTime}
                onChange={(e) => setPomodoroTime(Number(e.target.value))}
                min="10"
                max="60"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
              <span style={{ fontSize: '14px', color: '#666' }}>分</span>
            </div>
          </div>

          {/* 意気込み */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#333'
            }}>
              意気込み！
            </label>
            <textarea
              value={motivationalMessage}
              onChange={(e) => setMotivationalMessage(e.target.value)}
              placeholder="今日は頑張るぞ！"
              rows={3}
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e9ecef',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
            />
          </div>

          {/* 開始ボタン */}
          <button
            onClick={handleStart}
            style={{
              width: '100%',
              padding: '16px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
          >
            開始！
          </button>
        </div>
      </div>
    </div>
  )
}

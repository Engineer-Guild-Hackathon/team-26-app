import { useNavigate } from 'react-router-dom'

// ダミーデータ
const dummyWeeklyData = [2, 3, 1, 4, 2, 5, 6] // 1週間の学習時間（時間）
const dummyStudyContent = {
  math: 40,
  english: 30,
  science: 20,
  other: 10
}

export default function Home() {
  const navigate = useNavigate()

  const totalWeeklyHours = dummyWeeklyData.reduce((sum, hours) => sum + hours, 0)

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      padding: '20px', 
      boxSizing: 'border-box',
      background: '#f8f9fa'
    }}>
      {/* ヘッダー */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        padding: '0 20px'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>Study Dashboard</h1>
        <div style={{ display: 'flex', gap: '20px' }}>
          <button 
            style={{
              padding: '10px 20px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
            onClick={() => navigate('/study-settings')}
          >
            Study
          </button>
          <button 
            style={{
              padding: '10px 20px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Settings
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '30px',
        height: 'calc(100vh - 120px)'
      }}>
        {/* 左側: 1週間の学習時間 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, color: '#333' }}>1週間の学習時間</h2>
          
          {/* 棒グラフ（簡易版） */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'end', 
            justifyContent: 'space-around',
            height: '200px',
            marginBottom: '20px',
            borderBottom: '2px solid #eee'
          }}>
            {dummyWeeklyData.map((hours, index) => (
              <div key={index} style={{ textAlign: 'center' }}>
                <div 
                  style={{
                    width: '40px',
                    height: `${hours * 30}px`,
                    background: `hsl(${200 + index * 20}, 70%, 50%)`,
                    borderRadius: '4px 4px 0 0',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {['月', '火', '水', '木', '金', '土', '日'][index]}
                </div>
              </div>
            ))}
          </div>

          {/* 総計 */}
          <div style={{ 
            background: '#f8f9fa',
            padding: '16px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: 0, color: '#333' }}>総計: {totalWeeklyHours}時間</h3>
          </div>
        </div>

        {/* 右側: 学習内容 */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, color: '#333' }}>学習内容</h2>
          
          {/* 円グラフ（簡易版） */}
          <div style={{ 
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '30px'
          }}>
            <div style={{
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: `conic-gradient(
                #ff6b6b 0% ${dummyStudyContent.math}%,
                #4ecdc4 ${dummyStudyContent.math}% ${dummyStudyContent.math + dummyStudyContent.english}%,
                #45b7d1 ${dummyStudyContent.math + dummyStudyContent.english}% ${dummyStudyContent.math + dummyStudyContent.english + dummyStudyContent.science}%,
                #96ceb4 ${dummyStudyContent.math + dummyStudyContent.english + dummyStudyContent.science}% 100%
              )`
            }} />
          </div>

          {/* 凡例 */}
          <div style={{ space: '12px' }}>
            {[
              { label: '数学', color: '#ff6b6b', value: dummyStudyContent.math },
              { label: '英語', color: '#4ecdc4', value: dummyStudyContent.english },
              { label: '理科', color: '#45b7d1', value: dummyStudyContent.science },
              { label: 'その他', color: '#96ceb4', value: dummyStudyContent.other }
            ].map((item, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px' 
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: item.color,
                  marginRight: '12px'
                }} />
                <span style={{ color: '#333' }}>{item.label}: {item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import StudyAnimation from '../components/StudyAnimation'
import html2canvas from 'html2canvas'

export default function Study() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<any>(null)
  const [elapsedTime, setElapsedTime] = useState(0) // 経過時間（秒）
  const [nextBreakTime, setNextBreakTime] = useState(0) // 次の休憩までの時間
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // スクリーンショット撮影関数
  const captureWebcamPhoto = (): Promise<string> => {
    return new Promise((resolve) => {
      if (videoRef.current) {
        const video = videoRef.current
        
        // ビデオが準備できているかチェック
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          console.warn('Webカメラのビデオサイズが0です')
          resolve('data:,') // 空のデータURL
          return
        }
        
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          // 圧縮なし（最高画質）設定に変更
          const dataURL = canvas.toDataURL('image/jpeg', 0.95)
          console.log('Webカメラ撮影成功:', { width: canvas.width, height: canvas.height, dataLength: dataURL.length })
          resolve(dataURL)
        } else {
          console.error('Canvas context取得失敗')
          resolve('data:,')
        }
      } else {
        console.error('videoRef.currentがnullです')
        resolve('data:,')
      }
    })
  }

  // 保存されたディスプレイストリーム（初回のみ選択）
  const [savedDisplayStream, setSavedDisplayStream] = useState<MediaStream | null>(null)

  // ディスプレイストリームを取得（初回のみダイアログ表示）
  const getDisplayStream = async (): Promise<MediaStream> => {
    if (savedDisplayStream && savedDisplayStream.active) {
      console.log('保存済みのディスプレイストリームを使用')
      return savedDisplayStream
    }

    try {
      console.log('新しいディスプレイストリームを取得中...')
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen' as any,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false
      })

      setSavedDisplayStream(stream)
      
      // ストリームが終了した時のハンドラ
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('ディスプレイストリーム終了')
        setSavedDisplayStream(null)
      })

      return stream
    } catch (error) {
      console.error('ディスプレイストリーム取得エラー:', error)
      throw error
    }
  }

  const captureScreenshot = async (): Promise<string> => {
    console.log('スクリーンショット撮影開始')
    
    try {
      const stream = await getDisplayStream()
      return await captureFromDisplayStream(stream)
    } catch (error) {
      console.error('スクリーンショット撮影エラー:', error)
      // フォールバック: 学習情報画像
      return await createFallbackScreenshot()
    }
  }

  // ディスプレイストリームからスクリーンショットをキャプチャ
  const captureFromDisplayStream = async (stream: MediaStream): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      video.muted = true
      
      video.onloadedmetadata = () => {
        video.play()
        
        // 少し待ってからキャプチャ
        setTimeout(() => {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(video, 0, 0)
            // 圧縮なし（最高画質）設定に変更
            resolve(canvas.toDataURL('image/jpeg', 0.95))
          } else {
            reject(new Error('Canvas context not available'))
          }
        }, 100)
      }
      
      video.onerror = () => {
        reject(new Error('Video loading failed'))
      }
    })
  }

  // フォールバック用の学習情報スクリーンショット
  const createFallbackScreenshot = async (): Promise<string> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    canvas.width = 1200
    canvas.height = 800
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, 1200, 800)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px Arial'
    ctx.fillText('📚 Study Session', 50, 100)
    
    ctx.font = '18px Arial'
    ctx.fillStyle = '#4ecdc4'
    ctx.fillText('学習内容: ' + (settings?.studyContent || '未設定'), 50, 150)
    
    const timeStr = `${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, '0')}`
    ctx.fillText('経過時間: ' + timeStr, 50, 200)
    
    ctx.fillText('撮影時刻: ' + new Date().toLocaleString(), 50, 250)
    
    ctx.fillStyle = '#666666'
    ctx.font = '16px Arial'
    ctx.fillText('※ 画面キャプチャが利用できない場合のフォールバック画像', 50, 700)

    // 圧縮なし（最高画質）設定に変更
    return canvas.toDataURL('image/jpeg', 0.95)
  }


  const handleBreakTransition = async () => {
    console.log('休憩遷移時のスクリーンショット撮影中...')
    
    // Webカメラとスクリーンショットを並行して撮影
    const [webcamPhoto, screenPhoto] = await Promise.all([
      captureWebcamPhoto(),
      captureScreenshot()
    ])

    // 撮影した画像をローカルストレージに保存
    const capturedData = {
      webcamPhoto,
      screenPhoto,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem('capturedImages', JSON.stringify(capturedData))
    
    console.log('スクリーンショット撮影完了')
    navigate('/break')
  }

  // 設定を読み込み
  useEffect(() => {
    const savedSettings = localStorage.getItem('studySettings')
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings)
      setSettings(parsedSettings)
      
      // ポモドーロ±σ（標準偏差）でランダムな時間を計算
      const baseTime = parsedSettings.pomodoroTime * 60 // 秒に変換
      const sigma = baseTime * 0.2 // 20%の標準偏差
      const randomBreakTime = Math.max(
        baseTime + (Math.random() - 0.5) * 2 * sigma,
        baseTime * 0.5 // 最低でも50%の時間は確保
      )
      setNextBreakTime(Math.floor(randomBreakTime))
    } else {
      navigate('/study-settings')
    }
  }, [navigate])

  // Webカメラを開始
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        })
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (error) {
        console.error('カメラアクセスエラー:', error)
      }
    }

    startCamera()

    // クリーンアップ
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // タイマー
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1
        
        // 休憩時間になったらスクリーンショット撮影して休憩画面に遷移
        if (newTime >= nextBreakTime && nextBreakTime > 0) {
          handleBreakTransition()
          return newTime
        }
        
        // 目標時間に達したらホームに戻る
        if (settings && newTime >= settings.targetTime * 60) {
          navigate('/')
          return newTime
        }
        
        return newTime
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [nextBreakTime, settings, navigate])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleInterrupt = () => {
    navigate('/')
  }

  if (!settings) {
    return <div>Loading...</div>
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'grid',
      gridTemplateColumns: '300px 1fr',
      background: '#000'
    }}>
      {/* 左側: Webカメラ */}
      <div style={{
        background: '#1a1a1a',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <h3 style={{ color: 'white', marginTop: 0 }}>Webカメラ</h3>
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{
            width: '100%',
            maxWidth: '260px',
            borderRadius: '8px',
            border: '2px solid #333'
          }}
        />
        
        {/* 経過時間 */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#333',
          borderRadius: '8px',
          textAlign: 'center',
          width: '100%'
        }}>
          <div style={{ color: '#ccc', fontSize: '14px' }}>経過時間</div>
          <div style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>
            {formatTime(elapsedTime)}
          </div>
        </div>

        {/* 次の休憩まで */}
        <div style={{
          marginTop: '10px',
          padding: '15px',
          background: '#444',
          borderRadius: '8px',
          textAlign: 'center',
          width: '100%'
        }}>
          <div style={{ color: '#ccc', fontSize: '14px' }}>次の休憩まで</div>
          <div style={{ color: '#4ecdc4', fontSize: '18px', fontWeight: 'bold' }}>
            {formatTime(Math.max(0, nextBreakTime - elapsedTime))}
          </div>
        </div>

        {/* ボタンエリア */}
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* スクリーンキャプチャ状況表示 */}
          <div style={{
            padding: '10px',
            background: savedDisplayStream ? 'rgba(40, 167, 69, 0.2)' : 'rgba(255, 193, 7, 0.2)',
            borderRadius: '6px',
            border: `1px solid ${savedDisplayStream ? '#28a745' : '#ffc107'}`,
            fontSize: '12px',
            textAlign: 'center'
          }}>
            {savedDisplayStream ? '🟢 画面キャプチャ準備完了' : '🟡 初回のみ画面選択が必要'}
          </div>

          {/* 手動休憩ボタン */}
          <button
            onClick={handleBreakTransition}
            style={{
              padding: '12px 24px',
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              width: '100%'
            }}
          >
            📸 休憩（自動スクショ）
          </button>
          
          {/* 中断ボタン */}
          <button
            onClick={handleInterrupt}
            style={{
              padding: '12px 24px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              width: '100%'
            }}
          >
            中断
          </button>
        </div>
      </div>

      {/* 右側: StudyAnimation */}
      <div style={{ position: 'relative' }}>
        <StudyAnimation />
        
        {/* 学習内容表示 */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '15px',
          borderRadius: '8px',
          maxWidth: '300px'
        }}>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>学習中</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
            {settings.studyContent || '学習内容未設定'}
          </div>
          {settings.motivationalMessage && (
            <div style={{ fontSize: '14px', marginTop: '8px', fontStyle: 'italic' }}>
              "{settings.motivationalMessage}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

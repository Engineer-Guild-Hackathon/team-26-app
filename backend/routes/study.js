const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// 一時的なメモリストレージ（実際はFirebase/DBを使用）
const sessions = new Map();
const breaks = new Map();

// 学習セッション開始
router.post('/session/start', async (req, res) => {
  try {
    const { studyContent, targetTime, pomodoroTime, motivationalMessage, userId } = req.body;
    
    if (!studyContent || !targetTime || !pomodoroTime) {
      return res.status(400).json({
        error: true,
        message: "必須フィールドが不足しています",
        code: "MISSING_FIELDS",
        timestamp: new Date().toISOString()
      });
    }

    const sessionId = uuidv4();
    const startTime = new Date().toISOString();
    
    // ポモドーロ±σ（標準偏差）でランダムな時間を計算
    const baseTime = pomodoroTime * 60; // 秒に変換
    const sigma = baseTime * 0.2; // 20%の標準偏差
    const nextBreakTime = Math.max(
      baseTime + (Math.random() - 0.5) * 2 * sigma,
      baseTime * 0.5 // 最低でも50%の時間は確保
    );

    const session = {
      sessionId,
      userId,
      studyContent,
      targetTime,
      pomodoroTime,
      motivationalMessage,
      startTime,
      nextBreakTime: Math.floor(nextBreakTime),
      status: 'active',
      breaks: []
    };

    sessions.set(sessionId, session);

    res.json({
      sessionId,
      startTime,
      nextBreakTime: Math.floor(nextBreakTime),
      status: 'active'
    });

  } catch (error) {
    console.error('Session start error:', error);
    res.status(500).json({
      error: true,
      message: "セッション開始エラー",
      code: "SESSION_START_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// 休憩への遷移（スクリーンショット送信）
router.post('/session/break', async (req, res) => {
  try {
    const { sessionId, webcamImage, screenImage, elapsedTime, timestamp } = req.body;
    
    if (!sessionId || !webcamImage || !screenImage) {
      return res.status(400).json({
        error: true,
        message: "必須フィールドが不足しています",
        code: "MISSING_FIELDS",
        timestamp: new Date().toISOString()
      });
    }

    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: true,
        message: "セッションが見つかりません",
        code: "SESSION_NOT_FOUND",
        timestamp: new Date().toISOString()
      });
    }

    const breakId = uuidv4();
    const breakData = {
      breakId,
      sessionId,
      webcamImage,
      screenImage,
      elapsedTime,
      timestamp: timestamp || new Date().toISOString(),
      status: 'active'
    };

    breaks.set(breakId, breakData);
    session.breaks.push(breakId);
    sessions.set(sessionId, session);

    // 休憩時間の計算（目標時間の1/5）
    const breakDuration = Math.floor(session.targetTime / 5 * 60); // 秒に変換

    res.json({
      breakId,
      aiConnectionUrl: `ws://localhost:${process.env.PORT || 3001}/ai/realtime/${breakId}`,
      breakDuration,
      imagesStored: true
    });

  } catch (error) {
    console.error('Break transition error:', error);
    res.status(500).json({
      error: true,
      message: "休憩遷移エラー",
      code: "BREAK_TRANSITION_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// 学習セッション再開
router.post('/session/resume', async (req, res) => {
  try {
    const { sessionId, breakId } = req.body;
    
    const session = sessions.get(sessionId);
    const breakData = breaks.get(breakId);

    if (!session || !breakData) {
      return res.status(404).json({
        error: true,
        message: "セッションまたは休憩が見つかりません",
        code: "NOT_FOUND",
        timestamp: new Date().toISOString()
      });
    }

    // 休憩終了
    breakData.status = 'completed';
    breakData.endTime = new Date().toISOString();
    breaks.set(breakId, breakData);

    // 新しい休憩時間を計算
    const baseTime = session.pomodoroTime * 60;
    const sigma = baseTime * 0.2;
    const nextBreakTime = Math.max(
      baseTime + (Math.random() - 0.5) * 2 * sigma,
      baseTime * 0.5
    );

    session.nextBreakTime = Math.floor(nextBreakTime);
    sessions.set(sessionId, session);

    res.json({
      sessionId,
      nextBreakTime: Math.floor(nextBreakTime),
      resumeTime: new Date().toISOString(),
      status: 'active'
    });

  } catch (error) {
    console.error('Session resume error:', error);
    res.status(500).json({
      error: true,
      message: "セッション再開エラー",
      code: "SESSION_RESUME_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// 学習セッション終了
router.post('/session/end', async (req, res) => {
  try {
    const { sessionId, totalStudyTime, breaks: breakIds } = req.body;
    
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({
        error: true,
        message: "セッションが見つかりません",
        code: "SESSION_NOT_FOUND",
        timestamp: new Date().toISOString()
      });
    }

    session.status = 'completed';
    session.endTime = new Date().toISOString();
    session.totalStudyTime = totalStudyTime;
    sessions.set(sessionId, session);

    // 関連する休憩も終了
    if (breakIds) {
      breakIds.forEach(breakId => {
        const breakData = breaks.get(breakId);
        if (breakData) {
          breakData.status = 'completed';
          breaks.set(breakId, breakData);
        }
      });
    }

    res.json({
      sessionId,
      status: 'completed',
      endTime: session.endTime,
      summary: {
        studyContent: session.studyContent,
        totalTime: totalStudyTime,
        breaksCount: session.breaks.length,
        efficiency: totalStudyTime / (session.targetTime * 60) * 100
      }
    });

  } catch (error) {
    console.error('Session end error:', error);
    res.status(500).json({
      error: true,
      message: "セッション終了エラー",
      code: "SESSION_END_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// セッション取得
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: true,
        message: "セッションが見つかりません",
        code: "SESSION_NOT_FOUND",
        timestamp: new Date().toISOString()
      });
    }

    res.json(session);
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      error: true,
      message: "セッション取得エラー",
      code: "GET_SESSION_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// 休憩データ取得
router.get('/break/:breakId', async (req, res) => {
  try {
    const { breakId } = req.params;
    const breakData = breaks.get(breakId);
    
    if (!breakData) {
      return res.status(404).json({
        error: true,
        message: "休憩データが見つかりません",
        code: "BREAK_NOT_FOUND",
        timestamp: new Date().toISOString()
      });
    }

    // 画像データを除いて返す（必要に応じて画像URLを返すことも可能）
    const { webcamImage, screenImage, ...breakInfo } = breakData;
    res.json({
      ...breakInfo,
      hasImages: !!(webcamImage && screenImage)
    });

  } catch (error) {
    console.error('Get break error:', error);
    res.status(500).json({
      error: true,
      message: "休憩データ取得エラー",
      code: "GET_BREAK_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;

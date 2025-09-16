const express = require('express');
const router = express.Router();

// 一時的なメモリストレージ（実際はFirebase/DBを使用）
const users = new Map();
const studyStats = new Map();

// 学習統計取得
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'week' } = req.query; // week, month, year
    
    // ユーザーの統計データを取得
    let stats = studyStats.get(userId);
    
    if (!stats) {
      // デフォルトの統計データを生成
      stats = generateDefaultStats(userId);
      studyStats.set(userId, stats);
    }

    // 期間に応じたデータを返す
    const response = {
      period,
      weeklyData: stats.weeklyData,
      studyContent: stats.studyContent,
      totalHours: stats.totalHours,
      sessionsCount: stats.sessionsCount,
      averageSessionTime: stats.totalHours > 0 ? Math.round(stats.totalHours * 60 / stats.sessionsCount) : 0,
      streak: stats.streak || 0,
      lastUpdated: stats.lastUpdated || new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: true,
      message: "統計取得エラー",
      code: "GET_STATS_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// 学習セッション履歴取得
router.get('/:userId/sessions', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    // 実際の実装では、データベースから取得
    const userSessions = generateSessionHistory(userId, parseInt(limit), parseInt(offset));
    
    res.json({
      sessions: userSessions,
      total: userSessions.length,
      hasMore: userSessions.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: true,
      message: "セッション履歴取得エラー",
      code: "GET_SESSIONS_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// 学習統計更新
router.post('/:userId/stats/update', async (req, res) => {
  try {
    const { userId } = req.params;
    const { sessionData } = req.body;
    
    if (!sessionData) {
      return res.status(400).json({
        error: true,
        message: "セッションデータが必要です",
        code: "MISSING_SESSION_DATA",
        timestamp: new Date().toISOString()
      });
    }

    let stats = studyStats.get(userId) || generateDefaultStats(userId);
    
    // 統計を更新
    stats = updateUserStats(stats, sessionData);
    studyStats.set(userId, stats);
    
    res.json({
      updated: true,
      stats: {
        totalHours: stats.totalHours,
        sessionsCount: stats.sessionsCount,
        streak: stats.streak
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({
      error: true,
      message: "統計更新エラー",
      code: "UPDATE_STATS_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// ユーザー設定取得
router.get('/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    
    let user = users.get(userId);
    if (!user) {
      user = {
        userId,
        preferences: {
          defaultPomodoroTime: 25,
          defaultBreakTime: 5,
          notifications: true,
          theme: 'light',
          language: 'ja'
        },
        createdAt: new Date().toISOString()
      };
      users.set(userId, user);
    }
    
    res.json(user.preferences);

  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      error: true,
      message: "設定取得エラー",
      code: "GET_PREFERENCES_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// ユーザー設定更新
router.put('/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferences } = req.body;
    
    if (!preferences) {
      return res.status(400).json({
        error: true,
        message: "設定データが必要です",
        code: "MISSING_PREFERENCES",
        timestamp: new Date().toISOString()
      });
    }

    let user = users.get(userId) || {
      userId,
      preferences: {},
      createdAt: new Date().toISOString()
    };
    
    user.preferences = { ...user.preferences, ...preferences };
    user.updatedAt = new Date().toISOString();
    users.set(userId, user);
    
    res.json({
      updated: true,
      preferences: user.preferences,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      error: true,
      message: "設定更新エラー",
      code: "UPDATE_PREFERENCES_ERROR",
      timestamp: new Date().toISOString()
    });
  }
});

// デフォルト統計データ生成
function generateDefaultStats(userId) {
  return {
    userId,
    weeklyData: [2, 3, 1, 4, 2, 5, 6], // 過去7日間の学習時間（時間）
    studyContent: {
      math: 40,
      english: 30,
      science: 20,
      other: 10
    },
    totalHours: 23,
    sessionsCount: 15,
    streak: 3,
    lastUpdated: new Date().toISOString()
  };
}

// セッション履歴生成（ダミーデータ）
function generateSessionHistory(userId, limit, offset) {
  const sessions = [];
  const now = new Date();
  
  for (let i = offset; i < offset + limit; i++) {
    const sessionDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    sessions.push({
      sessionId: `session_${userId}_${i}`,
      studyContent: ['数学', '英語', '理科', '国語'][i % 4],
      duration: Math.floor(Math.random() * 120) + 30, // 30-150分
      breaksCount: Math.floor(Math.random() * 5) + 1,
      efficiency: Math.floor(Math.random() * 40) + 60, // 60-100%
      date: sessionDate.toISOString(),
      completed: true
    });
  }
  
  return sessions;
}

// 統計更新ロジック
function updateUserStats(stats, sessionData) {
  const sessionHours = sessionData.totalStudyTime / 3600; // 秒から時間に変換
  
  // 総学習時間を更新
  stats.totalHours += sessionHours;
  stats.sessionsCount += 1;
  
  // 今日の学習時間を週間データに追加
  const today = new Date().getDay(); // 0=日曜日, 6=土曜日
  stats.weeklyData[today] += sessionHours;
  
  // 学習内容の分布を更新（簡単な例）
  const content = sessionData.studyContent.toLowerCase();
  if (content.includes('数学') || content.includes('math')) {
    stats.studyContent.math += sessionHours;
  } else if (content.includes('英語') || content.includes('english')) {
    stats.studyContent.english += sessionHours;
  } else if (content.includes('理科') || content.includes('science')) {
    stats.studyContent.science += sessionHours;
  } else {
    stats.studyContent.other += sessionHours;
  }
  
  // 連続学習日数の計算（簡単な例）
  const lastSession = new Date(stats.lastUpdated || new Date());
  const currentDate = new Date();
  const daysDiff = Math.floor((currentDate - lastSession) / (24 * 60 * 60 * 1000));
  
  if (daysDiff === 0) {
    // 今日既に学習済み - 連続記録維持
  } else if (daysDiff === 1) {
    // 昨日の続き - 連続記録更新
    stats.streak += 1;
  } else {
    // 期間が空いた - 連続記録リセット
    stats.streak = 1;
  }
  
  stats.lastUpdated = new Date().toISOString();
  return stats;
}

module.exports = router;

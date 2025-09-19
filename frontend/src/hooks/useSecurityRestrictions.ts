import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * セキュリティ制限フック
 * Break.tsx以外ではWebRTCを無効化
 * Study.tsx、Break.tsx以外ではWebカメラを無効化
 */
export const useSecurityRestrictions = () => {
  const location = useLocation();
  
  useEffect(() => {
    const currentPath = location.pathname;
    
    // WebRTC制限: Break.tsx以外では使用禁止
    if (currentPath !== '/break') {
      // 既存のWebRTC接続があれば切断
      const existingConnections = (window as any).webrtcConnections || [];
      existingConnections.forEach((connection: RTCPeerConnection) => {
        try {
          connection.close();
          console.log('🔒 セキュリティ制限: WebRTC接続を切断しました');
        } catch (error) {
          console.warn('WebRTC切断エラー:', error);
        }
      });
      (window as any).webrtcConnections = [];
    }
    
    // Webカメラ制限: Study.tsx、Break.tsx以外では使用禁止
    if (currentPath !== '/study' && currentPath !== '/break') {
      navigator.mediaDevices.getUserMedia?.({ video: true, audio: true })
        .then(stream => {
          // 既存のストリームを停止
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('🔒 セキュリティ制限: Webカメラを停止しました');
          });
        })
        .catch(() => {
          // エラーは無視（カメラが既に停止している場合など）
        });
      
      // 既存のvideo要素のストリームを停止
      const videoElements = document.querySelectorAll('video');
      videoElements.forEach(video => {
        if (video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach(track => {
            track.stop();
            console.log('🔒 セキュリティ制限: video要素のストリームを停止しました');
          });
          video.srcObject = null;
        }
      });
    }
  }, [location.pathname]);
  
  // WebRTCが許可されているかチェック
  const isWebRTCAllowed = location.pathname === '/break';
  
  // Webカメラが許可されているかチェック
  const isWebcamAllowed = location.pathname === '/study' || location.pathname === '/break';
  
  return {
    isWebRTCAllowed,
    isWebcamAllowed,
    currentPath: location.pathname
  };
};

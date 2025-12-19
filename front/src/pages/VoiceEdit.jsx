import { useState } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

// 声音剪辑页面 - 嵌入外部 Gradio 应用
const VoiceEdit = () => {
  const [loading, setLoading] = useState(true);

  // 声音剪辑服务地址
  const VOICE_EDIT_URL = 'http://218.244.151.132:7860/';

  return (
    <div className="page-card" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-card-header">
        <span className="page-card-title">声音剪辑</span>
      </div>

      <div style={{ 
        flex: 1, 
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#f5f5f5',
        minHeight: 500
      }}>
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            textAlign: 'center'
          }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} />
            <div style={{ marginTop: 16, color: '#666' }}>正在加载声音剪辑工具...</div>
          </div>
        )}
        
        <iframe
          src={VOICE_EDIT_URL}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: loading ? 'none' : 'block'
          }}
          onLoad={() => setLoading(false)}
          title="声音剪辑"
          allow="microphone; clipboard-write"
        />
      </div>
    </div>
  );
};

export default VoiceEdit;


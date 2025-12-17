import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  PlayCircleOutlined, PauseCircleOutlined, SoundOutlined, 
  MutedOutlined, FullscreenOutlined, FullscreenExitOutlined,
  DownloadOutlined, MoreOutlined, ExpandOutlined
} from '@ant-design/icons';
import { Slider, Dropdown, Tooltip, message } from 'antd';

/**
 * 自定义中文视频播放器组件
 * 解决原生 HTML5 video 控件菜单显示英文的问题
 * 完全禁用浏览器原生控件，使用自定义中文UI
 * 
 * @param {boolean} compact - 紧凑模式，适用于小卡片，简化控制栏
 */
const VideoPlayer = ({ src, style, maxHeight = 150, compact = false }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPiP, setIsPiP] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const hideControlsTimer = useRef(null);
  
  // 判断是否为紧凑模式（容器宽度小于200px或明确指定compact）
  const isCompact = compact || (containerWidth > 0 && containerWidth < 200);

  // 检测容器宽度
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const updateWidth = () => {
      setContainerWidth(container.offsetWidth);
    };
    
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(container);
    
    return () => resizeObserver.disconnect();
  }, []);

  // 自动隐藏控制栏
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    setShowControls(true);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handlePiPChange = () => {
      setIsPiP(document.pictureInPictureElement === video);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    video.addEventListener('enterpictureinpicture', handlePiPChange);
    video.addEventListener('leavepictureinpicture', handlePiPChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      video.removeEventListener('enterpictureinpicture', handlePiPChange);
      video.removeEventListener('leavepictureinpicture', handlePiPChange);
      if (hideControlsTimer.current) {
        clearTimeout(hideControlsTimer.current);
      }
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!document.fullscreenElement) {
      container.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleSeek = (value) => {
    const video = videoRef.current;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const handleVolumeChange = (value) => {
    const video = videoRef.current;
    video.volume = value;
    setVolume(value);
    setIsMuted(value === 0);
  };

  const handlePlaybackRateChange = (rate) => {
    const video = videoRef.current;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = src.split('/').pop() || 'video';
    link.click();
    message.success('开始下载视频');
  };

  // 画中画功能
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      } else {
        message.warning('您的浏览器不支持画中画功能');
      }
    } catch (error) {
      console.error('画中画切换失败:', error);
      message.error('画中画功能不可用');
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playbackRateItems = [
    { key: '0.5', label: '0.5x 倍速' },
    { key: '0.75', label: '0.75x 倍速' },
    { key: '1', label: '1x 正常' },
    { key: '1.25', label: '1.25x 倍速' },
    { key: '1.5', label: '1.5x 倍速' },
    { key: '2', label: '2x 倍速' },
  ];

  const moreMenuItems = [
    {
      key: 'fullscreen',
      label: isFullscreen ? '退出全屏' : '全屏播放',
      icon: <FullscreenOutlined />,
      onClick: toggleFullscreen
    },
    {
      key: 'download',
      label: '下载视频',
      icon: <DownloadOutlined />,
      onClick: handleDownload
    },
    {
      key: 'mute',
      label: isMuted ? '取消静音' : '静音',
      icon: isMuted ? <MutedOutlined /> : <SoundOutlined />,
      onClick: toggleMute
    },
    {
      key: 'rate',
      label: `播放速度 (${playbackRate}x)`,
      children: playbackRateItems.map(item => ({
        key: item.key,
        label: item.label,
        onClick: () => handlePlaybackRateChange(parseFloat(item.key))
      }))
    },
    {
      key: 'pip',
      label: isPiP ? '退出画中画' : '画中画',
      icon: <ExpandOutlined />,
      onClick: togglePiP
    }
  ];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
        maxHeight: isFullscreen ? '100vh' : maxHeight,
        height: isFullscreen ? '100vh' : maxHeight,
        WebkitTouchCallout: 'none', // 禁用iOS长按菜单
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onMouseEnter={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onTouchMove={resetHideTimer}
    >
      <video
        ref={videoRef}
        src={src}
        style={{ 
          maxWidth: '100%', 
          maxHeight: isFullscreen ? '100vh' : maxHeight,
          objectFit: 'contain',
          WebkitTouchCallout: 'none', // 禁用iOS长按菜单
          pointerEvents: 'none', // 禁止视频元素直接接收事件，防止原生菜单
        }}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        x5-video-player-type="h5"
        x5-video-player-fullscreen="false"
        controls={false} // 显式禁用原生控件
        controlsList="nodownload nofullscreen noremoteplayback" // 禁用原生控件菜单项
        disablePictureInPicture={false}
        // 禁用原生右键菜单
        onContextMenu={(e) => e.preventDefault()}
      />
      
      {/* 透明点击层，用于处理点击事件，防止原生视频菜单 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: isCompact ? 24 : 40, // 紧凑模式控制栏更小
          cursor: 'pointer',
        }}
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* 播放/暂停覆盖层 */}
      {!isPlaying && (
        <div
          style={{
            position: 'absolute',
            top: '45%', // 稍微上移，避免被控制栏遮挡
            left: '50%',
            transform: 'translate(-50%, -50%)',
            cursor: 'pointer',
            color: '#fff',
            fontSize: isCompact ? 32 : 48, // 紧凑模式下图标更小
            opacity: 0.9,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            zIndex: 10,
            pointerEvents: 'none', // 让点击穿透到下面的透明层
          }}
        >
          <PlayCircleOutlined />
        </div>
      )}

      {/* 控制栏 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
          padding: isCompact ? '12px 4px 4px' : '20px 8px 8px',
          opacity: showControls || !isPlaying ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      >
        {/* 进度条 - 紧凑模式下隐藏 */}
        {!isCompact && (
          <Slider
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            tooltip={{ formatter: formatTime }}
            style={{ margin: '0 4px 4px' }}
            styles={{
              track: { background: '#1677ff' },
              rail: { background: 'rgba(255,255,255,0.3)' }
            }}
          />
        )}

        {/* 控制按钮 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          color: '#fff',
          fontSize: isCompact ? 14 : 16,
          padding: isCompact ? '0 2px' : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? 4 : 8 }}>
            {/* 播放/暂停 */}
            <span onClick={togglePlay} style={{ cursor: 'pointer' }}>
              {isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            </span>

            {/* 时间显示 */}
            <span style={{ fontSize: isCompact ? 10 : 12, whiteSpace: 'nowrap' }}>
              {formatTime(currentTime)}{!isCompact && ` / ${formatTime(duration)}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isCompact ? 6 : 12 }}>
            {/* 音量 - 紧凑模式下隐藏 */}
            {!isCompact && (
              <Tooltip title={isMuted ? '取消静音' : '静音'}>
                <span onClick={toggleMute} style={{ cursor: 'pointer' }}>
                  {isMuted ? <MutedOutlined /> : <SoundOutlined />}
                </span>
              </Tooltip>
            )}

            {/* 更多选项 */}
            <Dropdown 
              menu={{ items: moreMenuItems }} 
              trigger={['click']}
              placement="topRight"
            >
              <span style={{ cursor: 'pointer', fontSize: isCompact ? 16 : 18, fontWeight: 'bold' }}>⋮</span>
            </Dropdown>

            {/* 全屏 - 紧凑模式下隐藏（通过菜单访问） */}
            {!isCompact && (
              <Tooltip title={isFullscreen ? '退出全屏' : '全屏'}>
                <span onClick={toggleFullscreen} style={{ cursor: 'pointer' }}>
                  {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;

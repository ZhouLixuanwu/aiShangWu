import { useState, useEffect, useRef } from 'react';
import { 
  Card, Upload, Button, message, Progress, List, Tag, 
  Image, Space, DatePicker, Statistic, Row, Col, Popconfirm, Empty,
  Modal
} from 'antd';
import { 
  UploadOutlined, PictureOutlined, VideoCameraOutlined, 
  DeleteOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CameraOutlined, FolderOpenOutlined, LoadingOutlined,
  CloudUploadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import VideoPlayer from '../components/VideoPlayer';

// 获取API基础URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const MediaUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [stats, setStats] = useState({ todayCount: 0, dailyTarget: 2, completed: false });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [isMobile, setIsMobile] = useState(false);
  
  // 上传进度状态
  const [uploadProgress, setUploadProgress] = useState({
    visible: false,
    percent: 0,
    fileName: '',
    fileSize: 0,
    uploadedSize: 0,
    speed: 0,
    status: 'uploading', // 'uploading' | 'success' | 'error'
    errorMsg: ''
  });
  const uploadStartTime = useRef(0);
  const abortController = useRef(null);

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化速度
  const formatSpeed = (bytesPerSecond) => {
    if (bytesPerSecond === 0) return '0 KB/s';
    if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + ' B/s';
    if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(1) + ' KB/s';
    return (bytesPerSecond / (1024 * 1024)).toFixed(2) + ' MB/s';
  };

  // 获取token的辅助函数
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // 检测是否为移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [selectedDate, pagination.current]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/media/my`, {
        params: {
          date: selectedDate.format('YYYY-MM-DD'),
          page: pagination.current,
          pageSize: pagination.pageSize
        },
        headers: getAuthHeaders()
      });
      const data = res.data;
      setRecords(data.data?.list || []);
      setStats(data.data?.stats || { todayCount: 0, dailyTarget: 5, completed: false });
      setPagination(prev => ({ ...prev, total: data.data?.pagination?.total || 0 }));
    } catch (error) {
      console.error('获取记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (options) => {
    const { file, onSuccess, onError, onProgress } = options;

    // 检查文件类型
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      message.error('只支持图片和视频文件');
      onError(new Error('不支持的文件类型'));
      return;
    }

    // 检查文件大小 (500MB)
    if (file.size > 500 * 1024 * 1024) {
      message.error('文件大小不能超过500MB');
      onError(new Error('文件太大'));
      return;
    }

    // 初始化上传进度弹窗
    setUploadProgress({
      visible: true,
      percent: 0,
      fileName: file.name,
      fileSize: file.size,
      uploadedSize: 0,
      speed: 0,
      status: 'uploading',
      errorMsg: ''
    });
    uploadStartTime.current = Date.now();
    setUploading(true);

    // 创建取消控制器
    abortController.current = new AbortController();

    try {
      // 创建FormData，使用 encodeURIComponent 处理中文文件名
      const formData = new FormData();
      
      // 创建一个新的文件对象，使用编码后的文件名
      // 同时在 FormData 中添加原始文件名（用于后端保存）
      formData.append('file', file, file.name);
      formData.append('originalName', file.name); // 单独传递原始文件名

      // 上传文件 - 使用专门的长超时配置
      const res = await axios.post(`${API_BASE_URL}/media/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeaders()
        },
        timeout: 30 * 60 * 1000, // 30分钟超时，适合大文件
        signal: abortController.current.signal,
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          const elapsedTime = (Date.now() - uploadStartTime.current) / 1000; // 秒
          const speed = elapsedTime > 0 ? progressEvent.loaded / elapsedTime : 0;
          
          setUploadProgress(prev => ({
            ...prev,
            percent,
            uploadedSize: progressEvent.loaded,
            speed
          }));
          onProgress({ percent });
        }
      });

      // 上传成功
      setUploadProgress(prev => ({
        ...prev,
        percent: 100,
        status: 'success'
      }));
      
      message.success('上传成功');
      onSuccess(res.data);
      
      // 2秒后关闭弹窗
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, visible: false }));
      }, 2000);
      
      // 刷新列表
      if (selectedDate.isSame(dayjs(), 'day')) {
        fetchRecords();
      }

    } catch (error) {
      console.error('上传失败:', error);
      
      let errorMsg = '上传失败';
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMsg = '上传超时，请检查网络后重试';
      } else if (error.name === 'CanceledError' || error.message === 'canceled') {
        errorMsg = '上传已取消';
      } else if (error.response?.status === 413) {
        errorMsg = '文件太大，服务器拒绝接收';
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }
      
      setUploadProgress(prev => ({
        ...prev,
        status: 'error',
        errorMsg
      }));
      
      message.error(errorMsg);
      onError(error);
    } finally {
      setUploading(false);
    }
  };

  // 取消上传
  const handleCancelUpload = () => {
    if (abortController.current) {
      abortController.current.abort();
    }
    setUploadProgress(prev => ({ ...prev, visible: false }));
    setUploading(false);
  };

  // 关闭上传弹窗
  const handleCloseUploadModal = () => {
    setUploadProgress(prev => ({ ...prev, visible: false }));
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/media/${id}`, {
        headers: getAuthHeaders()
      });
      message.success('删除成功');
      fetchRecords();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const isToday = selectedDate.isSame(dayjs(), 'day');
  const progressPercent = Math.min(100, Math.round((stats.todayCount / stats.dailyTarget) * 100));

  // 移动端样式
  const mobileStyles = {
    uploadCard: {
      marginBottom: 16
    },
    uploadButtonContainer: {
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: 12,
      width: '100%',
      marginTop: isMobile ? 16 : 0
    },
    uploadButton: {
      width: isMobile ? '100%' : 'auto',
      minWidth: isMobile ? 'auto' : 120,
      height: isMobile ? 50 : 40,
      fontSize: isMobile ? 15 : 14,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      // 增大触控区域
      touchAction: 'manipulation',
    },
    statsRow: {
      display: isMobile ? 'block' : 'flex',
      gap: 16
    },
    // 移动端卡片内边距
    cardBody: {
      padding: isMobile ? '12px' : '24px'
    }
  };

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">素材上传</span>
      </div>

      {/* 今日任务进度 */}
      <Card style={mobileStyles.uploadCard}>
        <Row gutter={[16, 16]} align="middle">
          {/* 统计信息 - 移动端占满宽度 */}
          <Col xs={24} sm={8}>
            <Statistic 
              title="今日已上传" 
              value={stats.todayCount} 
              suffix={`/ ${stats.dailyTarget}`}
              valueStyle={{ color: stats.completed ? '#52c41a' : '#1677ff' }}
            />
          </Col>
          
          {/* 进度条 - 移动端占满宽度 */}
          <Col xs={24} sm={10}>
            <div style={{ marginBottom: 8 }}>
              {stats.completed ? (
                <Tag icon={<CheckCircleOutlined />} color="success">今日任务已完成</Tag>
              ) : (
                <Tag icon={<ClockCircleOutlined />} color="processing">
                  还需上传 {stats.dailyTarget - stats.todayCount} 个
                </Tag>
              )}
            </div>
            <Progress 
              percent={progressPercent} 
              status={stats.completed ? 'success' : 'active'}
              strokeColor={stats.completed ? '#52c41a' : '#1677ff'}
            />
          </Col>
          
          {/* 上传按钮 - 移动端占满宽度，提供更好的触控体验 */}
          <Col xs={24} sm={6}>
            <div style={mobileStyles.uploadButtonContainer}>
              {/* 主上传按钮 - 从相册选择（适用于手机和电脑） */}
              <Upload
                customRequest={handleUpload}
                showUploadList={false}
                accept="image/*,video/*"
                multiple
              >
                <Button 
                  type="primary" 
                  icon={<FolderOpenOutlined />} 
                  loading={uploading}
                  size={isMobile ? 'large' : 'middle'}
                  style={mobileStyles.uploadButton}
                  block={isMobile}
                >
                  {isMobile ? '从相册选择' : '选择文件'}
                </Button>
              </Upload>

              {/* 移动端显示拍照/录像按钮 */}
              {isMobile && (
                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  {/* 拍照上传 */}
                  <Upload
                    customRequest={handleUpload}
                    showUploadList={false}
                    accept="image/*"
                    capture="environment"
                    style={{ flex: 1 }}
                  >
                    <Button 
                      icon={<CameraOutlined />} 
                      loading={uploading}
                      size="large"
                      style={{ ...mobileStyles.uploadButton, flex: 1 }}
                      block
                    >
                      拍照
                    </Button>
                  </Upload>

                  {/* 录像上传 */}
                  <Upload
                    customRequest={handleUpload}
                    showUploadList={false}
                    accept="video/*"
                    capture="environment"
                    style={{ flex: 1 }}
                  >
                    <Button 
                      icon={<VideoCameraOutlined />} 
                      loading={uploading}
                      size="large"
                      style={{ ...mobileStyles.uploadButton, flex: 1 }}
                      block
                    >
                      录像
                    </Button>
                  </Upload>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* 日期选择和记录列表 */}
      <Card 
        title="上传记录"
        extra={
          <DatePicker 
            value={selectedDate} 
            onChange={setSelectedDate}
            allowClear={false}
            disabledDate={(current) => current && current > dayjs().endOf('day')}
            style={{ width: isMobile ? 120 : 'auto' }}
            inputReadOnly={isMobile} // 移动端禁止键盘输入，只能选择
          />
        }
        styles={{
          body: {
            padding: isMobile ? '12px 8px' : '24px'
          }
        }}
      >
        {records.length === 0 ? (
          <Empty description={isToday ? "今天还没有上传素材" : "该日期没有上传记录"} />
        ) : (
          <List
            grid={{ 
              gutter: 16, 
              xs: 2,  // 移动端一行2个，方便触控
              sm: 2, 
              md: 3, 
              lg: 4, 
              xl: 4, 
              xxl: 6 
            }}
            dataSource={records}
            loading={loading}
            pagination={{
              ...pagination,
              onChange: (page) => setPagination(prev => ({ ...prev, current: page })),
              showTotal: isMobile ? undefined : (total) => `共 ${total} 条`,
              size: isMobile ? 'small' : 'default',
              simple: isMobile
            }}
            renderItem={(item) => (
              <List.Item>
                <Card
                  size="small"
                  cover={
                    item.file_type === 'video' ? (
                      <VideoPlayer 
                        src={item.url} 
                        maxHeight={isMobile ? 120 : 150}
                        style={{ background: '#f5f5f5' }}
                        compact // 卡片中使用紧凑模式
                      />
                    ) : (
                      <Image
                        src={item.url}
                        alt={item.file_name}
                        style={{ height: isMobile ? 120 : 150, objectFit: 'cover' }}
                        placeholder
                      />
                    )
                  }
                  actions={[
                    <Popconfirm
                      key="delete"
                      title="确定删除此素材？"
                      onConfirm={() => handleDelete(item.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <DeleteOutlined style={{ color: '#ff4d4f' }} />
                    </Popconfirm>
                  ]}
                >
                  <Card.Meta
                    avatar={item.file_type === 'video' ? 
                      <VideoCameraOutlined style={{ fontSize: isMobile ? 16 : 20, color: '#1677ff' }} /> : 
                      <PictureOutlined style={{ fontSize: isMobile ? 16 : 20, color: '#52c41a' }} />
                    }
                    title={
                      <span style={{ fontSize: isMobile ? 11 : 12 }}>
                        {item.file_name.length > (isMobile ? 10 : 15)
                          ? item.file_name.substring(0, isMobile ? 10 : 15) + '...' 
                          : item.file_name
                        }
                      </span>
                    }
                    description={
                      <span style={{ fontSize: isMobile ? 10 : 11, color: '#999' }}>
                        {dayjs(item.created_at).format('HH:mm:ss')}
                      </span>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 上传进度弹窗 */}
      <Modal
        title={null}
        open={uploadProgress.visible}
        footer={null}
        closable={false}
        maskClosable={false}
        centered
        width={isMobile ? '90%' : 400}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {uploadProgress.status === 'uploading' && (
            <>
              <CloudUploadOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
              <h3 style={{ marginBottom: 8 }}>正在上传...</h3>
              <p style={{ 
                color: '#666', 
                marginBottom: 16, 
                fontSize: 13,
                wordBreak: 'break-all',
                maxWidth: '100%'
              }}>
                {uploadProgress.fileName}
              </p>
              
              <Progress 
                percent={uploadProgress.percent} 
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginTop: 12,
                color: '#999',
                fontSize: 12
              }}>
                <span>
                  {formatFileSize(uploadProgress.uploadedSize)} / {formatFileSize(uploadProgress.fileSize)}
                </span>
                <span>{formatSpeed(uploadProgress.speed)}</span>
              </div>
              
              <Button 
                type="default" 
                onClick={handleCancelUpload}
                style={{ marginTop: 20 }}
              >
                取消上传
              </Button>
            </>
          )}
          
          {uploadProgress.status === 'success' && (
            <>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
              <h3 style={{ color: '#52c41a' }}>上传成功！</h3>
              <p style={{ color: '#666', fontSize: 13 }}>{uploadProgress.fileName}</p>
            </>
          )}
          
          {uploadProgress.status === 'error' && (
            <>
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: '50%', 
                background: '#ff4d4f', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ color: '#fff', fontSize: 24 }}>!</span>
              </div>
              <h3 style={{ color: '#ff4d4f' }}>上传失败</h3>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
                {uploadProgress.errorMsg}
              </p>
              <Button type="primary" onClick={handleCloseUploadModal}>
                知道了
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default MediaUpload;

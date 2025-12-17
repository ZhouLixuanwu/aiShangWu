import { useState, useEffect, useRef } from 'react';
import { 
  Card, Upload, Button, message, Progress, List, Tag, 
  Image, Space, DatePicker, Statistic, Row, Col, Popconfirm, Empty
} from 'antd';
import { 
  UploadOutlined, PictureOutlined, VideoCameraOutlined, 
  DeleteOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CameraOutlined, FolderOpenOutlined
} from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';
import VideoPlayer from '../components/VideoPlayer';

const MediaUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [stats, setStats] = useState({ todayCount: 0, dailyTarget: 5, completed: false });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [isMobile, setIsMobile] = useState(false);

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
      const res = await request.get('/media/my', {
        params: {
          date: selectedDate.format('YYYY-MM-DD'),
          page: pagination.current,
          pageSize: pagination.pageSize
        }
      });
      setRecords(res.data.list || []);
      setStats(res.data.stats || { todayCount: 0, dailyTarget: 5, completed: false });
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
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

    // 检查文件大小 (100MB)
    if (file.size > 100 * 1024 * 1024) {
      message.error('文件大小不能超过100MB');
      onError(new Error('文件太大'));
      return;
    }

    setUploading(true);

    try {
      // 创建FormData
      const formData = new FormData();
      formData.append('file', file);

      // 上传文件
      const res = await request.post('/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          onProgress({ percent });
        }
      });

      message.success('上传成功');
      onSuccess(res.data);
      
      // 刷新列表
      if (selectedDate.isSame(dayjs(), 'day')) {
        fetchRecords();
      }

    } catch (error) {
      console.error('上传失败:', error);
      message.error('上传失败');
      onError(error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await request.delete(`/media/${id}`);
      message.success('删除成功');
      fetchRecords();
    } catch (error) {
      console.error('删除失败:', error);
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
    </div>
  );
};

export default MediaUpload;

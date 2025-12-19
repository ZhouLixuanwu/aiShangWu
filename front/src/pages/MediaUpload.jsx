import { useState, useEffect, useRef } from 'react';
import { 
  Card, Upload, Button, message, Progress, List, Tag, 
  Image, Space, DatePicker, Statistic, Row, Col, Popconfirm, Empty,
  Modal, Input, Select, Table, Tabs, Collapse, Tooltip, Dropdown
} from 'antd';
import { 
  UploadOutlined, PictureOutlined, VideoCameraOutlined, 
  DeleteOutlined, CheckCircleOutlined, ClockCircleOutlined,
  CameraOutlined, FolderOpenOutlined, LoadingOutlined,
  CloudUploadOutlined, EditOutlined, UserOutlined, TeamOutlined,
  FolderAddOutlined, MoreOutlined, FormOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import VideoPlayer from '../components/VideoPlayer';
import useUserStore from '../store/userStore';

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
  const { hasPermission } = useUserStore();
  
  // 管理员视图
  const [viewMode, setViewMode] = useState('my'); // 'my' | 'all'
  const [allRecords, setAllRecords] = useState([]);
  const [allStats, setAllStats] = useState({ salesmen: [], total: { count: 0 } });
  const [allPagination, setAllPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedUserId, setSelectedUserId] = useState(null);
  const canViewAll = hasPermission('media_view_all');

  // 批量上传状态
  const [uploadQueue, setUploadQueue] = useState([]); // 待上传队列 {file, merchant, status, progress}
  const [batchUploadVisible, setBatchUploadVisible] = useState(false);
  const [defaultMerchant, setDefaultMerchant] = useState('');
  
  // 编辑商家弹窗
  const [editVisible, setEditVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editMerchant, setEditMerchant] = useState('');


  // 重命名弹窗
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameRecord, setRenameRecord] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  
  // 上传进度状态
  const [uploadProgress, setUploadProgress] = useState({
    visible: false,
    percent: 0,
    fileName: '',
    fileSize: 0,
    uploadedSize: 0,
    speed: 0,
    status: 'uploading',
    errorMsg: '',
    currentIndex: 0,
    totalCount: 0
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
    if (viewMode === 'my') {
      fetchRecords();
    } else {
      fetchAllRecords();
      fetchAllStats();
    }
  }, [selectedDate, pagination.current, viewMode, allPagination.current, selectedUserId]);

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

  // 管理员：获取所有上传记录
  const fetchAllRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/media/all`, {
        params: {
          date: selectedDate.format('YYYY-MM-DD'),
          page: allPagination.current,
          pageSize: allPagination.pageSize,
          userId: selectedUserId
        },
        headers: getAuthHeaders()
      });
      const data = res.data;
      setAllRecords(data.data?.list || []);
      setAllPagination(prev => ({ ...prev, total: data.data?.pagination?.total || 0 }));
    } catch (error) {
      console.error('获取所有记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 管理员：获取所有业务员统计
  const fetchAllStats = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/media/all-stats`, {
        params: {
          date: selectedDate.format('YYYY-MM-DD')
        },
        headers: getAuthHeaders()
      });
      const data = res.data;
      setAllStats(data.data || { salesmen: [], total: { count: 0 } });
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  // 已处理的文件UID集合，防止重复
  const processedFileUids = useRef(new Set());

  // 处理文件选择（批量）
  const handleFileSelect = (info) => {
    // 只处理尚未处理过的新文件
    const newFiles = info.fileList.filter(f => {
      if (!f.originFileObj) return false;
      if (processedFileUids.current.has(f.uid)) return false;
      processedFileUids.current.add(f.uid);
      return true;
    }).map(f => f.originFileObj);
    
    if (newFiles.length === 0) return;

    // 添加到上传队列
    const newItems = newFiles.map(file => ({
      file,
      merchant: defaultMerchant,
      status: 'pending',
      progress: 0,
      id: Date.now() + Math.random()
    }));

    setUploadQueue(prev => [...prev, ...newItems]);
    setBatchUploadVisible(true);
  };

  // 关闭上传弹窗时清理
  const closeBatchUpload = () => {
    setBatchUploadVisible(false);
    setUploadQueue([]);
    processedFileUids.current.clear();
  };

  // 更新队列中某个文件的商家
  const updateQueueMerchant = (id, merchant) => {
    setUploadQueue(prev => prev.map(item => 
      item.id === id ? { ...item, merchant } : item
    ));
  };

  // 从队列移除文件
  const removeFromQueue = (id) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
  };

  // 开始批量上传
  const startBatchUpload = async () => {
    if (uploadQueue.length === 0) return;

    setUploading(true);
    const totalCount = uploadQueue.length;
    
    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i];
      if (item.status === 'success') continue;

      // 更新状态为上传中
      setUploadQueue(prev => prev.map(q => 
        q.id === item.id ? { ...q, status: 'uploading' } : q
      ));

      setUploadProgress({
        visible: true,
        percent: 0,
        fileName: item.file.name,
        fileSize: item.file.size,
        uploadedSize: 0,
        speed: 0,
        status: 'uploading',
        errorMsg: '',
        currentIndex: i + 1,
        totalCount
      });
      uploadStartTime.current = Date.now();
      abortController.current = new AbortController();

      try {
        const formData = new FormData();
        formData.append('file', item.file, item.file.name);
        formData.append('originalName', item.file.name);
        if (item.merchant) {
          formData.append('merchant', item.merchant);
        }

        await axios.post(`${API_BASE_URL}/media/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...getAuthHeaders()
          },
          timeout: 30 * 60 * 1000,
          signal: abortController.current.signal,
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            const elapsedTime = (Date.now() - uploadStartTime.current) / 1000;
            const speed = elapsedTime > 0 ? progressEvent.loaded / elapsedTime : 0;
            
            setUploadProgress(prev => ({
              ...prev,
              percent,
              uploadedSize: progressEvent.loaded,
              speed
            }));

            setUploadQueue(prev => prev.map(q => 
              q.id === item.id ? { ...q, progress: percent } : q
            ));
          }
        });

        // 上传成功
        setUploadQueue(prev => prev.map(q => 
          q.id === item.id ? { ...q, status: 'success', progress: 100 } : q
        ));

      } catch (error) {
        console.error('上传失败:', error);
        setUploadQueue(prev => prev.map(q => 
          q.id === item.id ? { ...q, status: 'error' } : q
        ));
      }
    }

    // 全部上传完成
    setUploadProgress(prev => ({ ...prev, visible: false }));
    setUploading(false);
    message.success('批量上传完成');
    
    // 刷新列表
    if (selectedDate.isSame(dayjs(), 'day')) {
      if (viewMode === 'my') {
        fetchRecords();
      } else {
        fetchAllRecords();
        fetchAllStats();
      }
    }
    
    // 清空成功的项目和重置UID集合
    const remainingQueue = uploadQueue.filter(q => q.status !== 'success');
    if (remainingQueue.length === 0) {
      closeBatchUpload();
    } else {
      setUploadQueue(remainingQueue);
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

  // 删除记录
  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/media/${id}`, {
        headers: getAuthHeaders()
      });
      message.success('删除成功');
      if (viewMode === 'my') {
        fetchRecords();
      } else {
        fetchAllRecords();
        fetchAllStats();
      }
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  // 编辑商家
  const showEditMerchant = (record) => {
    setEditingRecord(record);
    setEditMerchant(record.merchant || '');
    setEditVisible(true);
  };

  const handleEditMerchant = async () => {
    try {
      await axios.put(`${API_BASE_URL}/media/${editingRecord.id}/merchant`, 
        { merchant: editMerchant },
        { headers: getAuthHeaders() }
      );
      message.success('更新成功');
      setEditVisible(false);
      if (viewMode === 'my') {
        fetchRecords();
      } else {
        fetchAllRecords();
      }
    } catch (error) {
      console.error('更新失败:', error);
      message.error('更新失败');
    }
  };

  // ==================== 分组功能 ====================
  // ==================== 重命名功能 ====================
  
  const showRename = (record) => {
    setRenameRecord(record);
    setNewFileName(record.file_name);
    setRenameVisible(true);
  };

  const handleRename = async () => {
    if (!newFileName.trim()) {
      message.warning('请输入文件名');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/media/${renameRecord.id}/rename`, 
        { fileName: newFileName },
        { headers: getAuthHeaders() }
      );
      message.success('重命名成功');
      setRenameVisible(false);
      if (viewMode === 'my') {
        fetchRecords();
      } else {
        fetchAllRecords();
      }
      if (groupDetailVisible && currentGroup) {
        showGroupDetail(currentGroup);
      }
    } catch (error) {
      console.error('重命名失败:', error);
      message.error('重命名失败');
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
      touchAction: 'manipulation',
    }
  };

  // 素材操作菜单
  const getMediaMenuItems = () => {
    return [
      { key: 'rename', label: '重命名', icon: <FormOutlined /> },
      { key: 'editMerchant', label: '编辑商家', icon: <EditOutlined /> },
      { type: 'divider' },
      { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true },
    ];
  };

  const handleMediaMenuClick = (key, item) => {
    if (key === 'rename') {
      showRename(item);
    } else if (key === 'editMerchant') {
      showEditMerchant(item);
    } else if (key === 'delete') {
      Modal.confirm({
        title: '确定删除此素材？',
        onOk: () => handleDelete(item.id)
      });
    }
  };

  // 渲染单个素材卡片
  const renderMediaCard = (item, showUser = false) => (
    <Card
      size="small"
      cover={
        item.file_type === 'video' ? (
          <VideoPlayer 
            src={item.url} 
            maxHeight={isMobile ? 120 : 150}
            style={{ background: '#f5f5f5' }}
            compact
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
        <Tooltip title="重命名" key="rename">
          <FormOutlined onClick={() => showRename(item)} />
        </Tooltip>,
        <Dropdown 
          key="more"
          menu={{ 
            items: getMediaMenuItems(item),
            onClick: ({ key }) => handleMediaMenuClick(key, item)
          }}
          trigger={['click']}
        >
          <MoreOutlined />
        </Dropdown>
      ]}
    >
      <Card.Meta
        avatar={item.file_type === 'video' ? 
          <VideoCameraOutlined style={{ fontSize: isMobile ? 16 : 20, color: '#1677ff' }} /> : 
          <PictureOutlined style={{ fontSize: isMobile ? 16 : 20, color: '#52c41a' }} />
        }
        title={
          <div>
            {showUser && (
              <Tag color="blue" style={{ marginBottom: 4 }}>{item.user_name}</Tag>
            )}
            <div style={{ fontSize: isMobile ? 11 : 12 }}>
              {item.file_name.length > (isMobile ? 10 : 15)
                ? item.file_name.substring(0, isMobile ? 10 : 15) + '...' 
                : item.file_name
              }
            </div>
          </div>
        }
        description={
          <div style={{ fontSize: isMobile ? 10 : 11, color: '#999' }}>
            <div>{dayjs(item.created_at).format('HH:mm:ss')}</div>
            {item.merchant && (
              <Tag color="purple" style={{ marginTop: 4 }}>{item.merchant}</Tag>
            )}
          </div>
        }
      />
    </Card>
  );

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">素材上传</span>
        {canViewAll && (
          <Tabs 
            activeKey={viewMode} 
            onChange={setViewMode}
            size="small"
            items={[
              { key: 'my', label: <><UserOutlined /> 我的</> },
              { key: 'all', label: <><TeamOutlined /> 所有</> }
            ]}
          />
        )}
      </div>

      {/* 今日任务进度 - 仅在"我的"模式显示 */}
      {viewMode === 'my' && (
        <Card style={mobileStyles.uploadCard}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={8}>
              <Statistic 
                title="今日已上传" 
                value={stats.todayCount} 
                suffix={`/ ${stats.dailyTarget}`}
                valueStyle={{ color: stats.completed ? '#52c41a' : '#1677ff' }}
              />
            </Col>
            
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
            
            <Col xs={24} sm={6}>
              <div style={mobileStyles.uploadButtonContainer}>
                <Upload
                  customRequest={() => {}}
                  beforeUpload={() => false}
                  showUploadList={false}
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                >
                  <Button 
                    type="primary" 
                    icon={<FolderOpenOutlined />} 
                    loading={uploading}
                    size={isMobile ? 'large' : 'middle'}
                    style={mobileStyles.uploadButton}
                    block={isMobile}
                  >
                    {isMobile ? '选择文件上传' : '批量上传'}
                  </Button>
                </Upload>

                {isMobile && (
                  <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                    <Upload
                      customRequest={() => {}}
                      beforeUpload={() => false}
                      showUploadList={false}
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelect}
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

                    <Upload
                      customRequest={() => {}}
                      beforeUpload={() => false}
                      showUploadList={false}
                      accept="video/*"
                      capture="environment"
                      onChange={handleFileSelect}
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
      )}

      {/* 管理员视图：业务员统计 */}
      {viewMode === 'all' && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={6}>
              <Statistic 
                title="今日总上传" 
                value={allStats.total?.count || 0}
                valueStyle={{ color: '#1677ff' }}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Select
                placeholder="筛选业务员"
                allowClear
                value={selectedUserId}
                onChange={setSelectedUserId}
                style={{ width: '100%' }}
                options={allStats.salesmen?.map(s => ({
                  value: s.user_id,
                  label: `${s.user_name || s.username} (${s.upload_count}个)`
                }))}
              />
            </Col>
            <Col xs={24} sm={6}>
              <DatePicker 
                value={selectedDate} 
                onChange={setSelectedDate}
                allowClear={false}
                disabledDate={(current) => current && current > dayjs().endOf('day')}
                style={{ width: '100%' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 日期选择和记录列表 - 按商家分栏显示 */}
      <Card 
        title="上传记录"
        extra={
          <Space>
            {viewMode === 'my' && (
              <DatePicker 
                value={selectedDate} 
                onChange={setSelectedDate}
                allowClear={false}
                disabledDate={(current) => current && current > dayjs().endOf('day')}
                style={{ width: isMobile ? 120 : 'auto' }}
                inputReadOnly={isMobile}
              />
            )}
          </Space>
        }
        styles={{
          body: {
            padding: isMobile ? '12px 8px' : '24px'
          }
        }}
      >
        {viewMode === 'my' ? (
          records.length === 0 ? (
            <Empty description={isToday ? "今天还没有上传素材" : "该日期没有上传记录"} />
          ) : (
            <div>
              {/* 按商家分组显示 */}
              {(() => {
                // 按商家名称分组
                const groupedByMerchant = {};
                records.forEach(item => {
                  const key = item.merchant || '未指定商家';
                  if (!groupedByMerchant[key]) {
                    groupedByMerchant[key] = [];
                  }
                  groupedByMerchant[key].push(item);
                });
                
                const merchantKeys = Object.keys(groupedByMerchant);
                
                // 如果只有一个分组且是未指定商家，直接显示列表
                if (merchantKeys.length === 1 && merchantKeys[0] === '未指定商家') {
                  return (
                    <List
                      grid={{ gutter: 16, xs: 2, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }}
                      dataSource={records}
                      loading={loading}
                      renderItem={(item) => (
                        <List.Item>{renderMediaCard(item, false)}</List.Item>
                      )}
                    />
                  );
                }
                
                // 多个商家时，使用折叠面板分栏显示
                return (
                  <Collapse 
                    defaultActiveKey={merchantKeys}
                    style={{ background: 'transparent', border: 'none' }}
                  >
                    {merchantKeys.map(merchant => (
                      <Collapse.Panel 
                        key={merchant}
                        header={
                          <Space>
                            <Tag color={merchant === '未指定商家' ? 'default' : 'purple'}>{merchant}</Tag>
                            <span style={{ color: '#999', fontSize: 12 }}>
                              {groupedByMerchant[merchant].length} 个素材
                            </span>
                          </Space>
                        }
                        style={{ marginBottom: 8, background: '#fafafa', borderRadius: 8 }}
                      >
                        <List
                          grid={{ gutter: 16, xs: 2, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }}
                          dataSource={groupedByMerchant[merchant]}
                          renderItem={(item) => (
                            <List.Item>{renderMediaCard(item, false)}</List.Item>
                          )}
                        />
                      </Collapse.Panel>
                    ))}
                  </Collapse>
                );
              })()}
              
              {/* 分页 */}
              {pagination.total > pagination.pageSize && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <List
                    dataSource={[]}
                    pagination={{
                      ...pagination,
                      onChange: (page) => setPagination(prev => ({ ...prev, current: page })),
                      showTotal: isMobile ? undefined : (total) => `共 ${total} 条`,
                      size: isMobile ? 'small' : 'default',
                      simple: isMobile
                    }}
                  />
                </div>
              )}
            </div>
          )
        ) : (
          allRecords.length === 0 ? (
            <Empty description="该日期没有上传记录" />
          ) : (
            <div>
              {/* 管理员视图也按商家分组显示 */}
              {(() => {
                const groupedByMerchant = {};
                allRecords.forEach(item => {
                  const key = item.merchant || '未指定商家';
                  if (!groupedByMerchant[key]) {
                    groupedByMerchant[key] = [];
                  }
                  groupedByMerchant[key].push(item);
                });
                
                const merchantKeys = Object.keys(groupedByMerchant);
                
                if (merchantKeys.length === 1 && merchantKeys[0] === '未指定商家') {
                  return (
                    <List
                      grid={{ gutter: 16, xs: 2, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }}
                      dataSource={allRecords}
                      loading={loading}
                      renderItem={(item) => (
                        <List.Item>{renderMediaCard(item, true)}</List.Item>
                      )}
                    />
                  );
                }
                
                return (
                  <Collapse 
                    defaultActiveKey={merchantKeys}
                    style={{ background: 'transparent', border: 'none' }}
                  >
                    {merchantKeys.map(merchant => (
                      <Collapse.Panel 
                        key={merchant}
                        header={
                          <Space>
                            <Tag color={merchant === '未指定商家' ? 'default' : 'purple'}>{merchant}</Tag>
                            <span style={{ color: '#999', fontSize: 12 }}>
                              {groupedByMerchant[merchant].length} 个素材
                            </span>
                          </Space>
                        }
                        style={{ marginBottom: 8, background: '#fafafa', borderRadius: 8 }}
                      >
                        <List
                          grid={{ gutter: 16, xs: 2, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }}
                          dataSource={groupedByMerchant[merchant]}
                          renderItem={(item) => (
                            <List.Item>{renderMediaCard(item, true)}</List.Item>
                          )}
                        />
                      </Collapse.Panel>
                    ))}
                  </Collapse>
                );
              })()}
              
              {allPagination.total > allPagination.pageSize && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <List
                    dataSource={[]}
                    pagination={{
                      ...allPagination,
                      onChange: (page) => setAllPagination(prev => ({ ...prev, current: page })),
                      showTotal: isMobile ? undefined : (total) => `共 ${total} 条`,
                      size: isMobile ? 'small' : 'default',
                      simple: isMobile
                    }}
                  />
                </div>
              )}
            </div>
          )
        )}
      </Card>

      {/* 批量上传弹窗 */}
      <Modal
        title="批量上传"
        open={batchUploadVisible}
        onCancel={() => !uploading && closeBatchUpload()}
        footer={[
          <Button key="cancel" onClick={closeBatchUpload} disabled={uploading}>
            取消
          </Button>,
          <Button key="upload" type="primary" onClick={startBatchUpload} loading={uploading}>
            开始上传 ({uploadQueue.filter(q => q.status !== 'success').length}个)
          </Button>
        ]}
        width={700}
        maskClosable={false}
      >
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="默认商家名称（可选，留空则每个单独填写）"
            value={defaultMerchant}
            onChange={e => setDefaultMerchant(e.target.value)}
            addonBefore="默认商家"
          />
        </div>
        
        <Table
          dataSource={uploadQueue}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ y: 300 }}
          columns={[
            {
              title: '文件名',
              dataIndex: ['file', 'name'],
              key: 'name',
              ellipsis: true,
              width: 200
            },
            {
              title: '商家',
              dataIndex: 'merchant',
              key: 'merchant',
              width: 150,
              render: (val, record) => (
                <Input
                  size="small"
                  placeholder="商家名称"
                  value={val}
                  onChange={e => updateQueueMerchant(record.id, e.target.value)}
                  disabled={record.status === 'success'}
                />
              )
            },
            {
              title: '状态',
              key: 'status',
              width: 100,
              render: (_, record) => {
                if (record.status === 'success') return <Tag color="success">已完成</Tag>;
                if (record.status === 'error') return <Tag color="error">失败</Tag>;
                if (record.status === 'uploading') return <Tag color="processing">上传中 {record.progress}%</Tag>;
                return <Tag>待上传</Tag>;
              }
            },
            {
              title: '操作',
              key: 'action',
              width: 60,
              render: (_, record) => (
                record.status !== 'uploading' && (
                  <Button 
                    type="link" 
                    danger 
                    size="small"
                    onClick={() => removeFromQueue(record.id)}
                  >
                    移除
                  </Button>
                )
              )
            }
          ]}
        />
      </Modal>

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
          <CloudUploadOutlined style={{ fontSize: 48, color: '#1677ff', marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>
            正在上传 ({uploadProgress.currentIndex}/{uploadProgress.totalCount})
          </h3>
          <p style={{ 
            color: '#666', 
            marginBottom: 16, 
            fontSize: 13,
            wordBreak: 'break-all'
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
        </div>
      </Modal>

      {/* 编辑商家弹窗 */}
      <Modal
        title="编辑商家"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleEditMerchant}
        okText="保存"
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ color: '#666' }}>文件：{editingRecord?.file_name}</p>
        </div>
        <Input
          placeholder="请输入商家名称"
          value={editMerchant}
          onChange={e => setEditMerchant(e.target.value)}
          addonBefore="商家"
        />
      </Modal>

      {/* 重命名弹窗 */}
      <Modal
        title="重命名"
        open={renameVisible}
        onCancel={() => setRenameVisible(false)}
        onOk={handleRename}
        okText="保存"
      >
        <Input
          placeholder="请输入新的文件名"
          value={newFileName}
          onChange={e => setNewFileName(e.target.value)}
          addonBefore="文件名"
        />
      </Modal>
    </div>
  );
};

export default MediaUpload;

import { useState, useEffect } from 'react';
import { 
  Card, Select, DatePicker, Table, Tag, Image, Space, 
  Statistic, Row, Col, Progress, List, Empty, Button, Popconfirm, message
} from 'antd';
import { 
  PictureOutlined, VideoCameraOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, DeleteOutlined, EyeOutlined
} from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';
import VideoPlayer from '../components/VideoPlayer';

const TeamMedia = () => {
  const [salesmen, setSalesmen] = useState([]);
  const [selectedSalesman, setSelectedSalesman] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [teamStats, setTeamStats] = useState({ salesmen: [], total: { count: 0 } });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [viewMode, setViewMode] = useState('stats'); // 'stats' or 'list'

  useEffect(() => {
    fetchSalesmen();
  }, []);

  useEffect(() => {
    fetchTeamStats();
  }, [selectedDate]);

  useEffect(() => {
    if (viewMode === 'list') {
      fetchRecords();
    }
  }, [selectedDate, selectedSalesman, pagination.current, viewMode]);

  const fetchSalesmen = async () => {
    try {
      const res = await request.get('/users/my-salesmen');
      setSalesmen(res.data || []);
    } catch (error) {
      console.error('获取业务员列表失败:', error);
    }
  };

  const fetchTeamStats = async () => {
    try {
      const res = await request.get('/media/team-stats', {
        params: {
          date: selectedDate.format('YYYY-MM-DD')
        }
      });
      setTeamStats(res.data || { salesmen: [], total: { count: 0 } });
    } catch (error) {
      console.error('获取团队统计失败:', error);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {
        date: selectedDate.format('YYYY-MM-DD'),
        page: pagination.current,
        pageSize: pagination.pageSize
      };
      if (selectedSalesman) {
        params.salesmanId = selectedSalesman;
      }

      const res = await request.get('/media/team', { params });
      setRecords(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取上传记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await request.delete(`/media/${id}`);
      message.success('删除成功');
      fetchRecords();
      fetchTeamStats();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleViewSalesmanMedia = (userId) => {
    setSelectedSalesman(userId);
    setViewMode('list');
  };

  // 统计视图的列
  const statsColumns = [
    {
      title: '业务员',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120,
      render: (val, record) => val || record.username
    },
    {
      title: '今日上传',
      dataIndex: 'upload_count',
      key: 'upload_count',
      width: 100,
      render: (val) => (
        <span style={{ fontWeight: 600, fontSize: 16 }}>{val}</span>
      )
    },
    {
      title: '目标',
      dataIndex: 'dailyTarget',
      key: 'dailyTarget',
      width: 80,
      render: (val) => val
    },
    {
      title: '完成进度',
      key: 'progress',
      width: 200,
      render: (_, record) => {
        const percent = Math.min(100, Math.round((record.upload_count / record.dailyTarget) * 100));
        return (
          <Progress 
            percent={percent} 
            size="small"
            status={record.completed ? 'success' : 'active'}
            strokeColor={record.completed ? '#52c41a' : '#1677ff'}
          />
        );
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_, record) => (
        record.completed ? 
          <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag> : 
          <Tag icon={<CloseCircleOutlined />} color="warning">未完成</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => handleViewSalesmanMedia(record.user_id)}
        >
          查看
        </Button>
      )
    }
  ];

  // 计算完成率
  const completedCount = teamStats.salesmen.filter(s => s.completed).length;
  const totalSalesmen = teamStats.salesmen.length;

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">团队素材</span>
        <DatePicker 
          value={selectedDate} 
          onChange={setSelectedDate}
          allowClear={false}
          disabledDate={(current) => current && current > dayjs().endOf('day')}
        />
      </div>

      {/* 团队统计概览 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic 
              title="今日团队总上传" 
              value={teamStats.total.count} 
              suffix="个"
              valueStyle={{ color: '#1677ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="完成任务人数" 
              value={completedCount} 
              suffix={`/ ${totalSalesmen}`}
              valueStyle={{ color: completedCount === totalSalesmen ? '#52c41a' : '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="未完成人数" 
              value={totalSalesmen - completedCount} 
              valueStyle={{ color: totalSalesmen - completedCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="完成率" 
              value={totalSalesmen > 0 ? Math.round((completedCount / totalSalesmen) * 100) : 0} 
              suffix="%"
              valueStyle={{ color: completedCount === totalSalesmen ? '#52c41a' : '#1677ff' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 视图切换 */}
      {viewMode === 'stats' ? (
        <Card title="业务员上传统计">
          {teamStats.salesmen.length === 0 ? (
            <Empty description="暂无下属业务员" />
          ) : (
            <Table
              columns={statsColumns}
              dataSource={teamStats.salesmen}
              rowKey="user_id"
              pagination={false}
              size="middle"
            />
          )}
        </Card>
      ) : (
        <Card 
          title={
            <Space>
              <Button size="small" onClick={() => { setViewMode('stats'); setSelectedSalesman(null); }}>
                ← 返回统计
              </Button>
              <span>
                {selectedSalesman 
                  ? `${salesmen.find(s => s.id === selectedSalesman)?.realName || '业务员'}的上传记录` 
                  : '全部上传记录'
                }
              </span>
            </Space>
          }
          extra={
            <Select
              placeholder="筛选业务员"
              value={selectedSalesman}
              onChange={setSelectedSalesman}
              style={{ width: 150 }}
              allowClear
            >
              {salesmen.map(s => (
                <Select.Option key={s.id} value={s.id}>
                  {s.realName || s.username}
                </Select.Option>
              ))}
            </Select>
          }
        >
          {records.length === 0 ? (
            <Empty description="该日期没有上传记录" />
          ) : (
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 5, xxl: 6 }}
              dataSource={records}
              loading={loading}
              pagination={{
                ...pagination,
                onChange: (page) => setPagination(prev => ({ ...prev, current: page })),
                showTotal: (total) => `共 ${total} 条`
              }}
              renderItem={(item) => (
                <List.Item>
                  <Card
                    size="small"
                  cover={
                    item.file_type === 'video' ? (
                      <VideoPlayer 
                        src={item.url} 
                        maxHeight={140}
                        style={{ background: '#f5f5f5' }}
                      />
                    ) : (
                      <Image
                        src={item.url}
                        alt={item.file_name}
                        style={{ height: 140, objectFit: 'cover' }}
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
                        <VideoCameraOutlined style={{ fontSize: 18, color: '#1677ff' }} /> : 
                        <PictureOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                      }
                      title={
                        <Tag color="blue" style={{ fontSize: 11 }}>{item.user_name}</Tag>
                      }
                      description={
                        <span style={{ fontSize: 11, color: '#999' }}>
                          {dayjs(item.created_at).format('HH:mm')}
                        </span>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
          )}
        </Card>
      )}
    </div>
  );
};

export default TeamMedia;

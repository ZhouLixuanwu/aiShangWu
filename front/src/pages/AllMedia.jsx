import { useState, useEffect } from 'react';
import { 
  Card, Select, DatePicker, Table, Tag, Image, Space, 
  Statistic, Row, Col, Progress, List, Empty, Button, Popconfirm, message, Collapse
} from 'antd';
import { 
  PictureOutlined, VideoCameraOutlined, CheckCircleOutlined, 
  CloseCircleOutlined, DeleteOutlined, EyeOutlined, GlobalOutlined,
  TeamOutlined, UserOutlined, CrownOutlined
} from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';
import VideoPlayer from '../components/VideoPlayer';

const AllMedia = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [allStats, setAllStats] = useState({ groups: [], unassigned: [], salesmen: [], total: { count: 0 } });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [viewMode, setViewMode] = useState('stats'); // 'stats' or 'list'

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchAllStats();
  }, [selectedDate]);

  useEffect(() => {
    if (viewMode === 'list') {
      fetchRecords();
    }
  }, [selectedDate, selectedUser, pagination.current, viewMode]);

  const fetchUsers = async () => {
    try {
      const res = await request.get('/users', { params: { pageSize: 1000 } });
      setUsers(res.data.list || []);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchAllStats = async () => {
    try {
      const res = await request.get('/media/all-stats', {
        params: {
          date: selectedDate.format('YYYY-MM-DD')
        }
      });
      setAllStats(res.data || { groups: [], unassigned: [], salesmen: [], total: { count: 0 } });
    } catch (error) {
      console.error('获取全员统计失败:', error);
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
      if (selectedUser) {
        params.userId = selectedUser;
      }

      const res = await request.get('/media/all', { params });
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
      fetchAllStats();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleViewUserMedia = (userId) => {
    setSelectedUser(userId);
    setViewMode('list');
  };

  // 成员列表的列定义
  const memberColumns = [
    {
      title: '业务员',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 120,
      render: (val, record) => (
        <Space>
          <UserOutlined style={{ color: '#1677ff' }} />
          <span>{val || record.username}</span>
        </Space>
      )
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
          onClick={() => handleViewUserMedia(record.user_id)}
        >
          查看
        </Button>
      )
    }
  ];

  // 计算完成率
  const completedCount = allStats.salesmen?.filter(s => s.completed).length || 0;
  const totalUsers = allStats.salesmen?.length || 0;

  // 构建 Collapse 面板
  const collapseItems = allStats.groups?.map((group, index) => {
    const { leader, members, teamStats } = group;
    
    return {
      key: `group-${index}`,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Space>
            <CrownOutlined style={{ color: '#faad14', fontSize: 16 }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              {leader.user_name || leader.username} 的团队
            </span>
            <Tag color="blue">{teamStats.totalMembers} 人</Tag>
          </Space>
          <Space size="large">
            <span>
              总上传: <span style={{ fontWeight: 600, color: '#1677ff' }}>{teamStats.totalUpload}</span>
            </span>
            <span>
              完成: <span style={{ 
                fontWeight: 600, 
                color: teamStats.completedCount === teamStats.totalMembers ? '#52c41a' : '#faad14' 
              }}>
                {teamStats.completedCount}/{teamStats.totalMembers}
              </span>
            </span>
            {teamStats.totalMembers > 0 && teamStats.completedCount === teamStats.totalMembers ? (
              <Tag icon={<CheckCircleOutlined />} color="success">全员完成</Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />} color="warning">
                {teamStats.totalMembers - teamStats.completedCount} 人未完成
              </Tag>
            )}
          </Space>
        </div>
      ),
      children: (
        <Table
          columns={memberColumns}
          dataSource={members}
          rowKey="user_id"
          pagination={false}
          size="small"
        />
      )
    };
  }) || [];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">
          <GlobalOutlined style={{ marginRight: 8 }} />
          全员素材
        </span>
        <DatePicker 
          value={selectedDate} 
          onChange={setSelectedDate}
          allowClear={false}
          disabledDate={(current) => current && current > dayjs().endOf('day')}
        />
      </div>

      {/* 全员统计概览 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic 
              title="今日全员总上传" 
              value={allStats.total?.count || 0} 
              suffix="个"
              valueStyle={{ color: '#1677ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="完成任务人数" 
              value={completedCount} 
              suffix={`/ ${totalUsers}`}
              valueStyle={{ color: completedCount === totalUsers && totalUsers > 0 ? '#52c41a' : '#faad14' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="未完成人数" 
              value={totalUsers - completedCount} 
              valueStyle={{ color: totalUsers - completedCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="完成率" 
              value={totalUsers > 0 ? Math.round((completedCount / totalUsers) * 100) : 0} 
              suffix="%"
              valueStyle={{ color: completedCount === totalUsers && totalUsers > 0 ? '#52c41a' : '#1677ff' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 视图切换 */}
      {viewMode === 'stats' ? (
        <>
          {/* 按组长分组显示 */}
          {allStats.groups?.length > 0 ? (
            <Card 
              title={
                <Space>
                  <TeamOutlined />
                  <span>团队上传统计</span>
                  <Tag color="blue">{allStats.groups.length} 个团队</Tag>
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Collapse 
                items={collapseItems}
                defaultActiveKey={collapseItems.map(item => item.key)}
                expandIconPosition="start"
              />
            </Card>
          ) : (
            <Card title="团队上传统计">
              <Empty description="暂无团队数据" />
            </Card>
          )}

          {/* 未分配组长的业务员 */}
          {allStats.unassigned?.length > 0 && (
            <Card 
              title={
                <Space>
                  <UserOutlined />
                  <span>未分配团队</span>
                  <Tag color="orange">{allStats.unassigned.length} 人</Tag>
                </Space>
              }
            >
              <Table
                columns={memberColumns}
                dataSource={allStats.unassigned}
                rowKey="user_id"
                pagination={false}
                size="small"
              />
            </Card>
          )}
        </>
      ) : (
        <Card 
          title={
            <Space>
              <Button size="small" onClick={() => { setViewMode('stats'); setSelectedUser(null); }}>
                ← 返回统计
              </Button>
              <span>
                {selectedUser 
                  ? `${users.find(u => u.id === selectedUser)?.realName || '用户'}的上传记录` 
                  : '全部上传记录'
                }
              </span>
            </Space>
          }
          extra={
            <Select
              placeholder="筛选用户"
              value={selectedUser}
              onChange={setSelectedUser}
              style={{ width: 150 }}
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {users.filter(u => u.userType === 'leader' || u.userType === 'salesman').map(u => (
                <Select.Option key={u.id} value={u.id}>
                  {u.realName || u.username}
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

export default AllMedia;

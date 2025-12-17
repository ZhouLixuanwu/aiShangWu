import { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Button, Space, Modal, Card, Tag } from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const TeamLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedUser, setSelectedUser] = useState(null);
  const [dateRange, setDateRange] = useState([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchLogs();
  }, [pagination.current, pagination.pageSize]);

  const fetchUsers = async () => {
    try {
      const res = await request.get('/logs/users/list');
      setUsers(res.data || []);
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize
      };

      if (selectedUser) {
        params.userId = selectedUser;
      }

      if (dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const res = await request.get('/logs', { params });
      setLogs(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取日志列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchLogs();
  };

  const showDetail = (record) => {
    setCurrentLog(record);
    setDetailVisible(true);
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'log_date',
      key: 'log_date',
      width: 120,
      render: (val) => dayjs(val).format('YYYY-MM-DD')
    },
    {
      title: '成员',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 120,
      render: (val, record) => val || record.username
    },
    {
      title: '工作时长',
      dataIndex: 'work_hours',
      key: 'work_hours',
      width: 100,
      render: (val) => <Tag color="blue">{val} 小时</Tag>
    },
    {
      title: '内容摘要',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (val) => val?.substring(0, 100) + (val?.length > 100 ? '...' : '')
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
          查看
        </Button>
      )
    }
  ];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">团队日志</span>
      </div>

      <div className="search-bar">
        <Select
          placeholder="选择成员"
          value={selectedUser}
          onChange={setSelectedUser}
          style={{ width: 200 }}
          allowClear
        >
          {users.map(u => (
            <Select.Option key={u.id} value={u.id}>
              {u.real_name || u.username}
            </Select.Option>
          ))}
        </Select>
        <RangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder={['开始日期', '结束日期']}
        />
        <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
      </div>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
        onChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))}
      />

      <Modal
        title={`日志详情 - ${currentLog?.real_name || currentLog?.username}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {currentLog && (
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Tag color="blue">日期: {dayjs(currentLog.log_date).format('YYYY-MM-DD')}</Tag>
              <Tag color="green">工作时长: {currentLog.work_hours} 小时</Tag>
            </Space>
            <div style={{ 
              whiteSpace: 'pre-wrap', 
              lineHeight: 1.8,
              padding: 16,
              background: '#f5f5f5',
              borderRadius: 8,
              minHeight: 200
            }}>
              {currentLog.content}
            </div>
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default TeamLogs;


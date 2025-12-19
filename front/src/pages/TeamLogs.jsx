import { useState, useEffect } from 'react';
import { Table, Select, DatePicker, Button, Space, Modal, Card, Tag } from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

// 引入wangeditor样式以正确渲染富文本内容
import '@wangeditor/editor/dist/css/style.css';

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

  // 递归解码HTML实体（处理多重转义的情况）
  const decodeHtml = (html) => {
    if (!html) return '';
    const textarea = document.createElement('textarea');
    let decoded = html;
    let prevDecoded = '';
    
    // 循环解码，直到没有更多需要解码的内容
    while (decoded !== prevDecoded) {
      prevDecoded = decoded;
      textarea.innerHTML = decoded;
      decoded = textarea.value;
    }
    
    return decoded;
  };

  // 从HTML中提取纯文本用于表格显示
  const stripHtml = (html) => {
    if (!html) return '';
    // 先解码 HTML 实体
    const decoded = decodeHtml(html);
    const tmp = document.createElement('div');
    tmp.innerHTML = decoded;
    return tmp.textContent || tmp.innerText || '';
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
      render: (val) => {
        const text = stripHtml(val);
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
      }
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
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color="blue">日期: {dayjs(currentLog.log_date).format('YYYY-MM-DD')}</Tag>
              <Tag color="green">工作时长: {currentLog.work_hours} 小时</Tag>
            </Space>
            {/* 渲染富文本内容 */}
            <div 
              className="log-content-view"
              style={{ 
                lineHeight: 1.8,
                padding: 16,
                background: '#fafafa',
                borderRadius: 8,
                minHeight: 200,
                border: '1px solid #e8e8e8',
                overflow: 'auto',
                wordBreak: 'break-word'
              }}
              dangerouslySetInnerHTML={{ __html: decodeHtml(currentLog.content) }}
            />
            {/* 富文本内容样式 */}
            <style>{`
              .log-content-view p { margin: 0 0 8px 0; }
              .log-content-view ul, .log-content-view ol { padding-left: 20px; margin: 8px 0; }
              .log-content-view li { margin: 4px 0; }
              .log-content-view table { border-collapse: collapse; width: 100%; margin: 8px 0; }
              .log-content-view td, .log-content-view th { border: 1px solid #ddd; padding: 8px; }
              .log-content-view blockquote { margin: 8px 0; padding: 8px 16px; border-left: 4px solid #1677ff; background: #f0f5ff; }
              .log-content-view pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
              .log-content-view code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; }
              .log-content-view img { max-width: 100%; height: auto; }
              .log-content-view a { color: #1677ff; }
            `}</style>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TeamLogs;

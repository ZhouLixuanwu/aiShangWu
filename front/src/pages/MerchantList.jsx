import { useState, useEffect } from 'react';
import { 
  Card, Table, Tag, Space, Button, Input, Select, Modal, 
  Descriptions, Image, message, Popconfirm, Row, Col, Statistic
} from 'antd';
import { 
  ShopOutlined, SearchOutlined, EyeOutlined, 
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  DeleteOutlined, ReloadOutlined, FilterOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const MerchantList = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ keyword: '', status: undefined, userId: undefined });
  const [submitters, setSubmitters] = useState([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: 0, remark: '' });
  const [isMobile, setIsMobile] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

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
    fetchSubmitters();
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/merchant/all`, {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize,
          keyword: filters.keyword || undefined,
          status: filters.status,
          userId: filters.userId
        },
        headers: getAuthHeaders()
      });
      const data = res.data;
      const list = data.data?.list || [];
      setRecords(list);
      setPagination(prev => ({ ...prev, total: data.data?.pagination?.total || 0 }));
      
      // 获取全量统计（简单处理，实际可增加后端接口）
      const allRes = await axios.get(`${API_BASE_URL}/merchant/all`, {
        params: { pageSize: 1000 },
        headers: getAuthHeaders()
      });
      const allList = allRes.data.data?.list || [];
      const pending = allList.filter(r => r.status === 0).length;
      const approved = allList.filter(r => r.status === 1).length;
      const rejected = allList.filter(r => r.status === 2).length;
      setStats({
        total: allList.length,
        pending,
        approved,
        rejected
      });
    } catch (err) {
      console.error('获取记录失败:', err);
      message.error('获取记录失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmitters = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/merchant/submitters`, {
        headers: getAuthHeaders()
      });
      setSubmitters(res.data.data || []);
    } catch (err) {
      console.error('获取提交者列表失败:', err);
    }
  };

  const showDetail = (record) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  const showStatusModal = (record) => {
    setCurrentRecord(record);
    setStatusForm({ status: record.status, remark: record.remark || '' });
    setStatusModalVisible(true);
  };

  const handleStatusUpdate = async () => {
    try {
      await axios.put(
        `${API_BASE_URL}/merchant/${currentRecord.id}/status`,
        statusForm,
        { headers: getAuthHeaders() }
      );
      message.success('状态更新成功');
      setStatusModalVisible(false);
      fetchRecords();
    } catch (err) {
      console.error('更新状态失败:', err);
      message.error('更新状态失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/merchant/${id}`, {
        headers: getAuthHeaders()
      });
      message.success('删除成功');
      fetchRecords();
    } catch (err) {
      console.error('删除失败:', err);
      message.error('删除失败');
    }
  };

  const getStatusTag = (status) => {
    switch (status) {
      case 0:
        return <Tag icon={<ClockCircleOutlined />} color="processing">待审核</Tag>;
      case 1:
        return <Tag icon={<CheckCircleOutlined />} color="success">已通过</Tag>;
      case 2:
        return <Tag icon={<CloseCircleOutlined />} color="error">已拒绝</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  const columns = [
    {
      title: '提交人',
      dataIndex: 'user_name',
      key: 'user_name',
      width: 100,
      fixed: isMobile ? undefined : 'left',
    },
    {
      title: '个体户名称',
      dataIndex: 'business_name_1',
      key: 'business_name_1',
      ellipsis: true,
    },
    {
      title: '联系人',
      dataIndex: 'contact_name',
      key: 'contact_name',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      width: 130,
      responsive: ['md'],
    },
    {
      title: '经营者电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      responsive: ['lg'],
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      responsive: ['lg'],
      render: (text) => dayjs(text).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: isMobile ? undefined : 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" onClick={() => showStatusModal(record)}>
            审核
          </Button>
          <Popconfirm
            title="确定删除此记录？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">
          <ShopOutlined style={{ marginRight: 8 }} />
          办理营业执照管理
        </span>
      </div>

      {/* 统计卡片 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={6}>
            <Statistic 
              title="总提交" 
              value={stats.total} 
            />
          </Col>
          <Col xs={6}>
            <Statistic 
              title="待审核" 
              value={stats.pending} 
              valueStyle={{ color: '#1677ff' }}
            />
          </Col>
          <Col xs={6}>
            <Statistic 
              title="已通过" 
              value={stats.approved} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col xs={6}>
            <Statistic 
              title="已拒绝" 
              value={stats.rejected} 
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Col>
        </Row>
      </Card>

      {/* 筛选区域 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Input
              placeholder="搜索名称/电话/联系人"
              prefix={<SearchOutlined />}
              value={filters.keyword}
              onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
              allowClear
            />
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Select
              placeholder="状态筛选"
              value={filters.status}
              onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              allowClear
              style={{ width: '100%' }}
              options={[
                { value: 0, label: '待审核' },
                { value: 1, label: '已通过' },
                { value: 2, label: '已拒绝' },
              ]}
            />
          </Col>
          <Col xs={12} sm={8} md={6}>
            <Select
              placeholder="提交人筛选"
              value={filters.userId}
              onChange={(value) => setFilters(prev => ({ ...prev, userId: value }))}
              allowClear
              style={{ width: '100%' }}
              options={submitters.map(s => ({
                value: s.user_id,
                label: s.user_name
              }))}
            />
          </Col>
          <Col xs={24} sm={24} md={8}>
            <Space>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={() => {
                  setFilters({ keyword: '', status: undefined, userId: undefined });
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
              >
                重置
              </Button>
              <Button 
                type="primary" 
                icon={<FilterOutlined />}
                onClick={() => setPagination(prev => ({ ...prev, current: 1 }))}
              >
                查询
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            onChange: (page, pageSize) => setPagination(prev => ({ ...prev, current: page, pageSize })),
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            size: isMobile ? 'small' : 'default',
            simple: isMobile
          }}
          size={isMobile ? 'small' : 'middle'}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        open={detailVisible}
        title="商家信息详情"
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
          <Button key="audit" type="primary" onClick={() => {
            setDetailVisible(false);
            showStatusModal(currentRecord);
          }}>
            审核
          </Button>
        ]}
        onCancel={() => setDetailVisible(false)}
        width={700}
      >
        {currentRecord && (
          <Descriptions column={isMobile ? 1 : 2} bordered size="small">
            <Descriptions.Item label="提交人">{currentRecord.user_name}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(currentRecord.status)}</Descriptions.Item>
            <Descriptions.Item label="经营者手机号">{currentRecord.phone}</Descriptions.Item>
            <Descriptions.Item label="营业范围">{currentRecord.business_scope}</Descriptions.Item>
            <Descriptions.Item label="首选名称" span={2}>{currentRecord.business_name_1}</Descriptions.Item>
            <Descriptions.Item label="备选名称1">{currentRecord.business_name_2 || '-'}</Descriptions.Item>
            <Descriptions.Item label="备选名称2">{currentRecord.business_name_3 || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系人">{currentRecord.contact_name}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{currentRecord.contact_phone}</Descriptions.Item>
            <Descriptions.Item label="提交时间" span={2}>
              {dayjs(currentRecord.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {currentRecord.remark && (
              <Descriptions.Item label="审核备注" span={2}>
                {currentRecord.remark}
              </Descriptions.Item>
            )}
            {(currentRecord.idCardFrontUrl || currentRecord.idCardBackUrl) && (
              <Descriptions.Item label="身份证照片" span={2}>
                <Space size={16} wrap>
                  {currentRecord.idCardFrontUrl && (
                    <div style={{ textAlign: 'center' }}>
                      <Image 
                        src={currentRecord.idCardFrontUrl} 
                        width={250}
                        style={{ borderRadius: 8 }}
                      />
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>正面（人像面）</div>
                    </div>
                  )}
                  {currentRecord.idCardBackUrl && (
                    <div style={{ textAlign: 'center' }}>
                      <Image 
                        src={currentRecord.idCardBackUrl} 
                        width={250}
                        style={{ borderRadius: 8 }}
                      />
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>反面（国徽面）</div>
                    </div>
                  )}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 审核弹窗 */}
      <Modal
        open={statusModalVisible}
        title="审核商家信息"
        onCancel={() => setStatusModalVisible(false)}
        onOk={handleStatusUpdate}
        okText="确认"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <label>审核结果：</label>
          <Select
            value={statusForm.status}
            onChange={(value) => setStatusForm(prev => ({ ...prev, status: value }))}
            style={{ width: '100%', marginTop: 8 }}
            options={[
              { value: 0, label: '待审核' },
              { value: 1, label: '通过' },
              { value: 2, label: '拒绝' },
            ]}
          />
        </div>
        <div>
          <label>备注说明：</label>
          <Input.TextArea
            value={statusForm.remark}
            onChange={(e) => setStatusForm(prev => ({ ...prev, remark: e.target.value }))}
            placeholder="请输入审核备注（可选）"
            rows={3}
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default MerchantList;


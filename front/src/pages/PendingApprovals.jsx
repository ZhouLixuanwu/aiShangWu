import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Modal, Descriptions, Input, InputNumber, message } from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

const PendingApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [detailVisible, setDetailVisible] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approving, setApproving] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 编辑中的商品数量
  const [editingItems, setEditingItems] = useState([]);

  useEffect(() => {
    fetchRequests();
  }, [pagination.current, pagination.pageSize]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await request.get('/stock-requests/pending', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize
        }
      });
      setRequests(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取待审批列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const showDetail = (record) => {
    setCurrentRequest(record);
    setDetailVisible(true);
  };

  const showEdit = (record) => {
    setCurrentRequest(record);
    // 复制商品列表用于编辑
    setEditingItems(record.items ? record.items.map(item => ({ ...item })) : []);
    setEditVisible(true);
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    setEditingItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const handleSaveEdit = async () => {
    // 验证数量
    for (const item of editingItems) {
      if (!item.quantity || item.quantity < 1) {
        message.warning(`${item.product_name} 的数量必须大于0`);
        return;
      }
    }

    setSaving(true);
    try {
      await request.put(`/stock-requests/${currentRequest.id}/items`, {
        items: editingItems.map(item => ({
          id: item.id,
          quantity: item.quantity
        }))
      });
      message.success('修改成功');
      setEditVisible(false);
      fetchRequests();
    } catch (error) {
      console.error('修改失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (record) => {
    setApproving(true);
    try {
      await request.post(`/stock-requests/${record.id}/approve`, { approved: true });
      message.success('审批通过');
      fetchRequests();
    } catch (error) {
      console.error('审批失败:', error);
    } finally {
      setApproving(false);
    }
  };

  const showReject = (record) => {
    setCurrentRequest(record);
    setRejectReason('');
    setRejectVisible(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.warning('请填写拒绝原因');
      return;
    }
    setApproving(true);
    try {
      await request.post(`/stock-requests/${currentRequest.id}/approve`, { 
        approved: false, 
        rejectReason 
      });
      message.success('已拒绝');
      setRejectVisible(false);
      fetchRequests();
    } catch (error) {
      console.error('拒绝失败:', error);
    } finally {
      setApproving(false);
    }
  };

  const getTypeTag = (type) => {
    if (type === 'out') return <Tag color="orange">出库</Tag>;
    if (type === 'self_purchase') return <Tag color="purple">自购立牌</Tag>;
    return <Tag color="blue">入库</Tag>;
  };

  // 渲染商品列表
  const renderItems = (record) => {
    // 自购立牌显示数量
    if (record.type === 'self_purchase') {
      return <span style={{ color: '#722ed1' }}>自购立牌 x{record.quantity}</span>;
    }
    if (record.items && record.items.length > 0) {
      return (
        <Space direction="vertical" size={0}>
          {record.items.map((item, index) => (
            <span key={index} style={{ fontSize: 12 }}>
              {item.product_name} x{item.quantity}
            </span>
          ))}
        </Space>
      );
    }
    return record.items_summary || '-';
  };

  const columns = [
    {
      title: '单号',
      dataIndex: 'request_no',
      key: 'request_no',
      width: 150,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 70,
      render: (type) => getTypeTag(type)
    },
    {
      title: '商品',
      key: 'items',
      width: 200,
      render: (_, record) => renderItems(record)
    },
    {
      title: '申请人',
      dataIndex: 'submitter_name',
      key: 'submitter_name',
      width: 90,
      render: (val) => <Tag color="blue">{val}</Tag>
    },
    {
      title: '业务员',
      dataIndex: 'salesman_name',
      key: 'salesman_name',
      width: 90,
      render: (val) => val ? <Tag color="green">{val}</Tag> : '-'
    },
    {
      title: '商家',
      dataIndex: 'merchant',
      key: 'merchant',
      width: 100,
      render: (val) => val || '-'
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (val) => dayjs(val).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space>
          {/* 自购立牌没有商品可编辑 */}
          {record.type !== 'self_purchase' && (
            <Button 
              size="small"
              icon={<EditOutlined />}
              onClick={() => showEdit(record)}
            >
              编辑
            </Button>
          )}
          <Button 
            type="primary" 
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleApprove(record)}
            loading={approving}
          >
            通过
          </Button>
          <Button 
            danger 
            size="small"
            icon={<CloseOutlined />}
            onClick={() => showReject(record)}
          >
            拒绝
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">待审批申请</span>
        <Tag color="gold">共 {pagination.total} 条待处理</Tag>
      </div>

      <Table
        columns={columns}
        dataSource={requests}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
        onChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))}
        scroll={{ x: 1100 }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title="编辑申请"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSaveEdit}
        confirmLoading={saving}
        okText="保存"
        width={600}
      >
        {currentRequest && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
              <Space>
                <span>单号: <strong>{currentRequest.request_no}</strong></span>
                <span>类型: {getTypeTag(currentRequest.type)}</span>
                <span>申请人: <Tag color="blue">{currentRequest.submitter_name}</Tag></span>
              </Space>
            </div>
            
            <Table
              dataSource={editingItems}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { 
                  title: '商品', 
                  dataIndex: 'product_name', 
                  key: 'product_name',
                  width: 200
                },
                { 
                  title: '单位', 
                  dataIndex: 'product_unit', 
                  key: 'product_unit',
                  width: 80,
                  render: (val) => val || '个'
                },
                { 
                  title: '数量', 
                  dataIndex: 'quantity', 
                  key: 'quantity',
                  width: 150,
                  render: (val, record) => (
                    <InputNumber
                      min={1}
                      value={val}
                      onChange={(v) => handleQuantityChange(record.id, v)}
                      style={{ width: 100 }}
                    />
                  )
                },
              ]}
            />

            <div style={{ marginTop: 16 }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="商家">{currentRequest.merchant || '-'}</Descriptions.Item>
                <Descriptions.Item label="收件人">{currentRequest.receiver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="地址" span={2}>{currentRequest.address || '-'}</Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        )}
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="申请详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          <Space>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            {/* 自购立牌没有商品可编辑 */}
            {currentRequest?.type !== 'self_purchase' && (
              <Button onClick={() => { setDetailVisible(false); showEdit(currentRequest); }}>
                编辑
              </Button>
            )}
            <Button danger onClick={() => { setDetailVisible(false); showReject(currentRequest); }}>
              拒绝
            </Button>
            <Button type="primary" onClick={() => { setDetailVisible(false); handleApprove(currentRequest); }}>
              通过
            </Button>
          </Space>
        }
        width={700}
      >
        {currentRequest && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="单号">{currentRequest.request_no}</Descriptions.Item>
            <Descriptions.Item label="类型">{getTypeTag(currentRequest.type)}</Descriptions.Item>
            
            {/* 商品明细 */}
            <Descriptions.Item label="商品明细" span={2}>
              {currentRequest.items && currentRequest.items.length > 0 ? (
                <Table
                  dataSource={currentRequest.items}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '商品', dataIndex: 'product_name', key: 'product_name' },
                    { title: '数量', dataIndex: 'quantity', key: 'quantity', render: (v, r) => `${v} ${r.product_unit || ''}` },
                  ]}
                />
              ) : (
                currentRequest.items_summary || '-'
              )}
            </Descriptions.Item>
            
            <Descriptions.Item label="申请人">
              <Tag color="blue">{currentRequest.submitter_name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="业务员">
              {currentRequest.salesman_name ? <Tag color="green">{currentRequest.salesman_name}</Tag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="商家" span={2}>{currentRequest.merchant || '-'}</Descriptions.Item>
            <Descriptions.Item label="收货地址" span={2}>{currentRequest.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="收件人">{currentRequest.receiver_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{currentRequest.receiver_phone || '-'}</Descriptions.Item>
            {(currentRequest.type === 'out' || currentRequest.type === 'self_purchase') && (
              <Descriptions.Item label="邮费承担">
                {currentRequest.shipping_fee === 'company' ? <Tag color="red">公司承担</Tag> : <Tag>到付</Tag>}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="申请时间">{dayjs(currentRequest.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{currentRequest.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 拒绝弹窗 */}
      <Modal
        title="拒绝申请"
        open={rejectVisible}
        onCancel={() => setRejectVisible(false)}
        onOk={handleReject}
        confirmLoading={approving}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 16 }}>
          确定要拒绝这个申请吗？
          {currentRequest && (
            <div style={{ marginTop: 8, color: '#666' }}>
              单号: {currentRequest.request_no}
              <br />
              商品: {currentRequest.items_summary || '-'}
            </div>
          )}
        </div>
        <Input.TextArea
          rows={3}
          placeholder="请输入拒绝原因"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
};

export default PendingApprovals;

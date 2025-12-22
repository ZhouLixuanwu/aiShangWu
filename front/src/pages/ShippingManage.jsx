import { useState, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Modal, Form, Input, Select, 
  message, Descriptions
} from 'antd';
import { EditOutlined, EyeOutlined, SearchOutlined, CopyOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

const ShippingManage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [detailVisible, setDetailVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [shippingStatus, setShippingStatus] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRequests();
  }, [pagination.current, pagination.pageSize, shippingStatus]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await request.get('/stock-requests/approved', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize,
          shippingStatus: shippingStatus,
          keyword: searchKeyword
        }
      });
      setRequests(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取已审批记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchRequests();
  };

  const showDetail = (record) => {
    setCurrentRequest(record);
    setDetailVisible(true);
  };

  const showEdit = (record) => {
    setCurrentRequest(record);
    // 优先使用原始申请中的收货信息，如果发货信息已填写则用发货信息
    form.setFieldsValue({
      shippingStatus: record.shipping_status || 'pending',
      trackingNo: record.tracking_no,
      courierCompany: record.courier_company,
      // 使用后端返回的原始地址和收货人信息
      shippingAddress: record.shipping_address || record.orig_address || record.address,
      receiverName: record.si_receiver_name || record.orig_receiver_name || record.receiver_name,
      receiverPhone: record.si_receiver_phone || record.orig_receiver_phone || record.receiver_phone,
      remark: record.shipping_remark
    });
    setEditVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await request.post(`/stock-requests/${currentRequest.id}/shipping`, values);
      message.success('发货信息更新成功');
      setEditVisible(false);
      fetchRequests();
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const getShippingStatus = (status) => {
    const statusMap = {
      pending: { color: 'gold', text: '待发货' },
      shipped: { color: 'blue', text: '已发货' },
      delivered: { color: 'green', text: '已签收' }
    };
    if (!status) return <Tag>未处理</Tag>;
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 获取类型标签
  const getTypeTag = (type) => {
    if (type === 'out') return <Tag color="orange">出库</Tag>;
    if (type === 'self_purchase') return <Tag color="purple">自购立牌</Tag>;
    return <Tag color="blue">入库</Tag>;
  };

  // 复制单条记录的地址信息
  const copyAddressInfo = (record) => {
    const receiverName = record.orig_receiver_name || record.receiver_name || '-';
    const receiverPhone = record.orig_receiver_phone || record.receiver_phone || '-';
    const address = record.orig_address || record.address || '-';
    const text = `${receiverName} ${receiverPhone} ${address}`;
    
    navigator.clipboard.writeText(text).then(() => {
      message.success('地址信息已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 批量复制选中记录的地址信息
  const copySelectedAddresses = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要复制的记录');
      return;
    }
    
    const selectedRecords = requests.filter(r => selectedRowKeys.includes(r.id));
    const textArr = selectedRecords.map(record => {
      const receiverName = record.orig_receiver_name || record.receiver_name || '-';
      const receiverPhone = record.orig_receiver_phone || record.receiver_phone || '-';
      const address = record.orig_address || record.address || '-';
      return `${receiverName} ${receiverPhone} ${address}`;
    });
    
    const text = textArr.join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      message.success(`已复制 ${selectedRecords.length} 条记录的地址信息`);
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
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
    // 兼容旧数据
    return record.items_summary || '-';
  };

  const columns = [
    // {
    //   title: '申请单号',
    //   dataIndex: 'request_no',
    //   key: 'request_no',
    //   width: 150,
    // },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 50,
      align: 'center',
      render: (type) => getTypeTag(type)
    },
    {
      title: '商品',
      key: 'items',
      width: 80,
      align: 'center',
      render: (_, record) => renderItems(record)
    },
    {
      title: '商务',
      dataIndex: 'submitter_name',
      key: 'submitter_name',
      width: 60,
      align: 'center',
      render: (val) => <Tag color="blue">{val}</Tag>
    },
    {
      title: '业务员',
      dataIndex: 'salesman_name',
      key: 'salesman_name',
      width: 65,
      align: 'center',
      render: (val) => val ? <Tag color="green">{val}</Tag> : '-'
    },
    {
      title: '商家',
      dataIndex: 'merchant',
      key: 'merchant',
      width: 90,
      align: 'center',
      render: (val) => val || '-'
    },
    {
      title: '收货人',
      key: 'receiver_info',
      width: 75,
      align: 'center',
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>{record.orig_receiver_name || record.receiver_name || '-'}</div>
          <div style={{ color: '#999' }}>{record.orig_receiver_phone || record.receiver_phone || '-'}</div>
        </div>
      )
    },
    {
      title: '邮费',
      dataIndex: 'shipping_fee',
      key: 'shipping_fee',
      width: 40,
      align: 'center',
      render: (val) => val === 'company' 
        ? <Tag color="red">公司</Tag> 
        : val === 'self_pickup' 
          ? <Tag color="green">业务自取</Tag> 
          : <Tag>到付</Tag>
    },
    {
      title: '状态',
      dataIndex: 'shipping_status',
      key: 'shipping_status',
      width: 60,
      align: 'center',
      render: (status) => getShippingStatus(status)
    },
    {
      title: '快递单号',
      dataIndex: 'tracking_no',
      key: 'tracking_no',
      width: 90,
      align: 'center',
      render: (val) => val || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
            详情
          </Button>
          <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => showEdit(record)}>
            发货
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">发货管理</span>
      </div>

      <div className="search-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Select
            placeholder="发货状态"
            value={shippingStatus}
            onChange={setShippingStatus}
            style={{ width: 150 }}
            allowClear
          >
            <Select.Option value="none">未处理</Select.Option>
            <Select.Option value="pending">待发货</Select.Option>
            <Select.Option value="shipped">已发货</Select.Option>
            <Select.Option value="delivered">已签收</Select.Option>
          </Select>
          <Input
            placeholder="搜索单号/商品/商家"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
          />
          <Button icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
        </Space>
        <Space>
          <Button 
            type="primary"
            icon={<CopyOutlined />} 
            onClick={copySelectedAddresses}
            disabled={selectedRowKeys.length === 0}
          >
            批量复制
          </Button>
        </Space>
      </div>

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={requests}
        rowKey="id"
        loading={loading}
        tableLayout="fixed"
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
        onChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))}
        scroll={{ x: 950 }}
      />

      <Modal
        title="申请详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {currentRequest && (
          <Descriptions bordered column={2}>
            {/* <Descriptions.Item label="申请单号">{currentRequest.request_no}</Descriptions.Item> */}
            <Descriptions.Item label="审批时间">{currentRequest.approved_at ? dayjs(currentRequest.approved_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            
            {/* 类型 */}
            <Descriptions.Item label="类型" span={2}>{getTypeTag(currentRequest.type)}</Descriptions.Item>
            
            {/* 商品明细 - 自购立牌没有商品 */}
            {currentRequest.type !== 'self_purchase' && (
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
            )}
            
            <Descriptions.Item label="商务">
              <Tag color="blue">{currentRequest.submitter_name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="业务员">
              {currentRequest.salesman_name ? <Tag color="green">{currentRequest.salesman_name}</Tag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="商家" span={2}>{currentRequest.merchant || '-'}</Descriptions.Item>
            <Descriptions.Item label="收货地址" span={2}>
              <Space>
                <span>{currentRequest.orig_address || currentRequest.address || '-'}</span>
                <Button 
                  type="default" 
                  size="small" 
                  icon={<CopyOutlined />}
                  onClick={() => copyAddressInfo(currentRequest)}
                >
                  复制
                </Button>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="收件人">{currentRequest.orig_receiver_name || currentRequest.receiver_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{currentRequest.orig_receiver_phone || currentRequest.receiver_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮费承担">
              {currentRequest.shipping_fee === 'company' 
                ? <Tag color="red">公司承担</Tag> 
                : currentRequest.shipping_fee === 'self_pickup'
                  ? <Tag color="green">业务自取</Tag>
                  : <Tag>到付</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="发货状态">{getShippingStatus(currentRequest.shipping_status)}</Descriptions.Item>
            <Descriptions.Item label="快递单号">{currentRequest.tracking_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="快递公司">{currentRequest.courier_company || '-'}</Descriptions.Item>
            <Descriptions.Item label="发货备注">{currentRequest.shipping_remark || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{currentRequest.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title="发货"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSubmit}
        okText="确认发货"
        width={600}
      >
        {currentRequest && (
          <div style={{ marginBottom: 16, padding: 12, background: currentRequest.type === 'self_purchase' ? '#f5f0ff' : '#f5f5f5', borderRadius: 6 }}>
            <div><strong>{currentRequest.type === 'self_purchase' ? '类型' : '商品'}：</strong>
            {currentRequest.type === 'self_purchase' 
              ? <span style={{ color: '#722ed1' }}>自购立牌 x{currentRequest.quantity}</span>
              : (currentRequest.items && currentRequest.items.length > 0 
                  ? currentRequest.items.map(item => `${item.product_name} x${item.quantity}`).join(', ')
                  : currentRequest.items_summary || '-')
            }</div>
            <div style={{ marginTop: 8, color: '#666' }}>
              <strong>商家：</strong>{currentRequest.merchant || '-'} | 
              <strong> 邮费：</strong>{currentRequest.shipping_fee === 'company' ? '公司承担' : currentRequest.shipping_fee === 'self_pickup' ? '业务自取' : '到付'}
            </div>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="courierCompany" label="快递公司">
            <Select allowClear placeholder="选择快递公司">
              <Select.Option value="顺丰">顺丰</Select.Option>
              <Select.Option value="圆通">圆通</Select.Option>
              <Select.Option value="中通">中通</Select.Option>
              <Select.Option value="韵达">韵达</Select.Option>
              <Select.Option value="申通">申通</Select.Option>
              <Select.Option value="EMS">EMS</Select.Option>
              <Select.Option value="京东物流">京东物流</Select.Option>
              <Select.Option value="其他">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="trackingNo" label="快递单号">
            <Input 
              placeholder="请输入快递单号" 
              onChange={(e) => {
                // 输入快递单号时自动设置状态为已发货
                if (e.target.value && e.target.value.trim()) {
                  form.setFieldValue('shippingStatus', 'shipped');
                }
              }}
            />
          </Form.Item>

          <Form.Item name="shippingStatus" label="发货状态">
            <Select>
              <Select.Option value="pending">待发货</Select.Option>
              <Select.Option value="shipped">已发货</Select.Option>
              <Select.Option value="delivered">已签收</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="shippingAddress" label="收货地址">
            <Input placeholder="收货地址" />
          </Form.Item>

          <Form.Item name="receiverName" label="收货人">
            <Input placeholder="收货人姓名" />
          </Form.Item>

          <Form.Item name="receiverPhone" label="收货人电话">
            <Input placeholder="收货人电话" />
          </Form.Item>

          <Form.Item name="remark" label="发货备注">
            <Input.TextArea rows={3} placeholder="发货备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShippingManage;

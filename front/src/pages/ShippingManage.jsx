import { useState, useEffect } from 'react';
import { 
  Table, Tag, Space, Button, Modal, Form, Input, Select, 
  message, Descriptions
} from 'antd';
import { EditOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
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
    form.setFieldsValue({
      shippingStatus: record.shipping_status || 'pending',
      trackingNo: record.tracking_no,
      courierCompany: record.courier_company,
      shippingAddress: record.shipping_address || record.address,
      receiverName: record.receiver_name,
      receiverPhone: record.receiver_phone,
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

  const columns = [
    {
      title: '申请单号',
      dataIndex: 'request_no',
      key: 'request_no',
      width: 150,
    },
    {
      title: '商品',
      dataIndex: 'product_name',
      key: 'product_name',
      width: 120,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 70,
      render: (val) => val
    },
    {
      title: '商务',
      dataIndex: 'submitter_name',
      key: 'submitter_name',
      width: 80,
      render: (val) => <Tag color="blue">{val}</Tag>
    },
    {
      title: '业务员',
      dataIndex: 'salesman_name',
      key: 'salesman_name',
      width: 80,
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
      title: '邮费',
      dataIndex: 'shipping_fee',
      key: 'shipping_fee',
      width: 70,
      render: (val) => val === 'company' ? <Tag color="red">公司</Tag> : <Tag>到付</Tag>
    },
    {
      title: '发货状态',
      dataIndex: 'shipping_status',
      key: 'shipping_status',
      width: 90,
      render: (status) => getShippingStatus(status)
    },
    {
      title: '快递单号',
      dataIndex: 'tracking_no',
      key: 'tracking_no',
      width: 130,
      render: (val) => val || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
            详情
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => showEdit(record)}>
            填写
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

      <div className="search-bar">
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
        scroll={{ x: 1300 }}
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
            <Descriptions.Item label="申请单号">{currentRequest.request_no}</Descriptions.Item>
            <Descriptions.Item label="商品">{currentRequest.product_name} x {currentRequest.quantity}</Descriptions.Item>
            <Descriptions.Item label="商务">
              <Tag color="blue">{currentRequest.submitter_name}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="业务员">
              {currentRequest.salesman_name ? <Tag color="green">{currentRequest.salesman_name}</Tag> : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="商家" span={2}>{currentRequest.merchant || '-'}</Descriptions.Item>
            <Descriptions.Item label="收货地址" span={2}>{currentRequest.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="收件人">{currentRequest.receiver_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{currentRequest.receiver_phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮费承担">
              {currentRequest.shipping_fee === 'company' ? <Tag color="red">公司承担</Tag> : <Tag>到付</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="审批时间">{currentRequest.approved_at ? dayjs(currentRequest.approved_at).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
            <Descriptions.Item label="发货状态">{getShippingStatus(currentRequest.shipping_status)}</Descriptions.Item>
            <Descriptions.Item label="快递单号">{currentRequest.tracking_no || '-'}</Descriptions.Item>
            <Descriptions.Item label="快递公司">{currentRequest.courier_company || '-'}</Descriptions.Item>
            <Descriptions.Item label="发货备注">{currentRequest.shipping_remark || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{currentRequest.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title="填写发货信息"
        open={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSubmit}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="shippingStatus" label="发货状态">
            <Select>
              <Select.Option value="pending">待发货</Select.Option>
              <Select.Option value="shipped">已发货</Select.Option>
              <Select.Option value="delivered">已签收</Select.Option>
            </Select>
          </Form.Item>

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
            <Input placeholder="请输入快递单号" />
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


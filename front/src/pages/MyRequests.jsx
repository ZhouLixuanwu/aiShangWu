import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Modal, Descriptions, DatePicker } from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const MyRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [dateRange, setDateRange] = useState([]);

  useEffect(() => {
    fetchRequests();
  }, [pagination.current, pagination.pageSize]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        my: '1'
      };

      if (dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const res = await request.get('/stock-requests', { params });
      setRequests(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取申请列表失败:', error);
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

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'gold', text: '待审批' },
      approved: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已拒绝' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getTypeTag = (type) => {
    return type === 'out' 
      ? <Tag color="orange">出库</Tag>
      : <Tag color="blue">入库</Tag>;
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

  // 渲染商品列表
  const renderItems = (record) => {
    if (record.items && record.items.length > 0) {
      return (
        <Space direction="vertical" size={0}>
          {record.items.map((item, index) => (
            <span key={index}>
              {item.product_name} x{item.quantity}
            </span>
          ))}
        </Space>
      );
    }
    // 兼容旧数据
    return record.items_summary || record.product_name || '-';
  };

  const columns = [
    {
      title: '申请单号',
      dataIndex: 'request_no',
      key: 'request_no',
      width: 180,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type) => getTypeTag(type)
    },
    {
      title: '商品',
      key: 'items',
      width: 200,
      render: (_, record) => renderItems(record)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => getStatusTag(status)
    },
    {
      title: '发货状态',
      dataIndex: 'shipping_status',
      key: 'shipping_status',
      width: 100,
      render: (status, record) => record.status === 'approved' && record.type === 'out' ? getShippingStatus(status) : '-'
    },
    {
      title: '快递单号',
      dataIndex: 'tracking_no',
      key: 'tracking_no',
      width: 150,
      render: (val) => val || '-'
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
          详情
        </Button>
      )
    }
  ];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">我的申请</span>
      </div>

      <div className="search-bar">
        <RangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder={['开始日期', '结束日期']}
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
        scroll={{ x: 1200 }}
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
            <Descriptions.Item label="状态">{getStatusTag(currentRequest.status)}</Descriptions.Item>
            <Descriptions.Item label="类型">{getTypeTag(currentRequest.type)}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{dayjs(currentRequest.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
            
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
            
            <Descriptions.Item label="商家" span={2}>{currentRequest.merchant || '-'}</Descriptions.Item>
            <Descriptions.Item label="地址" span={2}>{currentRequest.address || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{currentRequest.remark || '-'}</Descriptions.Item>
            
            {currentRequest.status !== 'pending' && (
              <>
                <Descriptions.Item label="审批人">{currentRequest.approver_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="审批时间">
                  {currentRequest.approved_at ? dayjs(currentRequest.approved_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                {currentRequest.status === 'rejected' && (
                  <Descriptions.Item label="拒绝原因" span={2}>{currentRequest.reject_reason || '-'}</Descriptions.Item>
                )}
              </>
            )}

            {currentRequest.status === 'approved' && currentRequest.type === 'out' && (
              <>
                <Descriptions.Item label="发货状态">{getShippingStatus(currentRequest.shipping_status)}</Descriptions.Item>
                <Descriptions.Item label="快递单号">{currentRequest.tracking_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="快递公司">{currentRequest.courier_company || '-'}</Descriptions.Item>
                <Descriptions.Item label="收货人">{currentRequest.receiver_name || '-'}</Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default MyRequests;

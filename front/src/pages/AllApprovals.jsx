import { useState, useEffect } from 'react';
import { Table, Tag, Space, Button, Modal, Descriptions, Input, Select, DatePicker } from 'antd';
import { EyeOutlined, SearchOutlined } from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const StockOverview = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  
  // 筛选条件
  const [filters, setFilters] = useState({
    type: '',
    keyword: '',
    dateRange: null
  });

  useEffect(() => {
    fetchRequests();
  }, [pagination.current, pagination.pageSize]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        pageSize: pagination.pageSize
      };
      
      if (filters.type) params.type = filters.type;
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.dateRange && filters.dateRange[0]) {
        params.startDate = filters.dateRange[0].format('YYYY-MM-DD');
        params.endDate = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const res = await request.get('/stock-requests', { params });
      setRequests(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取库存变动记录失败:', error);
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

  const getTypeTag = (type) => {
    return type === 'out' 
      ? <Tag color="orange">出库</Tag>
      : <Tag color="blue">入库</Tag>;
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
      dataIndex: 'product_name',
      key: 'product_name',
      width: 130,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      render: (val, record) => (
        <span style={{ color: record.type === 'out' ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
          {record.type === 'out' ? '-' : '+'}{val}
        </span>
      )
    },
    {
      title: '商务',
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
      width: 110,
      render: (val) => val || '-'
    },
    {
      title: '收件人',
      dataIndex: 'receiver_name',
      key: 'receiver_name',
      width: 80,
      render: (val) => val || '-'
    },
    {
      title: '邮费',
      dataIndex: 'shipping_fee',
      key: 'shipping_fee',
      width: 70,
      render: (val, record) => record.type === 'out' 
        ? (val === 'company' ? <Tag color="red">公司</Tag> : <Tag>到付</Tag>)
        : '-'
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (val) => dayjs(val).format('MM-DD HH:mm')
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
        <span className="page-card-title">库存变动总览</span>
        <Tag color="blue">共 {pagination.total} 条记录</Tag>
      </div>

      <div className="search-bar" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Select
          placeholder="类型"
          value={filters.type}
          onChange={(val) => setFilters(prev => ({ ...prev, type: val }))}
          style={{ width: 120 }}
          allowClear
        >
          <Select.Option value="out">出库</Select.Option>
          <Select.Option value="in">入库</Select.Option>
        </Select>
        <Input
          placeholder="搜索单号/商品/商家"
          value={filters.keyword}
          onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
          onPressEnter={handleSearch}
          style={{ width: 200 }}
        />
        <RangePicker 
          value={filters.dateRange}
          onChange={(dates) => setFilters(prev => ({ ...prev, dateRange: dates }))}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
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
        title="变动详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={700}
      >
        {currentRequest && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="单号">{currentRequest.request_no}</Descriptions.Item>
            <Descriptions.Item label="类型">{getTypeTag(currentRequest.type)}</Descriptions.Item>
            <Descriptions.Item label="商品">{currentRequest.product_name}</Descriptions.Item>
            <Descriptions.Item label="数量">
              <span style={{ color: currentRequest.type === 'out' ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
                {currentRequest.type === 'out' ? '-' : '+'}{currentRequest.quantity} {currentRequest.product_unit || '个'}
              </span>
            </Descriptions.Item>
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
            {currentRequest.type === 'out' && (
              <Descriptions.Item label="邮费承担">
                {currentRequest.shipping_fee === 'company' ? <Tag color="red">公司承担</Tag> : <Tag>到付</Tag>}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="时间">{dayjs(currentRequest.created_at).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{currentRequest.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default StockOverview;

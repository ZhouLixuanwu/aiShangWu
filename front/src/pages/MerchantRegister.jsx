import { useState, useEffect } from 'react';
import { 
  Card, Form, Input, Button, Upload, message, Table, Tag, 
  Image, Space, Modal, Descriptions, Row, Col, Tabs, Statistic
} from 'antd';
import { 
  UploadOutlined, PlusOutlined, ShopOutlined, 
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  UserOutlined, PhoneOutlined, FileTextOutlined, EyeOutlined
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const MerchantRegister = () => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [fileListFront, setFileListFront] = useState([]);
  const [fileListBack, setFileListBack] = useState([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
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
  }, [pagination.current, pagination.pageSize]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/merchant/my`, {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize
        },
        headers: getAuthHeaders()
      });
      const data = res.data;
      const list = data.data?.list || [];
      setRecords(list);
      setPagination(prev => ({ ...prev, total: data.data?.pagination?.total || 0 }));
      
      // 计算统计数据
      if (list.length > 0) {
        const pending = list.filter(r => r.status === 0).length;
        const approved = list.filter(r => r.status === 1).length;
        const rejected = list.filter(r => r.status === 2).length;
        setStats({
          total: data.data?.pagination?.total || list.length,
          pending,
          approved,
          rejected
        });
      }
    } catch (err) {
      console.error('获取记录失败:', err);
      message.error('获取记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    setUploading(true);
    try {
      const formData = new FormData();
      
      // 添加表单字段
      formData.append('phone', values.phone);
      formData.append('businessScope', values.businessScope);
      formData.append('businessName1', values.businessName1);
      if (values.businessName2) formData.append('businessName2', values.businessName2);
      if (values.businessName3) formData.append('businessName3', values.businessName3);
      formData.append('contactName', values.contactName);
      formData.append('contactPhone', values.contactPhone);
      
      // 添加身份证正面照片
      if (fileListFront.length > 0 && fileListFront[0].originFileObj) {
        formData.append('idCardFront', fileListFront[0].originFileObj);
      }
      
      // 添加身份证反面照片
      if (fileListBack.length > 0 && fileListBack[0].originFileObj) {
        formData.append('idCardBack', fileListBack[0].originFileObj);
      }

      await axios.post(`${API_BASE_URL}/merchant/register`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeaders()
        }
      });

      message.success('商家信息提交成功');
      form.resetFields();
      setFileListFront([]);
      setFileListBack([]);
      fetchRecords();
    } catch (err) {
      console.error('提交失败:', err);
      message.error(err.response?.data?.message || '提交失败');
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (file) => {
    if (!file.url && !file.preview) {
      file.preview = URL.createObjectURL(file.originFileObj);
    }
    setPreviewImage(file.url || file.preview);
    setPreviewVisible(true);
  };

  const handleChangeFront = ({ fileList: newFileList }) => {
    setFileListFront(newFileList);
  };
  
  const handleChangeBack = ({ fileList: newFileList }) => {
    setFileListBack(newFileList);
  };

  const showDetail = (record) => {
    setCurrentRecord(record);
    setDetailVisible(true);
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
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
          详情
        </Button>
      ),
    },
  ];

  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>上传照片</div>
    </div>
  );

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">
          <ShopOutlined style={{ marginRight: 8 }} />
          办理营业执照
        </span>
      </div>

      <Tabs
        defaultActiveKey="submit"
        items={[
          {
            key: 'submit',
            label: '提交信息',
            children: (
              <Card>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSubmit}
                  style={{ maxWidth: 800 }}
                >
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="phone"
                        label="经营者手机号"
                        rules={[
                          { required: true, message: '请输入经营者手机号' },
                          { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式' }
                        ]}
                      >
                        <Input 
                          prefix={<PhoneOutlined />} 
                          placeholder="请输入经营者手机号" 
                          maxLength={11}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="businessScope"
                        label="营业范围"
                        rules={[{ required: true, message: '请输入营业范围' }]}
                      >
                        <Input 
                          prefix={<FileTextOutlined />} 
                          placeholder="如：日用品、服装、电子产品等" 
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="businessName1"
                    label="个体户名称（首选）"
                    rules={[{ required: true, message: '请输入首选个体户名称' }]}
                    extra="请填写您想注册的个体户名称，我们会按顺序为您核名"
                  >
                    <Input 
                      prefix={<ShopOutlined />} 
                      placeholder="请输入首选个体户名称" 
                    />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="businessName2"
                        label="个体户名称（备选1）"
                      >
                        <Input placeholder="请输入备选个体户名称" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="businessName3"
                        label="个体户名称（备选2）"
                      >
                        <Input placeholder="请输入备选个体户名称" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="contactName"
                        label="联系人姓名"
                        rules={[{ required: true, message: '请输入联系人姓名' }]}
                      >
                        <Input 
                          prefix={<UserOutlined />} 
                          placeholder="请输入联系人姓名" 
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="contactPhone"
                        label="联系人电话"
                        rules={[
                          { required: true, message: '请输入联系人电话' },
                          { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号格式' }
                        ]}
                      >
                        <Input 
                          prefix={<PhoneOutlined />} 
                          placeholder="请输入联系人电话" 
                          maxLength={11}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="身份证正面（人像面）"
                        extra="请上传身份证正面的清晰照片"
                      >
                        <Upload
                          listType="picture-card"
                          fileList={fileListFront}
                          onPreview={handlePreview}
                          onChange={handleChangeFront}
                          beforeUpload={() => false}
                          maxCount={1}
                          accept="image/*"
                        >
                          {fileListFront.length >= 1 ? null : uploadButton}
                        </Upload>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="身份证反面（国徽面）"
                        extra="请上传身份证反面的清晰照片"
                      >
                        <Upload
                          listType="picture-card"
                          fileList={fileListBack}
                          onPreview={handlePreview}
                          onChange={handleChangeBack}
                          beforeUpload={() => false}
                          maxCount={1}
                          accept="image/*"
                        >
                          {fileListBack.length >= 1 ? null : uploadButton}
                        </Upload>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item>
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={uploading}
                      icon={<UploadOutlined />}
                      size="large"
                    >
                      提交商家信息
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            ),
          },
          {
            key: 'records',
            label: `我的提交记录 (${stats.total})`,
            children: (
              <Card>
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col xs={8}>
                    <Statistic 
                      title="待审核" 
                      value={stats.pending} 
                      valueStyle={{ color: '#1677ff' }}
                    />
                  </Col>
                  <Col xs={8}>
                    <Statistic 
                      title="已通过" 
                      value={stats.approved} 
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col xs={8}>
                    <Statistic 
                      title="已拒绝" 
                      value={stats.rejected} 
                      valueStyle={{ color: '#ff4d4f' }}
                    />
                  </Col>
                </Row>
                
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
                  scroll={{ x: 600 }}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 预览图片 */}
      <Modal
        open={previewVisible}
        title="预览图片"
        footer={null}
        onCancel={() => setPreviewVisible(false)}
      >
        <img alt="preview" style={{ width: '100%' }} src={previewImage} />
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        open={detailVisible}
        title="商家信息详情"
        footer={null}
        onCancel={() => setDetailVisible(false)}
        width={600}
      >
        {currentRecord && (
          <Descriptions column={isMobile ? 1 : 2} bordered size="small">
            <Descriptions.Item label="经营者手机号">{currentRecord.phone}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(currentRecord.status)}</Descriptions.Item>
            <Descriptions.Item label="营业范围" span={2}>{currentRecord.business_scope}</Descriptions.Item>
            <Descriptions.Item label="首选名称">{currentRecord.business_name_1}</Descriptions.Item>
            <Descriptions.Item label="备选名称1">{currentRecord.business_name_2 || '-'}</Descriptions.Item>
            <Descriptions.Item label="备选名称2" span={2}>{currentRecord.business_name_3 || '-'}</Descriptions.Item>
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
                        width={180}
                        style={{ borderRadius: 8 }}
                      />
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>正面（人像面）</div>
                    </div>
                  )}
                  {currentRecord.idCardBackUrl && (
                    <div style={{ textAlign: 'center' }}>
                      <Image 
                        src={currentRecord.idCardBackUrl} 
                        width={180}
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
    </div>
  );
};

export default MerchantRegister;


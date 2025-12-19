import { useState, useEffect } from 'react';
import { 
  Card, Select, DatePicker, List, Tag, Image, Space, 
  Button, Modal, Form, Input, Empty, Badge, Segmented, message, Spin
} from 'antd';
import { 
  PictureOutlined, VideoCameraOutlined, EditOutlined, 
  CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined
} from '@ant-design/icons';
import request from '../utils/request';
import dayjs from 'dayjs';
import VideoPlayer from '../components/VideoPlayer';

const { TextArea } = Input;

// 文案分类选项
const CATEGORY_OPTIONS = [
  { value: 'product', label: '产品推广', color: 'blue' },
  { value: 'activity', label: '活动宣传', color: 'orange' },
  { value: 'daily', label: '日常分享', color: 'green' },
  { value: 'festival', label: '节日祝福', color: 'red' },
  { value: 'other', label: '其他', color: 'default' },
];

const MediaCopywriting = () => {
  const [salesmen, setSalesmen] = useState([]);
  const [selectedSalesman, setSelectedSalesman] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [copywritingFilter, setCopywritingFilter] = useState('all'); // all, with, without
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  
  // 文案编辑相关
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateCategory, setTemplateCategory] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSalesmen();
    fetchTemplates();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [selectedDate, selectedSalesman, copywritingFilter, pagination.current]);

  const fetchSalesmen = async () => {
    try {
      const res = await request.get('/users/my-salesmen');
      setSalesmen(res.data || []);
    } catch (error) {
      console.error('获取业务员列表失败:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await request.get('/copywriting/templates');
      setTemplates(res.data || []);
    } catch (error) {
      console.error('获取文案模版失败:', error);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = {
        date: selectedDate.format('YYYY-MM-DD'),
        page: pagination.current,
        pageSize: pagination.pageSize,
        copywritingFilter
      };
      if (selectedSalesman) {
        params.salesmanId = selectedSalesman;
      }

      const res = await request.get('/copywriting/media-list', { params });
      setRecords(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取素材列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCopywriting = (media) => {
    setCurrentMedia(media);
    setSelectedTemplate(null);
    setTemplateCategory(null);
    form.setFieldsValue({
      copywriting: media.copywriting || ''
    });
    setModalVisible(true);
  };

  const handleTemplateSelect = (templateId) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      form.setFieldsValue({
        copywriting: template.content
      });
    }
  };

  const handleSaveCopywriting = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      
      await request.put(`/copywriting/media/${currentMedia.id}`, {
        copywriting: values.copywriting,
        templateId: selectedTemplate
      });
      
      message.success('保存成功');
      setModalVisible(false);
      fetchRecords();
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const getFilteredTemplates = () => {
    if (!templateCategory) return templates;
    return templates.filter(t => t.category === templateCategory);
  };

  // 统计
  const withCopywriting = records.filter(r => r.copywriting).length;
  const withoutCopywriting = records.filter(r => !r.copywriting).length;

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">素材文案</span>
        <Space wrap>
          <DatePicker 
            value={selectedDate} 
            onChange={(date) => {
              setSelectedDate(date);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            allowClear={false}
            disabledDate={(current) => current && current > dayjs().endOf('day')}
          />
          <Select
            placeholder="筛选业务员"
            value={selectedSalesman}
            onChange={(val) => {
              setSelectedSalesman(val);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            style={{ width: 140 }}
            allowClear
          >
            {salesmen.map(s => (
              <Select.Option key={s.id} value={s.id}>
                {s.realName || s.username}
              </Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      {/* 筛选和统计 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Segmented
            value={copywritingFilter}
            onChange={(val) => {
              setCopywritingFilter(val);
              setPagination(prev => ({ ...prev, current: 1 }));
            }}
            options={[
              { label: '全部', value: 'all' },
              { 
                label: (
                  <Space>
                    <span>已配文案</span>
                    <Badge count={withCopywriting} color="#52c41a" showZero />
                  </Space>
                ), 
                value: 'with' 
              },
              { 
                label: (
                  <Space>
                    <span>未配文案</span>
                    <Badge count={withoutCopywriting} color="#ff4d4f" showZero />
                  </Space>
                ), 
                value: 'without' 
              },
            ]}
          />
          <Space>
            <Tag icon={<CheckCircleOutlined />} color="success">已配: {withCopywriting}</Tag>
            <Tag icon={<CloseCircleOutlined />} color="error">未配: {withoutCopywriting}</Tag>
          </Space>
        </div>
      </Card>

      {/* 素材列表 */}
      <Card>
        {records.length === 0 && !loading ? (
          <Empty description="该条件下没有素材" />
        ) : (
          <Spin spinning={loading}>
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 5 }}
              dataSource={records}
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
                      <div style={{ position: 'relative' }}>
                        {item.file_type === 'video' ? (
                          <VideoPlayer 
                            src={item.url} 
                            maxHeight={160}
                            style={{ background: '#f5f5f5' }}
                          />
                        ) : (
                          <Image
                            src={item.url}
                            alt={item.file_name}
                            style={{ height: 160, objectFit: 'cover', width: '100%' }}
                            placeholder
                          />
                        )}
                        {/* 文案状态标记 */}
                        <div style={{ 
                          position: 'absolute', 
                          top: 8, 
                          right: 8 
                        }}>
                          {item.copywriting ? (
                            <Tag icon={<FileTextOutlined />} color="success">已配</Tag>
                          ) : (
                            <Tag icon={<CloseCircleOutlined />} color="error">未配</Tag>
                          )}
                        </div>
                      </div>
                    }
                    actions={[
                      <Button 
                        key="edit"
                        type="link" 
                        icon={<EditOutlined />}
                        onClick={() => handleEditCopywriting(item)}
                      >
                        {item.copywriting ? '编辑文案' : '配文案'}
                      </Button>
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
                        <div>
                          <div style={{ fontSize: 11, color: '#999' }}>
                            {dayjs(item.created_at).format('HH:mm')}
                          </div>
                          {item.copywriting && (
                            <div style={{ 
                              fontSize: 12, 
                              color: '#666', 
                              marginTop: 4,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {item.copywriting.substring(0, 30)}...
                            </div>
                          )}
                        </div>
                      }
                    />
                  </Card>
                </List.Item>
              )}
            />
          </Spin>
        )}
      </Card>

      {/* 编辑文案弹窗 */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>配置文案</span>
            {currentMedia && (
              <Tag color="blue">{currentMedia.user_name}</Tag>
            )}
          </Space>
        }
        open={modalVisible}
        onOk={handleSaveCopywriting}
        onCancel={() => setModalVisible(false)}
        width={700}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
      >
        {currentMedia && (
          <div style={{ display: 'flex', gap: 16 }}>
            {/* 左侧：素材预览 */}
            <div style={{ width: 200, flexShrink: 0 }}>
              {currentMedia.file_type === 'video' ? (
                <VideoPlayer 
                  src={currentMedia.url} 
                  maxHeight={200}
                  style={{ borderRadius: 8 }}
                />
              ) : (
                <Image
                  src={currentMedia.url}
                  alt={currentMedia.file_name}
                  style={{ width: '100%', borderRadius: 8 }}
                />
              )}
              <div style={{ marginTop: 8, fontSize: 12, color: '#999', textAlign: 'center' }}>
                {currentMedia.file_name}
              </div>
            </div>

            {/* 右侧：文案编辑 */}
            <div style={{ flex: 1 }}>
              {/* 模版选择 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>选择模版：</div>
                <Space style={{ marginBottom: 8 }}>
                  <Select
                    placeholder="按分类筛选"
                    value={templateCategory}
                    onChange={setTemplateCategory}
                    style={{ width: 120 }}
                    allowClear
                    size="small"
                  >
                    {CATEGORY_OPTIONS.map(c => (
                      <Select.Option key={c.value} value={c.value}>
                        {c.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Space>
                <Select
                  placeholder="选择文案模版快速填充"
                  value={selectedTemplate}
                  onChange={handleTemplateSelect}
                  style={{ width: '100%' }}
                  allowClear
                >
                  {getFilteredTemplates().map(t => (
                    <Select.Option key={t.id} value={t.id}>
                      <div>
                        <span>{t.title}</span>
                        <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
                          {t.content.substring(0, 30)}...
                        </span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </div>

              {/* 文案输入 */}
              <Form form={form} layout="vertical">
                <Form.Item
                  name="copywriting"
                  label="文案内容"
                  rules={[{ required: true, message: '请输入文案' }]}
                >
                  <TextArea 
                    rows={8} 
                    placeholder="输入或编辑文案内容"
                    showCount
                    maxLength={2000}
                  />
                </Form.Item>
              </Form>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MediaCopywriting;

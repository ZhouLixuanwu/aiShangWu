import { useState, useEffect } from 'react';
import { 
  Card, Table, Button, Modal, Form, Input, Select, 
  Tag, Space, Popconfirm, message, Empty
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined 
} from '@ant-design/icons';
import request from '../utils/request';

const { TextArea } = Input;

// 文案分类选项
const CATEGORY_OPTIONS = [
  { value: 'product', label: '产品推广', color: 'blue' },
  { value: 'activity', label: '活动宣传', color: 'orange' },
  { value: 'daily', label: '日常分享', color: 'green' },
  { value: 'festival', label: '节日祝福', color: 'red' },
  { value: 'other', label: '其他', color: 'default' },
];

const CopywritingLibrary = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form] = Form.useForm();
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, [selectedCategory]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory) {
        params.category = selectedCategory;
      }
      const res = await request.get('/copywriting/templates', { params });
      setTemplates(res.data || []);
    } catch (error) {
      console.error('获取文案模版失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTemplate(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingTemplate(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await request.delete(`/copywriting/templates/${id}`);
      message.success('删除成功');
      fetchTemplates();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content);
    message.success('已复制到剪贴板');
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingTemplate) {
        await request.put(`/copywriting/templates/${editingTemplate.id}`, values);
        message.success('更新成功');
      } else {
        await request.post('/copywriting/templates', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      fetchTemplates();
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const getCategoryInfo = (category) => {
    return CATEGORY_OPTIONS.find(c => c.value === category) || { label: category, color: 'default' };
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (val) => {
        const info = getCategoryInfo(val);
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    },
    {
      title: '文案内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (val) => (
        <div style={{ 
          whiteSpace: 'pre-wrap', 
          maxHeight: 80, 
          overflow: 'hidden',
          color: '#666'
        }}>
          {val}
        </div>
      )
    },
    {
      title: '使用次数',
      dataIndex: 'use_count',
      key: 'use_count',
      width: 90,
      render: (val) => <span style={{ color: '#1677ff' }}>{val || 0}</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopy(record.content)}
          >
            复制
          </Button>
          <Button 
            type="link" 
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此文案模版？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">文案库</span>
        <Space>
          <Select
            placeholder="筛选分类"
            value={selectedCategory}
            onChange={setSelectedCategory}
            style={{ width: 120 }}
            allowClear
          >
            {CATEGORY_OPTIONS.map(c => (
              <Select.Option key={c.value} value={c.value}>
                {c.label}
              </Select.Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增文案
          </Button>
        </Space>
      </div>

      <Card>
        {templates.length === 0 && !loading ? (
          <Empty description="暂无文案模版，点击上方按钮添加" />
        ) : (
          <Table
            columns={columns}
            dataSource={templates}
            rowKey="id"
            loading={loading}
            pagination={{
              showTotal: (total) => `共 ${total} 条`,
              showSizeChanger: true,
              defaultPageSize: 10
            }}
          />
        )}
      </Card>

      <Modal
        title={editingTemplate ? '编辑文案' : '新增文案'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="给文案起个名字，方便查找" maxLength={50} />
          </Form.Item>
          
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              {CATEGORY_OPTIONS.map(c => (
                <Select.Option key={c.value} value={c.value}>
                  {c.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="content"
            label="文案内容"
            rules={[{ required: true, message: '请输入文案内容' }]}
          >
            <TextArea 
              rows={6} 
              placeholder="输入文案内容，支持emoji和换行"
              showCount
              maxLength={2000}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CopywritingLibrary;

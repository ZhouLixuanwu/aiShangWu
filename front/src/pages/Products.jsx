import { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, InputNumber, Select, 
  Space, Tag, message, Popconfirm
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import request from '../utils/request';
import useUserStore from '../store/userStore';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [form] = Form.useForm();
  const { hasPermission } = useUserStore();
  const canManage = hasPermission('inventory_manage');

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [pagination.current, pagination.pageSize]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await request.get('/products', {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize,
          keyword: searchKeyword
        }
      });
      setProducts(res.data.list || []);
      setPagination(prev => ({ ...prev, total: res.data.pagination.total }));
    } catch (error) {
      console.error('获取商品列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await request.get('/products/categories');
      setCategories(res.data || []);
    } catch (error) {
      console.error('获取分类失败:', error);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchProducts();
  };

  const handleAdd = () => {
    setEditingProduct(null);
    form.resetFields();
    form.setFieldsValue({ status: 1, unit: '个', stock: 0, minStock: 0, price: 0, category: null });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingProduct(record);
    form.setFieldsValue({
      name: record.name,
      sku: record.sku,
      category: record.category,
      unit: record.unit,
      price: record.price,
      stock: record.stock,
      minStock: record.min_stock,
      description: record.description,
      status: record.status
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await request.delete(`/products/${id}`);
      message.success('删除成功');
      fetchProducts();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingProduct) {
        await request.put(`/products/${editingProduct.id}`, values);
        message.success('更新成功');
      } else {
        await request.post('/products', values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      fetchProducts();
      fetchCategories();
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  const columns = [
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    // {
    //   title: 'SKU',
    //   dataIndex: 'sku',
    //   key: 'sku',
    //   width: 120,
    // },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      render: (val, record) => (
        <span style={{ color: val <= (record.min_stock || 0) ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
          {val}
        </span>
      )
    },
    // {
    //   title: '分类',
    //   dataIndex: 'category',
    //   key: 'category',
    //   width: 100,
    // },
    {
      title: '单位',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      render: (val) => `¥${Number(val || 0).toFixed(2)}`
    },

    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val) => (
        <Tag color={val === 1 ? 'green' : 'default'}>
          {val === 1 ? '上架' : '下架'}
        </Tag>
      )
    },
    canManage && {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此商品？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ].filter(Boolean);

  return (
    <div className="page-card">
      <div className="page-card-header">
        <span className="page-card-title">商品管理</span>
        {canManage && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加商品
          </Button>
        )}
      </div>

      <div className="search-bar">
        <Input
          placeholder="搜索商品名称或SKU"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 300 }}
          suffix={<SearchOutlined onClick={handleSearch} style={{ cursor: 'pointer' }} />}
        />
        <Button onClick={handleSearch}>搜索</Button>
      </div>

      <Table
        columns={columns}
        dataSource={products}
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
        title={editingProduct ? '编辑商品' : '添加商品'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="商品名称"
            rules={[{ required: true, message: '请输入商品名称' }]}
          >
            <Input placeholder="请输入商品名称" />
          </Form.Item>

          {/* <Form.Item name="sku" label="商品编码">
            <Input placeholder="请输入SKU编码" />
          </Form.Item> */}

          {/* <Form.Item name="category" label="分类">
            <Select
              placeholder="选择或输入分类"
              allowClear
              showSearch
            >
              {categories.map(cat => (
                <Select.Option key={cat} value={cat}>{cat}</Select.Option>
              ))}
            </Select>
          </Form.Item> */}

          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="unit" label="单位" style={{ width: 120 }}>
              <Input placeholder="个" />
            </Form.Item>

            <Form.Item name="price" label="单价" style={{ width: 150 }}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="stock" label="库存" style={{ width: 120 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="minStock" label="最低库存" style={{ width: 120 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="商品描述" />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select defaultValue={1}>
              <Select.Option value={1}>上架</Select.Option>
              <Select.Option value={0}>下架</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;


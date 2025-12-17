import { useState, useEffect } from 'react';
import { 
  Form, Select, InputNumber, Input, Button, Card, 
  message, Result, Divider, Space, Empty, Radio
} from 'antd';
import { SendOutlined, ShoppingOutlined, PlusCircleOutlined, MinusCircleOutlined, UserOutlined, EnvironmentOutlined } from '@ant-design/icons';
import request from '../utils/request';
import useUserStore from '../store/userStore';

const StockRequests = () => {
  const [products, setProducts] = useState([]);
  const [salesmen, setSalesmen] = useState([]); // 下属业务员列表
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedNo, setSubmittedNo] = useState('');
  const [form] = Form.useForm();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeType, setActiveType] = useState(null); // 当前操作类型
  const { hasPermission } = useUserStore();

  // 权限检查
  const canAdd = hasPermission('stock_add');
  const canReduce = hasPermission('stock_reduce');

  useEffect(() => {
    fetchProducts();
    fetchSalesmen();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await request.get('/products/all');
      setProducts(res.data || []);
    } catch (error) {
      console.error('获取商品列表失败:', error);
    }
  };

  // 获取下属业务员列表
  const fetchSalesmen = async () => {
    try {
      const res = await request.get('/users/my-salesmen');
      setSalesmen(res.data || []);
    } catch (error) {
      console.error('获取业务员列表失败:', error);
    }
  };

  const handleProductChange = (productId) => {
    const product = products.find(p => p.id === productId);
    setSelectedProduct(product);
  };

  const handleSubmit = async (values) => {
    if (!activeType) {
      message.error('请选择操作类型');
      return;
    }
    setLoading(true);
    try {
      const submitData = {
        productId: values.productId,
        quantity: values.quantity,
        type: activeType,
        merchant: values.merchant,
        address: values.address,
        receiverName: values.receiverName,
        receiverPhone: values.receiverPhone,
        shippingFee: values.shippingFee,
        remark: values.remark
      };
      
      // 出库时添加业务员ID
      if (activeType === 'out' && values.salesmanId) {
        submitData.salesmanId = values.salesmanId;
      }
      
      const res = await request.post('/stock-requests', submitData);
      
      setSubmittedNo(res.data.requestNo);
      setSubmitted(true);
      message.success('操作成功');
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 选择操作类型
  const handleSelectType = (type) => {
    setActiveType(type);
    form.resetFields();
    setSelectedProduct(null);
  };

  const handleReset = () => {
    form.resetFields();
    setSubmitted(false);
    setSubmittedNo('');
    setSelectedProduct(null);
    setActiveType(null);
  };

  // 提交成功页面
  if (submitted) {
    return (
      <div className="page-card">
        <Result
          status="success"
          title="操作成功！"
          subTitle={`申请单号: ${submittedNo}，库存已更新。`}
          extra={[
            <Button type="primary" key="new" onClick={handleReset}>
              继续操作
            </Button>,
          ]}
        />
      </div>
    );
  }

  // 没有任何权限
  if (!canAdd && !canReduce) {
    return (
      <div className="page-card">
        <Empty description="您没有物料增减权限，请联系管理员" />
      </div>
    );
  }

  // 选择操作类型页面
  if (!activeType) {
    return (
      <div className="page-card">
        <div className="page-card-header">
          <span className="page-card-title">库存变动</span>
        </div>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', padding: '40px 0' }}>
          {canReduce && (
            <Card 
              hoverable 
              style={{ width: 240, textAlign: 'center' }}
              onClick={() => handleSelectType('out')}
            >
              <MinusCircleOutlined style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }} />
              <h3 style={{ margin: 0 }}>出库（减少库存）</h3>
              <p style={{ color: '#999', marginTop: 8 }}>销售、调拨、损耗等</p>
            </Card>
          )}
          {canAdd && (
            <Card 
              hoverable 
              style={{ width: 240, textAlign: 'center' }}
              onClick={() => handleSelectType('in')}
            >
              <PlusCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
              <h3 style={{ margin: 0 }}>入库（增加库存）</h3>
              <p style={{ color: '#999', marginTop: 8 }}>采购、退货入库等</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // 商品选项（用于搜索过滤）
  const productOptions = products.map(p => ({
    value: p.id,
    label: `${p.name} - 库存: ${p.stock} ${p.unit}`
  }));

  // 业务员选项
  const salesmenOptions = salesmen.map(s => ({
    value: s.id,
    label: s.realName || s.username
  }));

  // 出库时是否需要选择业务员（有下属业务员时才显示）
  const needSelectSalesman = activeType === 'out' && salesmen.length > 0;

  return (
    <div className="page-card">
      <div className="page-card-header">
        <Space>
          <Button onClick={() => setActiveType(null)}>← 返回</Button>
          <span className="page-card-title">
            {activeType === 'out' ? (
              <><MinusCircleOutlined style={{ color: '#ff4d4f' }} /> 出库（减少库存）</>
            ) : (
              <><PlusCircleOutlined style={{ color: '#52c41a' }} /> 入库（增加库存）</>
            )}
          </span>
        </Space>
      </div>

      <Card style={{ maxWidth: 600 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {/* 出库时选择业务员 */}
          {needSelectSalesman && (
            <Form.Item
              name="salesmanId"
              label={<><UserOutlined /> 发起业务员</>}
              rules={[{ required: true, message: '请选择发起出库的业务员' }]}
            >
              <Select
                showSearch
                placeholder="选择发起此次出库的业务员"
                optionFilterProp="label"
                options={salesmenOptions}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          )}

          <Form.Item
            name="productId"
            label="选择商品"
            rules={[{ required: true, message: '请选择商品' }]}
          >
            <Select
              showSearch
              placeholder="搜索选择商品"
              optionFilterProp="label"
              onChange={handleProductChange}
              options={productOptions}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          {selectedProduct && (
            <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
              <Space>
                <ShoppingOutlined />
                <span>当前库存: <strong>{selectedProduct.stock}</strong> {selectedProduct.unit}</span>
              </Space>
            </Card>
          )}

          <Form.Item
            name="quantity"
            label="数量"
            rules={[
              { required: true, message: '请输入数量' },
              { type: 'number', min: 1, message: '数量必须大于0' }
            ]}
          >
            <InputNumber 
              min={1} 
              style={{ width: '100%' }} 
              placeholder="请输入变动数量"
            />
          </Form.Item>

          <Divider><EnvironmentOutlined /> 收货信息</Divider>

          <Form.Item name="merchant" label="商家名称">
            <Input placeholder="商家/客户名称" />
          </Form.Item>

          <Form.Item name="address" label="收货地址">
            <Input.TextArea rows={2} placeholder="详细收货地址" />
          </Form.Item>

          <Form.Item name="receiverName" label="收件人">
            <Input placeholder="收件人姓名" />
          </Form.Item>

          <Form.Item name="receiverPhone" label="联系电话">
            <Input placeholder="收件人电话" />
          </Form.Item>

          {activeType === 'out' && (
            <Form.Item name="shippingFee" label="邮费承担" initialValue="receiver">
              <Radio.Group>
                <Radio.Button value="receiver">到付（客户承担）</Radio.Button>
                <Radio.Button value="company">公司承担</Radio.Button>
              </Radio.Group>
            </Form.Item>
          )}

          <Form.Item name="remark" label="备注">
            <Input.TextArea 
              rows={2} 
              placeholder="其他需要说明的信息"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              icon={<SendOutlined />}
              size="large"
              block
              danger={activeType === 'out'}
            >
              {activeType === 'out' ? '确认出库' : '确认入库'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default StockRequests;


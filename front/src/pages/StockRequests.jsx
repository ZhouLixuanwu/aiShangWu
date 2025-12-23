import { useState, useEffect } from 'react';
import { 
  Form, Select, InputNumber, Input, Button, Card, 
  message, Result, Divider, Space, Empty, Radio, Table, Tag
} from 'antd';
import { SendOutlined, ShoppingOutlined, PlusCircleOutlined, MinusCircleOutlined, UserOutlined, EnvironmentOutlined, DeleteOutlined, PlusOutlined, GiftOutlined, ThunderboltOutlined } from '@ant-design/icons';
import AddressParse from 'address-parse';
import request from '../utils/request';
import useUserStore from '../store/userStore';

// 智能解析地址信息
const parseAddressInfo = (text) => {
  if (!text || typeof text !== 'string') {
    return null;
  }
  
  // 清理文本，移除多余空白
  let cleanText = text.trim();
  
  // 尝试提取格式化的信息（带标签的格式）
  let name = '';
  let phone = '';
  let address = '';
  
  // 匹配 "收件人: xxx" 或 "姓名: xxx" 格式
  const nameMatch = cleanText.match(/(?:收件人|姓名|收货人|联系人)[：:]\s*([^\n\r,，]+)/);
  if (nameMatch) {
    name = nameMatch[1].trim();
  }
  
  // 匹配 "手机号码: xxx" 或 "电话: xxx" 格式
  const phoneMatch = cleanText.match(/(?:手机号码|手机|电话|联系电话|手机号|联系方式)[：:]\s*([0-9\-]+)/);
  if (phoneMatch) {
    phone = phoneMatch[1].trim();
  }
  
  // 匹配 "详细地址: xxx" 格式
  const detailMatch = cleanText.match(/(?:详细地址|地址)[：:]\s*([^\n\r]+)/);
  // 匹配 "所在地区: xxx" 格式
  const areaMatch = cleanText.match(/(?:所在地区|省市区|地区)[：:]\s*([^\n\r]+)/);
  
  if (detailMatch || areaMatch) {
    // 组合地区和详细地址
    const area = areaMatch ? areaMatch[1].trim() : '';
    const detail = detailMatch ? detailMatch[1].trim() : '';
    address = area + detail;
  }
  
  // 如果格式化匹配成功
  if (name && phone && address) {
    return { name, phone, address };
  }
  
  // 使用 address-parse 库进行智能解析
  try {
    const results = AddressParse.parse(cleanText);
    if (results && results.length > 0) {
      const result = results[0];
      return {
        name: result.name || '',
        phone: result.mobile || result.phone || '',
        address: [
          result.province || '',
          result.city || '',
          result.area || '',
          result.details || ''
        ].filter(Boolean).join('')
      };
    }
  } catch (e) {
    console.error('address-parse 解析错误:', e);
  }
  
  // 如果 address-parse 也无法解析，尝试手动提取
  // 提取手机号（11位数字，以1开头）
  const mobileMatch = cleanText.match(/1[3-9]\d{9}/);
  if (mobileMatch) {
    phone = mobileMatch[0];
    cleanText = cleanText.replace(phone, ' ');
  }
  
  // 提取座机号
  if (!phone) {
    const telMatch = cleanText.match(/(\d{3,4}[-\s]?\d{7,8})/);
    if (telMatch) {
      phone = telMatch[0];
      cleanText = cleanText.replace(phone, ' ');
    }
  }
  
  // 剩余文本尝试分离姓名和地址
  // 中国人名一般2-4个字，通常在开头或结尾
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  // 尝试从开头匹配姓名（2-4个汉字）
  const nameStartMatch = cleanText.match(/^([\u4e00-\u9fa5]{2,4})\s*/);
  if (nameStartMatch && !name) {
    name = nameStartMatch[1];
    address = cleanText.slice(nameStartMatch[0].length).trim();
  } else if (!name) {
    // 尝试从结尾匹配姓名
    const nameEndMatch = cleanText.match(/\s*([\u4e00-\u9fa5]{2,4})$/);
    if (nameEndMatch) {
      name = nameEndMatch[1];
      address = cleanText.slice(0, -nameEndMatch[0].length).trim();
    } else {
      // 无法区分，全部作为地址
      address = cleanText;
    }
  }
  
  // 如果还没有地址，使用清理后的文本
  if (!address) {
    address = cleanText;
  }
  
  return { name, phone, address };
};

const StockRequests = () => {
  const [products, setProducts] = useState([]);
  const [salesmen, setSalesmen] = useState([]); // 下属业务员列表
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedNo, setSubmittedNo] = useState('');
  const [submittedSummary, setSubmittedSummary] = useState('');
  const [form] = Form.useForm();
  const [activeType, setActiveType] = useState(null); // 当前操作类型
  const { hasPermission } = useUserStore();

  // 已选商品列表
  const [selectedItems, setSelectedItems] = useState([]);
  // 当前正在添加的商品
  const [currentProductId, setCurrentProductId] = useState(null);
  const [currentQuantity, setCurrentQuantity] = useState(1);

  // 权限检查
  const canAdd = hasPermission('stock_add');
  const canReduce = hasPermission('stock_reduce');
  const canSelfPurchase = hasPermission('stock_reduce'); // 自购立牌复用出库权限

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

  // 获取所有业务员列表（自己名下的在前面）
  const fetchSalesmen = async () => {
    try {
      const res = await request.get('/users/all-salesmen');
      setSalesmen(res.data || []);
    } catch (error) {
      console.error('获取业务员列表失败:', error);
    }
  };

  // 添加商品到列表
  const handleAddItem = () => {
    if (!currentProductId) {
      message.warning('请选择商品');
      return;
    }
    if (!currentQuantity || currentQuantity < 1) {
      message.warning('请输入有效数量');
      return;
    }

    const product = products.find(p => p.id === currentProductId);
    if (!product) return;

    // 检查是否已添加
    const existingIndex = selectedItems.findIndex(item => item.productId === currentProductId);
    if (existingIndex >= 0) {
      // 更新数量
      const newItems = [...selectedItems];
      newItems[existingIndex].quantity += currentQuantity;
      setSelectedItems(newItems);
    } else {
      // 新增
      setSelectedItems([...selectedItems, {
        productId: currentProductId,
        productName: product.name,
        productUnit: product.unit,
        stock: product.stock,
        quantity: currentQuantity
      }]);
    }

    // 重置输入
    setCurrentProductId(null);
    setCurrentQuantity(1);
  };

  // 删除商品
  const handleRemoveItem = (productId) => {
    setSelectedItems(selectedItems.filter(item => item.productId !== productId));
  };

  // 修改商品数量
  const handleQuantityChange = (productId, quantity) => {
    const newItems = selectedItems.map(item => 
      item.productId === productId ? { ...item, quantity } : item
    );
    setSelectedItems(newItems);
  };

  const handleSubmit = async (values) => {
    if (!activeType) {
      message.error('请选择操作类型');
      return;
    }
    // 自购立牌不需要商品，其他类型需要
    if (activeType !== 'self_purchase' && selectedItems.length === 0) {
      message.error('请至少添加一个商品');
      return;
    }

    // 出库时库存不足也允许提交，但审批时会检查
    // 显示库存不足警告但不阻止提交
    if (activeType === 'out') {
      const insufficientItems = selectedItems.filter(item => item.quantity > item.stock);
      if (insufficientItems.length > 0) {
        const warnings = insufficientItems.map(item => 
          `${item.productName}（当前: ${item.stock}，需要: ${item.quantity}）`
        ).join('、');
        message.warning(`以下商品库存不足：${warnings}，申请仍可提交，但需等库存补足后才能审批通过`);
      // 检查出库时库存是否足够
      // for (const item of selectedItems) {
      //   if (item.quantity > item.stock) {
      //     message.error(`${item.productName} 库存不足（当前: ${item.stock}，需要: ${item.quantity}）`);
      //     return;
      //   }
      }
    }

    setLoading(true);
    try {
      const submitData = {
        type: activeType,
        merchant: values.merchant,
        address: values.address,
        receiverName: values.receiverName,
        receiverPhone: values.receiverPhone,
        shippingFee: values.shippingFee,
        remark: values.remark
      };
      
      // 自购立牌不需要商品列表，但需要数量
      if (activeType === 'self_purchase') {
        submitData.quantity = values.selfPurchaseQuantity || 1;
      } else {
        submitData.items = selectedItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }));
      }
      
      // 出库或自购立牌时添加业务员ID
      if ((activeType === 'out' || activeType === 'self_purchase') && values.salesmanId) {
        submitData.salesmanId = values.salesmanId;
      }
      
      const res = await request.post('/stock-requests', submitData);
      
      setSubmittedNo(res.data.requestNo);
      setSubmittedSummary(res.data.itemsSummary || '自购立牌');
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
    setSelectedItems([]);
    setCurrentProductId(null);
    setCurrentQuantity(1);
  };

  const handleReset = () => {
    form.resetFields();
    setSubmitted(false);
    setSubmittedNo('');
    setSubmittedSummary('');
    setSelectedItems([]);
    setCurrentProductId(null);
    setCurrentQuantity(1);
    setActiveType(null);
  };

  // 提交成功页面
  if (submitted) {
    return (
      <div className="page-card">
        <Result
          status="success"
          title="申请已提交！"
          subTitle={
            <div>
              <div>申请单号: {submittedNo}</div>
              <div style={{ marginTop: 8 }}>商品: {submittedSummary}</div>
              <div style={{ marginTop: 8, color: '#faad14' }}>等待审批中...</div>
            </div>
          }
          extra={[
            <Button type="primary" key="new" onClick={handleReset}>
              继续申请
            </Button>,
          ]}
        />
      </div>
    );
  }

  // 没有任何权限
  if (!canAdd && !canReduce && !canSelfPurchase) {
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
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', padding: '40px 0', flexWrap: 'wrap' }}>
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
          {canSelfPurchase && (
            <Card 
              hoverable 
              style={{ width: 240, textAlign: 'center' }}
              onClick={() => handleSelectType('self_purchase')}
            >
              <GiftOutlined style={{ fontSize: 48, color: '#722ed1', marginBottom: 16 }} />
              <h3 style={{ margin: 0 }}>自购立牌</h3>
              <p style={{ color: '#999', marginTop: 8 }}>商家自购立牌，不占库存</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // 商品选项（排除已选择的）
  const productOptions = products
    .filter(p => !selectedItems.find(item => item.productId === p.id))
    .map(p => ({
      value: p.id,
      label: `${p.name} - 库存: ${p.stock} ${p.unit}`
    }));

  // 业务员选项（自己名下的标记★）
  const mySalesmen = salesmen.filter(s => s.isMine);
  const otherSalesmen = salesmen.filter(s => !s.isMine);
  
  const salesmenOptions = [
    ...(mySalesmen.length > 0 ? [{
      label: '我的业务员',
      options: mySalesmen.map(s => ({
        value: s.id,
        label: `${s.realName || s.username}`
      }))
    }] : []),
    ...(otherSalesmen.length > 0 ? [{
      label: '其他业务员',
      options: otherSalesmen.map(s => ({
        value: s.id,
        label: s.realName || s.username
      }))
    }] : [])
  ];

  // 出库或自购立牌时需要选择业务员
  const needSelectSalesman = (activeType === 'out' || activeType === 'self_purchase') && salesmen.length > 0;

  // 当前选中商品信息
  const currentProduct = products.find(p => p.id === currentProductId);

  // 商品列表的列定义
  const itemColumns = [
    {
      title: '商品名称',
      dataIndex: 'productName',
      key: 'productName',
    },
    {
      title: '当前库存',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      render: (val, record) => `${val} ${record.productUnit}`
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (val, record) => (
        <InputNumber 
          min={1} 
          value={val} 
          onChange={(v) => handleQuantityChange(record.productId, v)}
          style={{ width: 80 }}
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button 
          type="link" 
          danger 
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveItem(record.productId)}
        >
          删除
        </Button>
      )
    }
  ];

  return (
    <div className="page-card">
      <div className="page-card-header">
        <Space>
          <Button onClick={() => setActiveType(null)}>← 返回</Button>
          <span className="page-card-title">
            {activeType === 'out' ? (
              <><MinusCircleOutlined style={{ color: '#ff4d4f' }} /> 出库（减少库存）</>
            ) : activeType === 'self_purchase' ? (
              <><GiftOutlined style={{ color: '#722ed1' }} /> 自购立牌</>
            ) : (
              <><PlusCircleOutlined style={{ color: '#52c41a' }} /> 入库（增加库存）</>
            )}
          </span>
        </Space>
      </div>

      <Card style={{ maxWidth: 800 }}>
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

          {/* 商品选择区域 - 自购立牌不需要 */}
          {activeType !== 'self_purchase' && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>
                <ShoppingOutlined /> 选择商品（可多选）
              </div>
              
              {/* 已选商品列表 */}
              {selectedItems.length > 0 && (
                <Table
                  columns={itemColumns}
                  dataSource={selectedItems}
                  rowKey="productId"
                  pagination={false}
                  size="small"
                  style={{ marginBottom: 16 }}
                  summary={() => (
                    <Table.Summary>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0}>
                          <strong>合计</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1}>
                          <Tag color="blue">{selectedItems.length} 种商品</Tag>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>
                          <strong>{selectedItems.reduce((sum, item) => sum + item.quantity, 0)}</strong> 件
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} />
                      </Table.Summary.Row>
                    </Table.Summary>
                  )}
                />
              )}

              {/* 添加商品 */}
              <Card size="small" style={{ background: '#fafafa' }}>
                <Space wrap style={{ width: '100%' }}>
                  <Select
                    showSearch
                    placeholder="搜索选择商品"
                    optionFilterProp="label"
                    value={currentProductId}
                    onChange={setCurrentProductId}
                    options={productOptions}
                    style={{ width: 280 }}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                  <InputNumber 
                    min={1} 
                    value={currentQuantity}
                    onChange={setCurrentQuantity}
                    placeholder="数量"
                    style={{ width: 100 }}
                  />
                  {currentProduct && (
                    <span style={{ color: '#999' }}>
                      库存: {currentProduct.stock} {currentProduct.unit}
                    </span>
                  )}
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={handleAddItem}
                  >
                    添加
                  </Button>
                </Space>
              </Card>
            </div>
          )}

          {/* 自购立牌说明和数量 */}
          {activeType === 'self_purchase' && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ padding: 16, background: '#f5f0ff', borderRadius: 8, border: '1px solid #d3adf7', marginBottom: 16 }}>
                <GiftOutlined style={{ color: '#722ed1', marginRight: 8 }} />
                <span style={{ color: '#722ed1' }}>自购立牌：商家自行购买立牌，不占用库存。审批通过后需填写快递单号。</span>
              </div>
              <Form.Item 
                name="selfPurchaseQuantity" 
                label="立牌数量" 
                rules={[{ required: true, message: '请输入立牌数量' }]}
                initialValue={1}
              >
                <InputNumber min={1} placeholder="数量" style={{ width: 150 }} addonAfter="个" />
              </Form.Item>
            </div>
          )}

          <Divider><EnvironmentOutlined /> 收货信息</Divider>

          <Form.Item name="merchant" label="商家名称">
            <Input placeholder="商家/客户名称" />
          </Form.Item>

          {/* 智能粘贴按钮 */}
          <div style={{ marginBottom: 16 }}>
            <Button 
              type="dashed" 
              icon={<ThunderboltOutlined />}
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (!text) {
                    message.warning('剪贴板为空');
                    return;
                  }
                  
                  const parsed = parseAddressInfo(text);
                  if (parsed) {
                    const updates = {};
                    if (parsed.address) updates.address = parsed.address;
                    if (parsed.name) updates.receiverName = parsed.name;
                    if (parsed.phone) updates.receiverPhone = parsed.phone;
                    
                    if (Object.keys(updates).length > 0) {
                      form.setFieldsValue(updates);
                      message.success(`已识别：${parsed.name ? '收件人 ' : ''}${parsed.phone ? '电话 ' : ''}${parsed.address ? '地址' : ''}`);
                    } else {
                      message.warning('无法识别剪贴板内容，请检查格式');
                    }
                  } else {
                    message.warning('无法识别剪贴板内容');
                  }
                } catch (err) {
                  if (err.name === 'NotAllowedError') {
                    message.error('请允许访问剪贴板权限');
                  } else {
                    message.error('读取剪贴板失败: ' + err.message);
                  }
                }
              }}
              style={{ 
                width: '100%', 
                borderColor: '#1890ff',
                color: '#1890ff',
                background: '#e6f7ff'
              }}
            >
              ✨ 智能粘贴（自动识别收件人、电话、地址）
            </Button>
          </div>

          <Form.Item name="address" label="收货地址">
            <Input.TextArea rows={2} placeholder="详细收货地址" />
          </Form.Item>

          <Form.Item name="receiverName" label="收件人">
            <Input placeholder="收件人姓名" />
          </Form.Item>

          <Form.Item name="receiverPhone" label="联系电话">
            <Input placeholder="收件人电话" />
          </Form.Item>

          {(activeType === 'out' || activeType === 'self_purchase') && (
            <Form.Item name="shippingFee" label="邮费承担" initialValue="receiver">
              <Radio.Group>
                <Radio.Button value="receiver">到付（客户承担）</Radio.Button>
                <Radio.Button value="company">公司承担</Radio.Button>
                <Radio.Button value="self_pickup">业务员自取</Radio.Button>
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
              style={activeType === 'self_purchase' ? { background: '#722ed1', borderColor: '#722ed1' } : {}}
              disabled={activeType !== 'self_purchase' && selectedItems.length === 0}
            >
              {activeType === 'out' ? '确认出库' : activeType === 'self_purchase' ? '提交自购立牌申请' : '确认入库'}
              {activeType !== 'self_purchase' && selectedItems.length > 0 && ` (${selectedItems.length}种商品)`}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default StockRequests;

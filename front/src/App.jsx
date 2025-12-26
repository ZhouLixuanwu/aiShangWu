import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useUserStore from './store/userStore';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import StockRequests from './pages/StockRequests';
import AllApprovals from './pages/AllApprovals';
import ShippingManage from './pages/ShippingManage';
import MyRequests from './pages/MyRequests';
import DailyLogs from './pages/DailyLogs';
import TeamLogs from './pages/TeamLogs';
import Users from './pages/Users';
import MediaUpload from './pages/MediaUpload';
import TeamMedia from './pages/TeamMedia';
import AllMedia from './pages/AllMedia';
import VoiceEdit from './pages/VoiceEdit';
import CopywritingLibrary from './pages/CopywritingLibrary';
import MediaCopywriting from './pages/MediaCopywriting';
import PendingApprovals from './pages/PendingApprovals';
import MerchantRegister from './pages/MerchantRegister';
import MerchantList from './pages/MerchantList';

// 路由守卫组件
const PrivateRoute = ({ children, permission }) => {
  const { token, hasPermission } = useUserStore();
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <PrivateRoute>
            <MainLayout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          
          {/* 库存管理 */}
          <Route path="products" element={
            <PrivateRoute permission={['inventory_view', 'inventory_manage']}>
              <Products />
            </PrivateRoute>
          } />
          
          {/* 库存变动 */}
          <Route path="stock-requests" element={
            <PrivateRoute permission="stock_submit">
              <StockRequests />
            </PrivateRoute>
          } />
          
          {/* 我的申请 */}
          <Route path="my-requests" element={
            <PrivateRoute permission="stock_submit">
              <MyRequests />
            </PrivateRoute>
          } />
          
          {/* 库存总览 */}
          <Route path="stock-overview" element={
            <PrivateRoute permission="stock_view_all">
              <AllApprovals />
            </PrivateRoute>
          } />
          
          {/* 待审批 */}
          <Route path="pending-approvals" element={
            <PrivateRoute permission="stock_approve">
              <PendingApprovals />
            </PrivateRoute>
          } />
          
          {/* 发货管理 */}
          <Route path="shipping" element={
            <PrivateRoute permission="shipping_manage">
              <ShippingManage />
            </PrivateRoute>
          } />
          
          {/* 日志管理 */}
          <Route path="daily-logs" element={
            <PrivateRoute permission="log_write">
              <DailyLogs />
            </PrivateRoute>
          } />
          
          <Route path="team-logs" element={
            <PrivateRoute permission="log_view_all">
              <TeamLogs />
            </PrivateRoute>
          } />
          
          {/* 用户管理 */}
          <Route path="users" element={
            <PrivateRoute permission="user_manage">
              <Users />
            </PrivateRoute>
          } />
          
          {/* 素材上传 */}
          <Route path="media-upload" element={
            <PrivateRoute permission="media_upload">
              <MediaUpload />
            </PrivateRoute>
          } />
          
          {/* 团队素材 */}
          <Route path="team-media" element={
            <PrivateRoute permission="media_view_team">
              <TeamMedia />
            </PrivateRoute>
          } />
          
          {/* 全员素材 */}
          <Route path="all-media" element={
            <PrivateRoute permission="media_view_all">
              <AllMedia />
            </PrivateRoute>
          } />
          
          {/* 声音剪辑 */}
          <Route path="voice-edit" element={
            <PrivateRoute permission="voice_edit">
              <VoiceEdit />
            </PrivateRoute>
          } />
          {/* 文案库 */}
          <Route path="copywriting-library" element={
            <PrivateRoute permission="copywriting_manage">
              <CopywritingLibrary />
            </PrivateRoute>
          } />
          
          {/* 素材文案 */}
          <Route path="media-copywriting" element={
            <PrivateRoute permission="copywriting_edit">
              <MediaCopywriting />
            </PrivateRoute>
          } />
          
          {/* 办理营业执照 - 提交 */}
          <Route path="merchant-register" element={
            <PrivateRoute permission="merchant_upload">
              <MerchantRegister />
            </PrivateRoute>
          } />
          
          {/* 办理营业执照 - 管理列表 */}
          <Route path="merchant-list" element={
            <PrivateRoute permission="merchant_view_all">
              <MerchantList />
            </PrivateRoute>
          } />
        </Route>
        
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


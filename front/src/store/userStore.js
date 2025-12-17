import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUserStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      permissions: [],
      
      setUser: (user) => set({ 
        user, 
        permissions: user?.permissions || [] 
      }),
      
      setToken: (token) => set({ token }),
      
      login: (userData, token) => {
        set({ 
          user: userData, 
          token,
          permissions: userData?.permissions || []
        });
      },
      
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, permissions: [] });
      },
      
      hasPermission: (permission) => {
        const { permissions } = get();
        if (Array.isArray(permission)) {
          return permission.some(p => permissions.includes(p));
        }
        return permissions.includes(permission);
      },
      
      hasAllPermissions: (permissionList) => {
        const { permissions } = get();
        return permissionList.every(p => permissions.includes(p));
      }
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token,
        permissions: state.permissions 
      })
    }
  )
);

export default useUserStore;


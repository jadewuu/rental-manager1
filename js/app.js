/**
 * 出租屋管理系统 - Vue 应用
 * 使用 Vue 3 + Composition API
 */

const { createApp, ref, reactive, computed, watch, onMounted, nextTick, toRaw } = Vue;

// ========================================================================
// 工具函数
// ========================================================================
const utils = {
  formatDate(d) {
    if (!d) return '-';
    return d;
  },
  formatMoney(v) {
    return (v || 0).toFixed(2);
  },
  getMonthLabel(period) {
    if (!period) return '';
    const [y, m] = period.split('-');
    return `${y}年${parseInt(m)}月`;
  },
  getStatusLabel(status) {
    const map = {
      'vacant': '空置',
      'occupied': '已租',
      'active': '在租',
      'inactive': '已退租',
      'pending': '未缴',
      'paid': '已缴'
    };
    return map[status] || status;
  },
  getStatusColor(status) {
    const map = {
      'vacant': 'bg-gray-100 text-gray-600',
      'occupied': 'bg-emerald-100 text-emerald-700',
      'active': 'bg-emerald-100 text-emerald-700',
      'inactive': 'bg-gray-100 text-gray-600',
      'pending': 'bg-amber-100 text-amber-700',
      'paid': 'bg-emerald-100 text-emerald-700'
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  },
  getEmptyMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  getToday() {
    return new Date().toISOString().slice(0, 10);
  }
};

// ========================================================================
// Vue 组件
// ========================================================================

// -------- 自定义 Modal 组件 --------
const ModalDialog = {
  props: {
    show: Boolean,
    title: String,
    size: { type: String, default: 'md' }
  },
  emits: ['close'],
  template: `
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4"
           @click.self="$emit('close')">
        <div class="fixed inset-0 bg-black/40" @click="$emit('close')"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-y-auto z-10"
             :class="{'max-w-sm': size === 'sm', 'max-w-lg': size === 'md', 'max-w-2xl': size === 'lg'}">
          <div class="sticky top-0 bg-white rounded-t-2xl flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
            <button @click="$emit('close')" class="p-1.5 hover:bg-gray-100 rounded-xl transition-colors">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="p-5">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  `
};

// -------- 确认对话框 --------
const ConfirmDialog = {
  props: {
    show: Boolean,
    title: { type: String, default: '确认操作' },
    message: { type: String, default: '确定要执行此操作吗？' },
    confirmText: { type: String, default: '确认' },
    danger: { type: Boolean, default: false }
  },
  emits: ['confirm', 'cancel'],
  template: `
    <Transition name="modal">
      <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-black/40" @click="$emit('cancel')"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6 text-center">
          <div class="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
               :class="danger ? 'bg-red-100' : 'bg-indigo-100'">
            <svg v-if="danger" class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <svg v-else class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ title }}</h3>
          <p class="text-sm text-gray-500 mb-6">{{ message }}</p>
          <div class="flex gap-3 justify-center">
            <button @click="$emit('cancel')"
                    class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              取消
            </button>
            <button @click="$emit('confirm')"
                    class="px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-colors"
                    :class="danger ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-500 hover:bg-indigo-600'">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  `
};

// ========================================================================
// 构建响应式 Store
// ========================================================================
const storeVersion = ref(0);

// 通知 store 数据变更
function notifyStoreChange() {
  storeVersion.value++;
}

// 重写 Store 的方法以触发响应式更新
function _wrapStore() {
  const _orig = {};
  const methods = ['addRoom', 'updateRoom', 'deleteRoom',
    'addTenant', 'updateTenant', 'checkoutTenant', 'deleteTenant',
    'addMeterReading', 'deleteMeterReading',
    'generateBill', 'markBillPaid', 'deleteBill',
    'updateSettings', 'importData'];

  methods.forEach(m => {
    _orig[m] = Store[m];
    Store[m] = function (...args) {
      const result = _orig[m].apply(this, args);
      notifyStoreChange();
      return result;
    };
  });
}
_wrapStore();

// 响应式数据获取
function useStore() {
  // 通过 computed 依赖 storeVersion 实现响应式
  const v = computed(() => storeVersion.value);

  const rooms = computed(() => { v.value; return Store.getRooms(); });
  const tenants = computed(() => { v.value; return Store.getTenants(); });
  const meterReadings = computed(() => { v.value; return Store.getMeterReadings(); });
  const bills = computed(() => { v.value; return Store.getBills(); });
  const settings = computed(() => { v.value; return Store.getSettings(); });
  const stats = computed(() => { v.value; return Store.getStats(); });

  return { rooms, tenants, meterReadings, bills, settings, stats, v };
}

// ========================================================================
// 页面路由
// ========================================================================
const currentPage = ref('dashboard');
const pageParams = ref({});

function navigate(page, params = {}) {
  currentPage.value = page;
  pageParams.value = params;
  window.scrollTo(0, 0);
}

// ========================================================================
// Sidebar / Nav
// ========================================================================
const navItems = [
  { id: 'dashboard', label: '首页', icon: 'home' },
  { id: 'rooms', label: '房间管理', icon: 'door' },
  { id: 'tenants', label: '租客管理', icon: 'users' },
  { id: 'readings', label: '抄表记录', icon: 'clipboard' },
  { id: 'bills', label: '账单管理', icon: 'receipt' },
  { id: 'settings', label: '设置', icon: 'settings' }
];

const sidebarOpen = ref(false);

function getIcon(icon) {
  const icons = {
    home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    door: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    receipt: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
    settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    plus: 'M12 4v16m8-8H4',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    check: 'M5 13l4 4L19 7',
    'arrow-left': 'M10 19l-7-7m0 0l7-7m-7 7h18',
    download: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    upload: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    filter: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'
  };
  return icons[icon] || icons.home;
}

// ========================================================================
// Toast 消息
// ========================================================================
const toasts = reactive([]);
let toastId = 0;

function showToast(message, type = 'success') {
  const id = ++toastId;
  toasts.push({ id, message, type });
  setTimeout(() => {
    const idx = toasts.findIndex(t => t.id === id);
    if (idx > -1) toasts.splice(idx, 1);
  }, 3000);
}

// ========================================================================
// 组件定义
// ========================================================================

// -------- 首页仪表盘 --------
const DashboardView = {
  components: { ModalDialog },
  setup() {
    const { stats, tenants, rooms, bills } = useStore();

    const recentBills = computed(() => {
      const all = Store.getBills();
      return all.slice(0, 5);
    });

    return { stats, tenants, rooms, bills, recentBills, navigate, utils };
  },
  template: `
    <div class="space-y-6">
      <!-- 欢迎标题 -->
      <div>
        <h2 class="text-2xl font-bold text-gray-900">出租屋管理</h2>
        <p class="text-sm text-gray-500 mt-1">欢迎回来，今天有 {{ stats.pendingBills }} 笔待缴账单</p>
      </div>

      <!-- 统计卡片 -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center gap-2 text-gray-400 mb-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
            <span class="text-xs">房间总数</span>
          </div>
          <p class="text-2xl font-bold text-gray-900">{{ stats.totalRooms }}</p>
          <p class="text-xs text-gray-400 mt-1">
            <span class="text-emerald-600">{{ stats.occupiedRooms }} 已租</span>
            <span class="mx-1">·</span>
            <span class="text-gray-400">{{ stats.vacantRooms }} 空置</span>
          </p>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center gap-2 text-gray-400 mb-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            <span class="text-xs">租客</span>
          </div>
          <p class="text-2xl font-bold text-gray-900">{{ stats.activeTenants }}</p>
          <p class="text-xs text-gray-400 mt-1">当前在租</p>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center gap-2 text-gray-400 mb-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
            </svg>
            <span class="text-xs">待缴账单</span>
          </div>
          <p class="text-2xl font-bold text-amber-600">{{ stats.pendingBills }}</p>
          <p class="text-xs text-gray-400 mt-1">共 ¥{{ utils.formatMoney(stats.totalPendingAmount) }}</p>
        </div>
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center gap-2 text-gray-400 mb-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <span class="text-xs">入住率</span>
          </div>
          <p class="text-2xl font-bold text-indigo-600">
            {{ stats.totalRooms > 0 ? Math.round(stats.occupiedRooms / stats.totalRooms * 100) : 0 }}%
          </p>
          <p class="text-xs text-gray-400 mt-1">{{ stats.occupiedRooms }}/{{ stats.totalRooms }} 间</p>
        </div>
      </div>

      <!-- 快捷操作 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-800 mb-3">快捷操作</h3>
        <div class="grid grid-cols-3 gap-3">
          <button @click="navigate('rooms')"
                  class="flex flex-col items-center gap-1.5 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div class="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
            </div>
            <span class="text-xs font-medium text-gray-600">添加房间</span>
          </button>
          <button @click="navigate('tenants')"
                  class="flex flex-col items-center gap-1.5 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div class="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
              </svg>
            </div>
            <span class="text-xs font-medium text-gray-600">登记租客</span>
          </button>
          <button @click="navigate('readings')"
                  class="flex flex-col items-center gap-1.5 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <span class="text-xs font-medium text-gray-600">录入读数</span>
          </button>
        </div>
      </div>

      <!-- 近期账单 -->
      <div>
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-800">近期账单</h3>
          <button @click="navigate('bills')" class="text-xs text-indigo-600 font-medium">查看全部</button>
        </div>
        <div class="space-y-2">
          <div v-if="recentBills.length === 0" class="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
            <p class="text-sm text-gray-400">暂无账单数据</p>
          </div>
          <div v-for="bill in recentBills" :key="bill.id"
               @click="navigate('bills', { billId: bill.id })"
               class="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">
                {{ utils.getMonthLabel(bill.period) }} · {{ bill.roomId ? Store.getRoom(bill.roomId)?.name || '-' : '-' }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5">生成于 {{ bill.generatedDate }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold" :class="bill.status === 'pending' ? 'text-amber-600' : 'text-emerald-600'">
                ¥{{ utils.formatMoney(bill.totalAmount) }}
              </p>
              <span class="inline-block text-xs px-2 py-0.5 rounded-full mt-1"
                    :class="utils.getStatusColor(bill.status)">
                {{ utils.getStatusLabel(bill.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
};

// ========================================================================
// 房间管理
// ========================================================================
const RoomsView = {
  components: { ModalDialog, ConfirmDialog },
  setup() {
    const { rooms, tenants } = useStore();

    // 表单
    const showForm = ref(false);
    const editingRoom = ref(null);
    const form = reactive({ name: '', floor: '', area: '', notes: '' });
    const deleteTarget = ref(null);

    function openAdd() {
      editingRoom.value = null;
      form.name = '';
      form.floor = '';
      form.area = '';
      form.notes = '';
      showForm.value = true;
    }

    function openEdit(room) {
      editingRoom.value = room;
      form.name = room.name;
      form.floor = room.floor;
      form.area = room.area;
      form.notes = room.notes || '';
      showForm.value = true;
    }

    function saveRoom() {
      if (!form.name.trim()) { showToast('请输入房间名称', 'error'); return; }
      if (editingRoom.value) {
        Store.updateRoom(editingRoom.value.id, {
          name: form.name.trim(),
          floor: parseInt(form.floor) || 1,
          area: parseFloat(form.area) || 0,
          notes: form.notes
        });
        showToast('房间已更新');
      } else {
        Store.addRoom({
          name: form.name.trim(),
          floor: parseInt(form.floor) || 1,
          area: parseFloat(form.area) || 0,
          notes: form.notes
        });
        showToast('房间已添加');
      }
      showForm.value = false;
    }

    function confirmDelete(room) {
      deleteTarget.value = room;
    }

    function doDelete() {
      if (!deleteTarget.value) return;
      const room = deleteTarget.value;
      if (room.status === 'occupied') {
        showToast('该房间有在租租客，无法删除', 'error');
        deleteTarget.value = null;
        return;
      }
      Store.deleteRoom(room.id);
      showToast('房间已删除');
      deleteTarget.value = null;
    }

    return { rooms, tenants, showForm, editingRoom, form, deleteTarget,
      openAdd, openEdit, saveRoom, confirmDelete, doDelete,
      navigate, utils, Store, showToast };
  },
  template: `
    <div class="space-y-4">
      <!-- 标题栏 -->
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">房间管理</h2>
          <p class="text-sm text-gray-500 mt-1">共 {{ rooms.length }} 个房间</p>
        </div>
        <button @click="openAdd"
                class="flex items-center gap-1.5 bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          <span>添加房间</span>
        </button>
      </div>

      <!-- 房间列表 -->
      <div class="grid grid-cols-1 gap-3">
        <div v-if="rooms.length === 0" class="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p class="text-gray-400 mb-2">暂无房间</p>
          <button @click="openAdd" class="text-indigo-600 text-sm font-medium">添加第一个房间</button>
        </div>
        <div v-for="room in rooms" :key="room.id"
             class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                   :class="room.status === 'occupied' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'">
                🏠
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">{{ room.name }}</h3>
                <p class="text-xs text-gray-400">
                  {{ room.floor ? room.floor + '楼' : '' }}
                  {{ room.area ? '· ' + room.area + '㎡' : '' }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2.5 py-1 rounded-full font-medium"
                    :class="utils.getStatusColor(room.status)">
                {{ utils.getStatusLabel(room.status) }}
              </span>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
            <div class="flex gap-3 text-xs text-gray-400">
              <span v-if="Store.getRoomCurrentTenant(room.id)" class="text-emerald-600">
                租客: {{ Store.getRoomCurrentTenant(room.id).name }}
              </span>
            </div>
            <div class="flex gap-1">
              <button @click="openEdit(room)"
                      class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button @click="confirmDelete(room)"
                      class="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                <svg class="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 添加/编辑房间 Modal -->
      <ModalDialog :show="showForm" title="房间信息" @close="showForm = false">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">房间名称 *</label>
            <input v-model="form.name" type="text" placeholder="如: 101 / 单间A"
                   class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">楼层</label>
              <input v-model="form.floor" type="number" placeholder="1"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">面积 (㎡)</label>
              <input v-model="form.area" type="number" step="0.1" placeholder="30"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea v-model="form.notes" rows="2" placeholder="房间备注信息"
                      class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none transition-shadow"></textarea>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showForm = false"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              取消
            </button>
            <button @click="saveRoom"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors">
              {{ editingRoom ? '保存修改' : '添加房间' }}
            </button>
          </div>
        </div>
      </ModalDialog>

      <!-- 删除确认 -->
      <ConfirmDialog :show="deleteTarget !== null"
                     title="删除房间"
                     :message="deleteTarget ? '确定要删除「' + deleteTarget.name + '」吗？相关的读数和账单也会被删除。' : ''"
                     confirmText="删除"
                     :danger="true"
                     @confirm="doDelete"
                     @cancel="deleteTarget = null" />
    </div>
  `
};

// ========================================================================
// 租客管理
// ========================================================================
const TenantsView = {
  components: { ModalDialog, ConfirmDialog },
  setup() {
    const { tenants, rooms } = useStore();

    const showForm = ref(false);
    const editingTenant = ref(null);
    const form = reactive({
      name: '', phone: '', idNumber: '', roomId: '',
      rentAmount: '', deposit: '', checkInDate: '', notes: ''
    });
    const checkoutTarget = ref(null);
    const checkoutDate = ref('');

    // 获取租客的房间名称
    function getRoomName(roomId) {
      const room = Store.getRoom(roomId);
      return room ? room.name : '-';
    }

    const activeTenants = computed(() => tenants.value.filter(t => t.status === 'active'));
    const inactiveTenants = computed(() => tenants.value.filter(t => t.status === 'inactive'));

    // 可选房间（空置的）
    const availableRooms = computed(() => rooms.value.filter(r => r.status === 'vacant'));

    function openAdd() {
      editingTenant.value = null;
      form.name = '';
      form.phone = '';
      form.idNumber = '';
      form.roomId = '';
      form.rentAmount = '';
      form.deposit = '';
      form.checkInDate = utils.getToday();
      form.notes = '';
      showForm.value = true;
    }

    function openEdit(tenant) {
      editingTenant.value = tenant;
      form.name = tenant.name;
      form.phone = tenant.phone || '';
      form.idNumber = tenant.idNumber || '';
      form.roomId = tenant.roomId;
      form.rentAmount = tenant.rentAmount;
      form.deposit = tenant.deposit || '';
      form.checkInDate = tenant.checkInDate;
      form.notes = tenant.notes || '';
      showForm.value = true;
    }

    function saveTenant() {
      if (!form.name.trim()) { showToast('请输入租客姓名', 'error'); return; }
      if (!form.roomId) { showToast('请选择房间', 'error'); return; }
      if (!form.rentAmount) { showToast('请输入租金', 'error'); return; }

      if (editingTenant.value) {
        Store.updateTenant(editingTenant.value.id, {
          name: form.name.trim(),
          phone: form.phone,
          idNumber: form.idNumber,
          roomId: form.roomId,
          rentAmount: parseFloat(form.rentAmount) || 0,
          deposit: parseFloat(form.deposit) || 0,
          checkInDate: form.checkInDate,
          notes: form.notes
        });
        showToast('租客信息已更新');
      } else {
        Store.addTenant({
          name: form.name.trim(),
          phone: form.phone,
          idNumber: form.idNumber,
          roomId: form.roomId,
          rentAmount: parseFloat(form.rentAmount) || 0,
          deposit: parseFloat(form.deposit) || 0,
          checkInDate: form.checkInDate,
          notes: form.notes
        });
        showToast('租客已登记');
      }
      showForm.value = false;
    }

    function openCheckout(tenant) {
      checkoutTarget.value = tenant;
      checkoutDate.value = utils.getToday();
    }

    function doCheckout() {
      if (!checkoutTarget.value || !checkoutDate.value) return;
      Store.checkoutTenant(checkoutTarget.value.id, checkoutDate.value);
      showToast('退租登记完成');
      checkoutTarget.value = null;
    }

    return { tenants, rooms, showForm, editingTenant, form, checkoutTarget, checkoutDate,
      getRoomName, activeTenants, inactiveTenants, availableRooms,
      openAdd, openEdit, saveTenant, openCheckout, doCheckout, navigate, utils, showToast };
  },
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">租客管理</h2>
          <p class="text-sm text-gray-500 mt-1">当前在租 {{ activeTenants.length }} 人</p>
        </div>
        <button @click="openAdd"
                class="flex items-center gap-1.5 bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
          </svg>
          <span>登记租客</span>
        </button>
      </div>

      <!-- 在租租客 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-800 mb-3">在租租客</h3>
        <div class="space-y-2">
          <div v-if="activeTenants.length === 0" class="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
            <p class="text-sm text-gray-400">暂无在租租客</p>
          </div>
          <div v-for="tenant in activeTenants" :key="tenant.id"
               class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-semibold text-sm">
                  {{ tenant.name[0] }}
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900">{{ tenant.name }}</h3>
                  <p class="text-xs text-gray-400">
                    {{ getRoomName(tenant.roomId) }}
                    <span class="mx-1">·</span>
                    入住 {{ tenant.checkInDate }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700">在租</span>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between border-t border-gray-50 pt-3">
              <div class="flex gap-4 text-xs text-gray-500">
                <span>租金: <strong class="text-gray-700">¥{{ utils.formatMoney(tenant.rentAmount) }}</strong>/月</span>
                <span v-if="tenant.phone">电话: {{ tenant.phone }}</span>
              </div>
              <div class="flex gap-1">
                <button @click="openEdit(tenant)"
                        class="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </button>
                <button @click="openCheckout(tenant)"
                        class="p-1.5 hover:bg-amber-50 rounded-lg transition-colors">
                  <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                </button>
              </div>
            </div>
            <div v-if="tenant.notes" class="mt-2 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5">
              {{ tenant.notes }}
            </div>
          </div>
        </div>
      </div>

      <!-- 历史租客 -->
      <div v-if="inactiveTenants.length > 0">
        <details class="group">
          <summary class="flex items-center gap-2 text-sm font-medium text-gray-500 cursor-pointer py-2">
            历史租客 ({{ inactiveTenants.length }})
            <svg class="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="space-y-2 mt-2">
            <div v-for="tenant in inactiveTenants" :key="tenant.id"
                 class="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-gray-700">{{ tenant.name }}</span>
                  <span class="text-xs text-gray-400">{{ getRoomName(tenant.roomId) }}</span>
                </div>
                <span class="text-xs text-gray-400">{{ tenant.checkInDate }} ~ {{ tenant.checkOutDate || '至今' }}</span>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- 添加/编辑租客 Modal -->
      <ModalDialog :show="showForm" :title="editingTenant ? '编辑租客信息' : '登记租客'" @close="showForm = false">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">租客姓名 *</label>
            <input v-model="form.name" type="text" placeholder="请输入姓名"
                   class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">手机号</label>
              <input v-model="form.phone" type="tel" placeholder="手机号"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">身份证号</label>
              <input v-model="form.idNumber" type="text" placeholder="身份证"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">选择房间 *</label>
            <select v-model="form.roomId"
                    class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white">
              <option value="">请选择房间</option>
              <option v-for="room in (editingTenant ? rooms : availableRooms)"
                      :key="room.id" :value="room.id">
                {{ room.name }} ({{ room.floor || '-' }}楼 · {{ room.area || '-' }}㎡)
              </option>
            </select>
            <p v-if="!editingTenant && availableRooms.length === 0" class="text-xs text-amber-600 mt-1">
              暂无空置房间，请先添加房间或退租
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">月租金 (元) *</label>
              <input v-model="form.rentAmount" type="number" placeholder="2000"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">押金 (元)</label>
              <input v-model="form.deposit" type="number" placeholder="2000"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">入住日期</label>
            <input v-model="form.checkInDate" type="date"
                   class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea v-model="form.notes" rows="2" placeholder="备注信息"
                      class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"></textarea>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showForm = false"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">取消</button>
            <button @click="saveTenant"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors">
              {{ editingTenant ? '保存修改' : '登记入住' }}
            </button>
          </div>
        </div>
      </ModalDialog>

      <!-- 退租确认 -->
      <ConfirmDialog :show="checkoutTarget !== null"
                     title="退租登记"
                     :message="checkoutTarget ? '确认租客「' + checkoutTarget.name + '」退租？房间将标记为空置。' : ''"
                     confirmText="确认退租"
                     @confirm="doCheckout"
                     @cancel="checkoutTarget = null">
      </ConfirmDialog>
    </div>
  `
};

// ========================================================================
// 抄表记录
// ========================================================================
const ReadingsView = {
  components: { ModalDialog, ConfirmDialog },
  setup() {
    const { rooms, meterReadings } = useStore();

    const showForm = ref(false);
    const filterRoomId = ref('');
    const form = reactive({ roomId: '', date: '', waterReading: '', electricReading: '', notes: '' });
    const deleteTarget = ref(null);
    const prevReading = ref(null);

    const filteredReadings = computed(() => {
      let list = meterReadings.value;
      if (filterRoomId.value) {
        list = list.filter(r => r.roomId === filterRoomId.value);
      }
      return list;
    });

    function getRoomName(roomId) {
      const room = Store.getRoom(roomId);
      return room ? room.name : '-';
    }

    function openAdd() {
      form.roomId = '';
      form.date = utils.getToday();
      form.waterReading = '';
      form.electricReading = '';
      form.notes = '';
      prevReading.value = null;
      showForm.value = true;
    }

    function onRoomSelected() {
      if (form.roomId && form.date) {
        const prev = Store.getPreviousReading(form.roomId, form.date);
        prevReading.value = prev;
      } else {
        prevReading.value = null;
      }
    }

    function saveReading() {
      if (!form.roomId) { showToast('请选择房间', 'error'); return; }
      if (!form.date) { showToast('请选择日期', 'error'); return; }
      if (!form.waterReading && !form.electricReading) {
        showToast('请至少输入一项读数', 'error');
        return;
      }

      // 验证读数不能小于上次
      if (prevReading.value) {
        const w = parseFloat(form.waterReading) || 0;
        const e = parseFloat(form.electricReading) || 0;
        if (w > 0 && w < prevReading.value.waterReading) {
          showToast('水表读数不能小于上次记录 (' + prevReading.value.waterReading + ')', 'error');
          return;
        }
        if (e > 0 && e < prevReading.value.electricReading) {
          showToast('电表读数不能小于上次记录 (' + prevReading.value.electricReading + ')', 'error');
          return;
        }
      }

      Store.addMeterReading({
        roomId: form.roomId,
        date: form.date,
        waterReading: form.waterReading || 0,
        electricReading: form.electricReading || 0,
        notes: form.notes
      });
      showToast('读数已记录');
      showForm.value = false;
    }

    function confirmDelete(reading) {
      deleteTarget.value = reading;
    }

    function doDelete() {
      if (!deleteTarget.value) return;
      Store.deleteMeterReading(deleteTarget.value.id);
      showToast('记录已删除');
      deleteTarget.value = null;
    }

    return { rooms, filteredReadings, showForm, filterRoomId, form, deleteTarget, prevReading,
      getRoomName, openAdd, onRoomSelected, saveReading, confirmDelete, doDelete, utils, showToast };
  },
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">抄表记录</h2>
          <p class="text-sm text-gray-500 mt-1">记录每个房间的水电表读数</p>
        </div>
        <button @click="openAdd"
                class="flex items-center gap-1.5 bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          <span>录入读数</span>
        </button>
      </div>

      <!-- 房间筛选 -->
      <div class="flex gap-2">
        <button @click="filterRoomId = ''"
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                :class="filterRoomId === '' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
          全部
        </button>
        <button v-for="room in rooms" :key="room.id"
                @click="filterRoomId = room.id"
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                :class="filterRoomId === room.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
          {{ room.name }}
        </button>
      </div>

      <!-- 读数列表 -->
      <div class="space-y-2">
        <div v-if="filteredReadings.length === 0" class="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p class="text-gray-400">暂无抄表记录</p>
        </div>
        <div v-for="reading in filteredReadings" :key="reading.id"
             class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-gray-900 text-sm">{{ getRoomName(reading.roomId) }}</span>
              <span class="text-xs text-gray-400">{{ reading.date }}</span>
            </div>
            <button @click="confirmDelete(reading)"
                    class="p-1 hover:bg-red-50 rounded-lg transition-colors">
              <svg class="w-4 h-4 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="bg-blue-50 rounded-xl p-2.5">
              <span class="text-blue-600 text-xs font-medium">💧 水表</span>
              <p class="text-lg font-bold text-gray-900 mt-0.5">{{ reading.waterReading || '-' }}</p>
              <p v-if="reading.waterReading > 0" class="text-xs text-blue-500">吨</p>
            </div>
            <div class="bg-amber-50 rounded-xl p-2.5">
              <span class="text-amber-600 text-xs font-medium">⚡ 电表</span>
              <p class="text-lg font-bold text-gray-900 mt-0.5">{{ reading.electricReading || '-' }}</p>
              <p v-if="reading.electricReading > 0" class="text-xs text-amber-500">度</p>
            </div>
          </div>
          <div v-if="reading.notes" class="mt-2 text-xs text-gray-400">{{ reading.notes }}</div>
        </div>
      </div>

      <!-- 录入读数 Modal -->
      <ModalDialog :show="showForm" title="录入水电读数" @close="showForm = false">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">选择房间 *</label>
            <select v-model="form.roomId" @change="onRoomSelected"
                    class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white">
              <option value="">请选择房间</option>
              <option v-for="room in rooms" :key="room.id" :value="room.id">
                {{ room.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">抄表日期</label>
            <input v-model="form.date" type="date" @change="onRoomSelected"
                   class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
          </div>

          <!-- 上次读数参考 -->
          <div v-if="prevReading" class="bg-gray-50 rounded-xl p-3 text-sm">
            <p class="text-xs font-medium text-gray-500 mb-2">上次读数参考 ({{ prevReading.date }})</p>
            <div class="grid grid-cols-2 gap-2">
              <div><span class="text-blue-600">水表:</span> <strong>{{ prevReading.waterReading }}</strong> 吨</div>
              <div><span class="text-amber-600">电表:</span> <strong>{{ prevReading.electricReading }}</strong> 度</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">水表读数 (吨)</label>
              <input v-model="form.waterReading" type="number" step="0.1" placeholder="当前水表"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">电表读数 (度)</label>
              <input v-model="form.electricReading" type="number" step="0.1" placeholder="当前电表"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea v-model="form.notes" rows="2" placeholder="如: 换表、估数等"
                      class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"></textarea>
          </div>
          <div class="flex gap-3 pt-2">
            <button @click="showForm = false"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">取消</button>
            <button @click="saveReading"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors">保存记录</button>
          </div>
        </div>
      </ModalDialog>

      <ConfirmDialog :show="deleteTarget !== null"
                     title="删除读数记录"
                     :message="'确定要删除这条读数记录吗？'"
                     confirmText="删除"
                     :danger="true"
                     @confirm="doDelete"
                     @cancel="deleteTarget = null" />
    </div>
  `
};

// ========================================================================
// 账单管理
// ========================================================================
const BillsView = {
  components: { ModalDialog, ConfirmDialog },
  setup() {
    const { rooms, tenants, bills, settings } = useStore();

    const showForm = ref(false);
    const showDetail = ref(false);
    const detailBill = ref(null);
    const deleteTarget = ref(null);

    // 筛选
    const filterStatus = ref('');
    const filterMonth = ref('');

    const form = reactive({
      roomId: '', tenantId: '', period: '',
      waterReading: '', electricReading: '',
      rentAmount: '', otherFees: '0',
      notes: ''
    });

    const formPrevReading = ref(null);

    // 账单列表
    const filteredBills = computed(() => {
      let list = bills.value;
      if (filterStatus.value) {
        list = list.filter(b => b.status === filterStatus.value);
      }
      if (filterMonth.value) {
        list = list.filter(b => b.period === filterMonth.value);
      }
      return list;
    });

    // 可选月份列表
    const monthOptions = computed(() => {
      const months = new Set();
      bills.value.forEach(b => months.add(b.period));
      return [...months].sort().reverse();
    });

    function getRoomName(roomId) {
      const room = Store.getRoom(roomId);
      return room ? room.name : '-';
    }

    function getTenantName(tenantId) {
      const tenant = Store.getTenant(tenantId);
      return tenant ? tenant.name : '-';
    }

    // 当前租客（用于生成账单时自动填充）
    const currentTenants = computed(() =>
      tenants.value.filter(t => t.status === 'active')
    );

    const selectedTenant = computed(() => {
      if (!form.roomId) return null;
      return currentTenants.value.find(t => t.roomId === form.roomId);
    });

    function openGenerate() {
      form.roomId = '';
      form.tenantId = '';
      form.period = utils.getEmptyMonth();
      form.waterReading = '';
      form.electricReading = '';
      form.rentAmount = '';
      form.otherFees = '0';
      form.notes = '';
      formPrevReading.value = null;
      showForm.value = true;
    }

    function onRoomSelected() {
      const tenant = currentTenants.value.find(t => t.roomId === form.roomId);
      if (tenant) {
        form.tenantId = tenant.id;
        form.rentAmount = tenant.rentAmount;
      } else {
        form.tenantId = '';
        form.rentAmount = '';
      }
      // 获取上次读数
      if (form.roomId && form.period) {
        const periodStart = form.period + '-01';
        formPrevReading.value = Store.getPreviousReading(form.roomId, periodStart);
      }
    }

    function generateBill() {
      if (!form.roomId) { showToast('请选择房间', 'error'); return; }
      if (!form.tenantId) { showToast('该房间没有在租租客', 'error'); return; }
      if (!form.waterReading && !form.electricReading) {
        showToast('请至少输入一项当前读数', 'error');
        return;
      }

      const s = settings.value;
      Store.generateBill({
        roomId: form.roomId,
        tenantId: form.tenantId,
        period: form.period,
        waterReading: form.waterReading || 0,
        electricReading: form.electricReading || 0,
        waterRate: s.waterRate,
        electricRate: s.electricRate,
        rentAmount: parseFloat(form.rentAmount) || 0,
        otherFees: parseFloat(form.otherFees) || 0,
        notes: form.notes
      });
      showToast('账单已生成');
      showForm.value = false;
    }

    function viewDetail(bill) {
      detailBill.value = bill;
      showDetail.value = true;
    }

    function markPaid(bill) {
      Store.markBillPaid(bill.id);
      detailBill.value = Store.getBill(bill.id);
      showToast('账单已标记为已缴');
    }

    function confirmDelete(bill) {
      deleteTarget.value = bill;
    }

    function doDelete() {
      if (!deleteTarget.value) return;
      Store.deleteBill(deleteTarget.value.id);
      showToast('账单已删除');
      deleteTarget.value = null;
    }

    const totalPendingAmount = computed(() =>
      filteredBills.value
        .filter(b => b.status === 'pending')
        .reduce((s, b) => s + b.totalAmount, 0)
    );

    return { rooms, filteredBills, settings, showForm, showDetail, detailBill, deleteTarget,
      filterStatus, filterMonth, form, formPrevReading,
      monthOptions, getRoomName, getTenantName, currentTenants, selectedTenant,
      openGenerate, onRoomSelected, generateBill, viewDetail, markPaid,
      confirmDelete, doDelete, totalPendingAmount, navigate, utils, showToast };
  },
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">账单管理</h2>
          <p class="text-sm text-gray-500 mt-1">
            待缴金额: ¥{{ utils.formatMoney(totalPendingAmount) }}
          </p>
        </div>
        <button @click="openGenerate"
                class="flex items-center gap-1.5 bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          <span>生成账单</span>
        </button>
      </div>

      <!-- 筛选 -->
      <div class="flex gap-2 flex-wrap">
        <button @click="filterStatus = ''"
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                :class="filterStatus === '' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
          全部
        </button>
        <button @click="filterStatus = 'pending'"
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                :class="filterStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
          未缴
        </button>
        <button @click="filterStatus = 'paid'"
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                :class="filterStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'">
          已缴
        </button>
        <select v-model="filterMonth"
                class="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-600 border-0 outline-none">
          <option value="">全部月份</option>
          <option v-for="m in monthOptions" :key="m" :value="m">{{ utils.getMonthLabel(m) }}</option>
        </select>
      </div>

      <!-- 账单列表 -->
      <div class="space-y-2">
        <div v-if="filteredBills.length === 0" class="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p class="text-gray-400">暂无账单</p>
        </div>
        <div v-for="bill in filteredBills" :key="bill.id"
             @click="viewDetail(bill)"
             class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-gray-900 text-sm">{{ getRoomName(bill.roomId) }}</span>
              <span class="text-xs text-gray-400">{{ utils.getMonthLabel(bill.period) }}</span>
            </div>
            <span class="text-xs px-2 py-1 rounded-full font-medium"
                  :class="utils.getStatusColor(bill.status)">
              {{ utils.getStatusLabel(bill.status) }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <div class="text-xs text-gray-500">
              <span>{{ getTenantName(bill.tenantId) }}</span>
              <span class="mx-1">·</span>
              <span>{{ bill.waterUsage }}吨 · {{ bill.electricUsage }}度</span>
            </div>
            <p class="text-lg font-bold" :class="bill.status === 'pending' ? 'text-amber-600' : 'text-emerald-600'">
              ¥{{ utils.formatMoney(bill.totalAmount) }}
            </p>
          </div>
          <div class="mt-2 flex gap-2" @click.stop>
            <button v-if="bill.status === 'pending'" @click="markPaid(bill)"
                    class="text-xs px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors">
              标记已缴
            </button>
            <button @click="confirmDelete(bill)"
                    class="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
              删除
            </button>
          </div>
        </div>
      </div>

      <!-- 生成账单 Modal -->
      <ModalDialog :show="showForm" title="生成账单" size="lg" @close="showForm = false">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">选择房间 *</label>
            <select v-model="form.roomId" @change="onRoomSelected"
                    class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white">
              <option value="">请选择房间</option>
              <option v-for="room in rooms" :key="room.id" :value="room.id">
                {{ room.name }}
              </option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">账单月份</label>
              <input v-model="form.period" type="month" @change="onRoomSelected"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">租客</label>
              <input :value="selectedTenant ? selectedTenant.name : '无在租租客'" disabled
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500" />
            </div>
          </div>

          <!-- 上次读数 -->
          <div v-if="formPrevReading" class="bg-gray-50 rounded-xl p-3">
            <p class="text-xs font-medium text-gray-500 mb-2">上次读数 ({{ formPrevReading.date }})</p>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>水表: <strong>{{ formPrevReading.waterReading }}</strong> 吨</div>
              <div>电表: <strong>{{ formPrevReading.electricReading }}</strong> 度</div>
            </div>
          </div>

          <!-- 当前读数 -->
          <p class="text-sm font-medium text-gray-700">当前读数</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">水表读数 (吨) *</label>
              <input v-model="form.waterReading" type="number" step="0.1" placeholder="当前水表"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">电表读数 (度) *</label>
              <input v-model="form.electricReading" type="number" step="0.1" placeholder="当前电表"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>

          <!-- 费用明细 -->
          <p class="text-sm font-medium text-gray-700">费用设置</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-500 mb-1">租金 (元)</label>
              <input v-model="form.rentAmount" type="number" placeholder="月租金"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1">其他费用 (元)</label>
              <input v-model="form.otherFees" type="number" step="0.01" placeholder="其他"
                     class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            </div>
          </div>

          <!-- 费用预览 -->
          <div v-if="form.roomId && (form.waterReading || form.electricReading)"
               class="bg-indigo-50 rounded-xl p-4">
            <p class="text-xs font-semibold text-indigo-700 mb-2">费用预览</p>
            <div class="text-sm space-y-1.5">
              <div class="flex justify-between">
                <span class="text-gray-600">租金</span>
                <span>¥{{ utils.formatMoney(parseFloat(form.rentAmount) || 0) }}</span>
              </div>
              <div class="flex justify-between" v-if="form.waterReading > 0">
                <span class="text-gray-600">水费 ({{ formPrevReading ? parseFloat(form.waterReading) - formPrevReading.waterReading + '吨 × ¥' + settings.waterRate : '待计算' }})</span>
                <span v-if="formPrevReading">¥{{ utils.formatMoney((parseFloat(form.waterReading) - formPrevReading.waterReading) * settings.waterRate) }}</span>
                <span v-else class="text-gray-400">首次读数</span>
              </div>
              <div class="flex justify-between" v-if="form.electricReading > 0">
                <span class="text-gray-600">电费 ({{ formPrevReading ? parseFloat(form.electricReading) - formPrevReading.electricReading + '度 × ¥' + settings.electricRate : '待计算' }})</span>
                <span v-if="formPrevReading">¥{{ utils.formatMoney((parseFloat(form.electricReading) - formPrevReading.electricReading) * settings.electricRate) }}</span>
                <span v-else class="text-gray-400">首次读数</span>
              </div>
              <div class="flex justify-between" v-if="parseFloat(form.otherFees || 0) > 0">
                <span class="text-gray-600">其他费用</span>
                <span>¥{{ utils.formatMoney(parseFloat(form.otherFees) || 0) }}</span>
              </div>
              <div class="border-t border-indigo-200 pt-1.5 flex justify-between font-bold text-indigo-800">
                <span>合计</span>
                <span>¥{{
                  utils.formatMoney(
                    (parseFloat(form.rentAmount) || 0) +
                    (formPrevReading && form.waterReading > 0 ? ((parseFloat(form.waterReading) - formPrevReading.waterReading) * settings.waterRate) : 0) +
                    (formPrevReading && form.electricReading > 0 ? ((parseFloat(form.electricReading) - formPrevReading.electricReading) * settings.electricRate) : 0) +
                    (parseFloat(form.otherFees) || 0)
                  )
                }}</span>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
            <textarea v-model="form.notes" rows="2" placeholder="账单备注"
                      class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"></textarea>
          </div>

          <div class="flex gap-3 pt-2">
            <button @click="showForm = false"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              取消
            </button>
            <button @click="generateBill"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors">
              生成账单
            </button>
          </div>
        </div>
      </ModalDialog>

      <!-- 账单详情 Modal -->
      <ModalDialog :show="showDetail" title="账单详情" @close="showDetail = false">
        <div v-if="detailBill" class="space-y-4">
          <!-- 账单头部 -->
          <div class="text-center pb-3 border-b border-gray-100">
            <p class="text-3xl font-bold" :class="detailBill.status === 'pending' ? 'text-amber-600' : 'text-emerald-600'">
              ¥{{ utils.formatMoney(detailBill.totalAmount) }}
            </p>
            <span class="inline-block text-xs px-2 py-1 rounded-full mt-2 font-medium"
                  :class="utils.getStatusColor(detailBill.status)">
              {{ utils.getStatusLabel(detailBill.status) }}
            </span>
          </div>

          <div class="space-y-2 text-sm">
            <div class="flex justify-between py-1.5">
              <span class="text-gray-500">房间</span>
              <span class="font-medium">{{ getRoomName(detailBill.roomId) }}</span>
            </div>
            <div class="flex justify-between py-1.5">
              <span class="text-gray-500">租客</span>
              <span class="font-medium">{{ getTenantName(detailBill.tenantId) }}</span>
            </div>
            <div class="flex justify-between py-1.5">
              <span class="text-gray-500">账期</span>
              <span class="font-medium">{{ utils.getMonthLabel(detailBill.period) }}</span>
            </div>
            <div class="flex justify-between py-1.5">
              <span class="text-gray-500">生成日期</span>
              <span class="font-medium">{{ detailBill.generatedDate }}</span>
            </div>
            <div v-if="detailBill.paidDate" class="flex justify-between py-1.5">
              <span class="text-gray-500">缴费日期</span>
              <span class="font-medium text-emerald-600">{{ detailBill.paidDate }}</span>
            </div>
          </div>

          <!-- 费用明细 -->
          <div class="border-t border-gray-100 pt-3">
            <p class="text-xs font-semibold text-gray-500 mb-2">费用明细</p>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600">租金</span>
                <span>¥{{ utils.formatMoney(detailBill.rentAmount) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">水费</span>
                <span>{{ detailBill.waterUsage }}吨 × ¥{{ detailBill.waterRate }} = ¥{{ utils.formatMoney(detailBill.waterCost) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600">电费</span>
                <span>{{ detailBill.electricUsage }}度 × ¥{{ detailBill.electricRate }} = ¥{{ utils.formatMoney(detailBill.electricCost) }}</span>
              </div>
              <div v-if="detailBill.otherFees > 0" class="flex justify-between">
                <span class="text-gray-600">其他费用</span>
                <span>¥{{ utils.formatMoney(detailBill.otherFees) }}</span>
              </div>
            </div>
          </div>

          <!-- 表底读数 -->
          <div class="border-t border-gray-100 pt-3">
            <p class="text-xs font-semibold text-gray-500 mb-2">表底读数</p>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div class="bg-blue-50 rounded-xl p-3">
                <p class="text-blue-600 text-xs">💧 水表</p>
                <p class="text-lg font-bold mt-1">{{ detailBill.waterCurrReading }}</p>
                <p class="text-xs text-gray-400">上次: {{ detailBill.waterPrevReading }}</p>
              </div>
              <div class="bg-amber-50 rounded-xl p-3">
                <p class="text-amber-600 text-xs">⚡ 电表</p>
                <p class="text-lg font-bold mt-1">{{ detailBill.electricCurrReading }}</p>
                <p class="text-xs text-gray-400">上次: {{ detailBill.electricPrevReading }}</p>
              </div>
            </div>
          </div>

          <div v-if="detailBill.notes" class="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
            {{ detailBill.notes }}
          </div>

          <div class="flex gap-3 pt-2">
            <button v-if="detailBill.status === 'pending'" @click="markPaid(detailBill)"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors">
              标记已缴
            </button>
            <button @click="showDetail = false"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              关闭
            </button>
          </div>
        </div>
      </ModalDialog>

      <ConfirmDialog :show="deleteTarget !== null"
                     title="删除账单"
                     :message="'确定要删除这笔账单吗？'"
                     confirmText="删除"
                     :danger="true"
                     @confirm="doDelete"
                     @cancel="deleteTarget = null" />
    </div>
  `
};

// ========================================================================
// 设置
// ========================================================================
const SettingsView = {
  setup() {
    const { settings } = useStore();

    const importText = ref('');
    const showImport = ref(false);
    const showExport = ref(false);

    const form = reactive({
      waterRate: 0,
      electricRate: 0
    });

    onMounted(() => {
      form.waterRate = settings.value.waterRate;
      form.electricRate = settings.value.electricRate;
    });

    function saveSettings() {
      Store.updateSettings({
        waterRate: parseFloat(form.waterRate) || 0,
        electricRate: parseFloat(form.electricRate) || 0
      });
      showToast('设置已保存');
    }

    function exportData() {
      const json = Store.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '出租屋管理_数据备份_' + utils.getToday() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('数据已导出');
    }

    function importData() {
      if (!importText.value.trim()) {
        showToast('请粘贴要导入的数据', 'error');
        return;
      }
      const result = Store.importData(importText.value);
      if (result) {
        showToast('数据导入成功');
        showImport.value = false;
        importText.value = '';
      } else {
        showToast('数据格式无效，请检查', 'error');
      }
    }

    return { settings, form, importText, showImport, showExport, saveSettings, exportData, importData, utils, showToast };
  },
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">设置</h2>
        <p class="text-sm text-gray-500 mt-1">管理费率、导出导入数据</p>
      </div>

      <!-- 费率设置 -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 class="text-sm font-semibold text-gray-800 mb-4">费用单价设置</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">水费单价 (元/吨)</label>
            <input v-model="form.waterRate" type="number" step="0.01" min="0"
                   class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            <p class="text-xs text-gray-400 mt-1">当前值: {{ settings.waterRate }} 元/吨</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">电费单价 (元/度)</label>
            <input v-model="form.electricRate" type="number" step="0.01" min="0"
                   class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" />
            <p class="text-xs text-gray-400 mt-1">当前值: {{ settings.electricRate }} 元/度</p>
          </div>
          <button @click="saveSettings"
                  class="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors">
            保存设置
          </button>
        </div>
      </div>

      <!-- 数据管理 -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 class="text-sm font-semibold text-gray-800 mb-4">数据管理</h3>
        <div class="space-y-3">
          <button @click="exportData"
                  class="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            导出数据备份
          </button>
          <button @click="showImport = true"
                  class="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            导入数据
          </button>
        </div>
      </div>

      <!-- 导入 Modal -->
      <ModalDialog :show="showImport" title="导入数据" @close="showImport = false">
        <div class="space-y-4">
          <p class="text-sm text-gray-500">粘贴之前导出的 JSON 数据来恢复备份。将覆盖当前所有数据，请谨慎操作。</p>
          <textarea v-model="importText" rows="8"
                    placeholder="在此粘贴导出的 JSON 数据..."
                    class="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"></textarea>
          <div class="flex gap-3">
            <button @click="showImport = false"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">取消</button>
            <button @click="importData"
                    class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors">导入</button>
          </div>
        </div>
      </ModalDialog>

      <!-- 关于信息 -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 class="text-sm font-semibold text-gray-800 mb-2">关于</h3>
        <p class="text-xs text-gray-400">
          出租屋管理系统 v1.0<br>
          纯前端应用，数据存储在浏览器本地<br>
          建议定期导出数据备份
        </p>
      </div>
    </div>
  `
};

// ========================================================================
// 主应用
// ========================================================================
const App = {
  components: {
    ModalDialog, ConfirmDialog,
    'dashboard-view': DashboardView,
    'rooms-view': RoomsView,
    'tenants-view': TenantsView,
    'readings-view': ReadingsView,
    'bills-view': BillsView,
    'settings-view': SettingsView
  },
  setup() {
    const { stats } = useStore();

    const currentView = computed(() => currentPage.value + '-view');

    // 从 URL hash 恢复页面状态（支持浏览器前进/后退）
    function onHashChange() {
      const hash = window.location.hash.slice(1) || 'dashboard';
      currentPage.value = hash;
    }

    onMounted(() => {
      window.addEventListener('hashchange', onHashChange);
      onHashChange();
    });

    function doNavigate(page) {
      window.location.hash = page;
      currentPage.value = page;
      sidebarOpen.value = false;
      window.scrollTo(0, 0);
    }

    return { currentPage, currentView, navItems, stats, sidebarOpen, doNavigate, utils, toasts, getIcon };
  },
  template: `
    <div class="min-h-screen bg-gray-50 flex flex-col">
      <!-- Toast 通知 -->
      <div class="fixed top-4 right-4 z-[100] space-y-2">
        <TransitionGroup name="toast">
          <div v-for="toast in toasts" :key="toast.id"
               class="px-4 py-3 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2"
               :class="toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'">
            <svg v-if="toast.type === 'error'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            {{ toast.message }}
          </div>
        </TransitionGroup>
      </div>

      <!-- 移动端顶部栏 -->
      <header class="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">租</div>
          <span class="font-semibold text-gray-900">出租屋管理</span>
        </div>
        <button @click="sidebarOpen = !sidebarOpen" class="p-1.5 hover:bg-gray-100 rounded-lg">
          <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
      </header>

      <!-- 移动端侧边栏遮罩 -->
      <Transition name="modal">
        <div v-if="sidebarOpen" class="fixed inset-0 z-40 lg:hidden" @click="sidebarOpen = false">
          <div class="fixed inset-0 bg-black/30"></div>
        </div>
      </Transition>

      <div class="flex flex-1">
        <!-- 侧边栏 / 桌面导航 -->
        <aside class="fixed lg:sticky top-0 left-0 z-50 h-full w-56 bg-white border-r border-gray-100 transform transition-transform duration-200 lg:transform-none"
               :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'">
          <div class="p-5 border-b border-gray-100 hidden lg:block">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">租</div>
              <div>
                <h1 class="font-semibold text-gray-900 text-sm">出租屋管理</h1>
                <p class="text-xs text-gray-400">自用管理系统</p>
              </div>
            </div>
          </div>
          <nav class="p-3 space-y-1">
            <button v-for="item in navItems" :key="item.id"
                    @click="doNavigate(item.id)"
                    class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all"
                    :class="currentPage === item.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50'">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                   :class="currentPage === item.id ? 'text-indigo-500' : 'text-gray-400'">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="getIcon(item.icon)" />
              </svg>
              {{ item.label }}
            </button>
          </nav>
          <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
            <p class="text-xs text-gray-400 text-center">{{ utils.getToday() }}</p>
          </div>
        </aside>

        <!-- 主内容区 -->
        <main class="flex-1 min-h-screen pb-20 lg:pb-6">
          <div class="max-w-2xl mx-auto px-4 py-6">
            <Transition name="page" mode="out-in">
              <component :is="currentView" :key="currentPage" />
            </Transition>
          </div>
        </main>
      </div>

      <!-- 移动端底部导航 -->
      <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30 safe-bottom">
        <div class="flex items-center justify-around px-2 py-1">
          <button v-for="item in navItems.slice(0, 5)" :key="item.id"
                  @click="doNavigate(item.id)"
                  class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0"
                  :class="currentPage === item.id ? 'text-indigo-600' : 'text-gray-400'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="getIcon(item.icon)" />
            </svg>
            <span class="text-[10px] font-medium truncate">{{ item.label }}</span>
          </button>
          <!-- 设置的入口 -->
          <button @click="doNavigate('settings')"
                  class="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-0"
                  :class="currentPage === 'settings' ? 'text-indigo-600' : 'text-gray-400'">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" :d="getIcon('settings')" />
            </svg>
            <span class="text-[10px] font-medium">设置</span>
          </button>
        </div>
      </nav>
    </div>
  `
};

// ========================================================================
// 启动应用
// ========================================================================
const app = createApp(App);
app.component('modal-dialog', ModalDialog);
app.component('confirm-dialog', ConfirmDialog);
app.mount('#app');

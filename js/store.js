/**
 * 出租屋管理系统 - 数据管理层
 * 使用 LocalStorage 持久化数据
 */

const Store = {
  // 初始化默认数据
  defaultData: {
    rooms: [],
    tenants: [],
    meterReadings: [],
    bills: [],
    settings: {
      waterRate: 4.0,      // 水费单价（元/吨）
      electricRate: 1.0,   // 电费单价（元/度）
    }
  },

  // 生成唯一 ID
  _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },

  // 获取所有数据
  getAll() {
    try {
      const raw = localStorage.getItem('rental_manager_data');
      if (raw) {
        const data = JSON.parse(raw);
        // 确保 settings 存在
        if (!data.settings) data.settings = { ...this.defaultData.settings };
        return data;
      }
    } catch (e) {
      console.error('读取数据失败:', e);
    }
    return JSON.parse(JSON.stringify(this.defaultData));
  },

  // 保存所有数据
  _save(data) {
    try {
      localStorage.setItem('rental_manager_data', JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('保存数据失败:', e);
      return false;
    }
  },

  // ====== 房间管理 ======

  getRooms() {
    return this.getAll().rooms;
  },

  getRoom(id) {
    return this.getRooms().find(r => r.id === id);
  },

  addRoom(roomData) {
    const data = this.getAll();
    const room = {
      id: this._genId(),
      name: roomData.name,
      floor: roomData.floor || 1,
      area: roomData.area || 0,
      status: 'vacant',
      notes: roomData.notes || '',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    data.rooms.push(room);
    this._save(data);
    return room;
  },

  updateRoom(id, updates) {
    const data = this.getAll();
    const idx = data.rooms.findIndex(r => r.id === id);
    if (idx === -1) return null;
    Object.assign(data.rooms[idx], updates);
    this._save(data);
    return data.rooms[idx];
  },

  deleteRoom(id) {
    const data = this.getAll();
    // 检查是否有租客
    const hasTenant = data.tenants.some(t => t.roomId === id && t.status === 'active');
    if (hasTenant) return false;
    data.rooms = data.rooms.filter(r => r.id !== id);
    // 同时删除相关的电表读数和账单
    data.meterReadings = data.meterReadings.filter(m => m.roomId !== id);
    data.bills = data.bills.filter(b => b.roomId !== id);
    this._save(data);
    return true;
  },

  // 获取房间当前租客
  getRoomCurrentTenant(roomId) {
    return this.getTenants().find(t => t.roomId === roomId && t.status === 'active');
  },

  // ====== 租客管理 ======

  getTenants() {
    return this.getAll().tenants;
  },

  getTenant(id) {
    return this.getTenants().find(t => t.id === id);
  },

  addTenant(tenantData) {
    const data = this.getAll();
    const tenant = {
      id: this._genId(),
      name: tenantData.name,
      phone: tenantData.phone || '',
      idNumber: tenantData.idNumber || '',
      roomId: tenantData.roomId,
      rentAmount: parseFloat(tenantData.rentAmount) || 0,
      deposit: parseFloat(tenantData.deposit) || 0,
      checkInDate: tenantData.checkInDate,
      checkOutDate: null,
      status: 'active',
      notes: tenantData.notes || '',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    data.tenants.push(tenant);
    // 更新房间状态为已租
    const room = data.rooms.find(r => r.id === tenant.roomId);
    if (room) room.status = 'occupied';
    this._save(data);
    return tenant;
  },

  updateTenant(id, updates) {
    const data = this.getAll();
    const idx = data.tenants.findIndex(t => t.id === id);
    if (idx === -1) return null;
    Object.assign(data.tenants[idx], updates);
    this._save(data);
    return data.tenants[idx];
  },

  // 退租
  checkoutTenant(id, checkOutDate) {
    const data = this.getAll();
    const tenant = data.tenants.find(t => t.id === id);
    if (!tenant) return null;
    tenant.status = 'inactive';
    tenant.checkOutDate = checkOutDate;
    // 更新房间状态为空置
    const room = data.rooms.find(r => r.id === tenant.roomId);
    if (room) room.status = 'vacant';
    this._save(data);
    return tenant;
  },

  deleteTenant(id) {
    const data = this.getAll();
    data.tenants = data.tenants.filter(t => t.id !== id);
    this._save(data);
    return true;
  },

  // ====== 水电表读数 ======

  getMeterReadings(roomId) {
    const data = this.getAll();
    let readings = data.meterReadings;
    if (roomId) {
      readings = readings.filter(r => r.roomId === roomId);
    }
    return readings.sort((a, b) => b.date.localeCompare(a.date));
  },

  getLatestReading(roomId) {
    const readings = this.getMeterReadings(roomId);
    return readings.length > 0 ? readings[0] : null;
  },

  getPreviousReading(roomId, date) {
    const readings = this.getMeterReadings(roomId)
      .filter(r => r.date < date)
      .sort((a, b) => b.date.localeCompare(a.date));
    return readings.length > 0 ? readings[0] : null;
  },

  addMeterReading(readingData) {
    const data = this.getAll();
    const reading = {
      id: this._genId(),
      roomId: readingData.roomId,
      date: readingData.date,
      waterReading: parseFloat(readingData.waterReading) || 0,
      electricReading: parseFloat(readingData.electricReading) || 0,
      notes: readingData.notes || '',
      createdAt: new Date().toISOString().slice(0, 10)
    };
    data.meterReadings.push(reading);
    this._save(data);
    return reading;
  },

  deleteMeterReading(id) {
    const data = this.getAll();
    data.meterReadings = data.meterReadings.filter(m => m.id !== id);
    this._save(data);
    return true;
  },

  // ====== 账单管理 ======

  getBills(filters = {}) {
    let bills = this.getAll().bills;
    if (filters.roomId) bills = bills.filter(b => b.roomId === filters.roomId);
    if (filters.status) bills = bills.filter(b => b.status === filters.status);
    if (filters.month) bills = bills.filter(b => b.period === filters.month);
    return bills.sort((a, b) => b.period.localeCompare(a.period) || a.roomId.localeCompare(b.roomId));
  },

  getBill(id) {
    return this.getAll().bills.find(b => b.id === id);
  },

  // 生成账单
  generateBill({ roomId, tenantId, period, waterReading, electricReading,
                 waterRate, electricRate, rentAmount, otherFees, notes }) {
    const data = this.getAll();

    // 获取上次读数
    const prevReading = this.getPreviousReading(roomId, period + '-01');

    const waterPrev = prevReading ? prevReading.waterReading : 0;
    const electricPrev = prevReading ? prevReading.electricReading : 0;
    const waterUsage = (parseFloat(waterReading) - waterPrev).toFixed(1);
    const electricUsage = (parseFloat(electricReading) - electricPrev).toFixed(1);

    const waterCost = (waterUsage * waterRate).toFixed(2);
    const electricCost = (electricUsage * electricRate).toFixed(2);
    const totalAmount = (
      parseFloat(rentAmount) +
      parseFloat(waterCost) +
      parseFloat(electricCost) +
      parseFloat(otherFees || 0)
    ).toFixed(2);

    const bill = {
      id: this._genId(),
      roomId,
      tenantId,
      period,
      waterPrevReading: waterPrev,
      waterCurrReading: parseFloat(waterReading),
      waterUsage: parseFloat(waterUsage),
      waterRate: parseFloat(waterRate),
      waterCost: parseFloat(waterCost),
      electricPrevReading: electricPrev,
      electricCurrReading: parseFloat(electricReading),
      electricUsage: parseFloat(electricUsage),
      electricRate: parseFloat(electricRate),
      electricCost: parseFloat(electricCost),
      rentAmount: parseFloat(rentAmount),
      otherFees: parseFloat(otherFees || 0),
      totalAmount: parseFloat(totalAmount),
      status: 'pending',
      generatedDate: new Date().toISOString().slice(0, 10),
      paidDate: null,
      notes: notes || '',
      createdAt: new Date().toISOString().slice(0, 10)
    };

    data.bills.push(bill);
    this._save(data);
    return bill;
  },

  // 标记账单已支付
  markBillPaid(id, paidDate) {
    const data = this.getAll();
    const bill = data.bills.find(b => b.id === id);
    if (!bill) return null;
    bill.status = 'paid';
    bill.paidDate = paidDate || new Date().toISOString().slice(0, 10);
    this._save(data);
    return bill;
  },

  deleteBill(id) {
    const data = this.getAll();
    data.bills = data.bills.filter(b => b.id !== id);
    this._save(data);
    return true;
  },

  // ====== 设置 ======

  getSettings() {
    return this.getAll().settings;
  },

  updateSettings(settings) {
    const data = this.getAll();
    Object.assign(data.settings, settings);
    this._save(data);
    return data.settings;
  },

  // ====== 统计数据 ======

  getStats() {
    const data = this.getAll();
    const totalRooms = data.rooms.length;
    const occupiedRooms = data.rooms.filter(r => r.status === 'occupied').length;
    const vacantRooms = totalRooms - occupiedRooms;
    const activeTenants = data.tenants.filter(t => t.status === 'active').length;
    const pendingBills = data.bills.filter(b => b.status === 'pending').length;
    const totalPendingAmount = data.bills
      .filter(b => b.status === 'pending')
      .reduce((sum, b) => sum + b.totalAmount, 0);

    return {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      activeTenants,
      pendingBills,
      totalPendingAmount
    };
  },

  // ====== 数据导入导出 ======

  exportData() {
    return JSON.stringify(this.getAll(), null, 2);
  },

  importData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.rooms || !data.tenants) return false;
      this._save(data);
      return true;
    } catch (e) {
      console.error('导入数据失败:', e);
      return false;
    }
  }
};

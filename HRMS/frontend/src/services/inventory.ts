import api from '@/lib/api'

// ==================== Interfaces ====================

export interface ItemCategory {
  id: string
  name: string
  parent: string | null
  parent_name?: string
  gl_account: string
  is_asset_category: boolean
  description: string
  children?: ItemCategory[]
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  code: string
  name: string
  description: string
  category: string
  category_name?: string
  unit_of_measure: string
  reorder_level: number
  reorder_qty: number
  standard_cost: number
  is_stockable: boolean
  is_asset: boolean
  is_active: boolean
  current_stock?: number
  created_at: string
  updated_at: string
}

export interface Warehouse {
  id: string
  name: string
  code: string
  location: string
  manager: string | null
  manager_name?: string
  address: string
  is_active: boolean
  stock_count?: number
  total_value?: number
  created_at: string
  updated_at: string
}

export type StockEntryType = 'RECEIPT' | 'ISSUE' | 'TRANSFER' | 'ADJUSTMENT'
export type StockEntryStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface StockEntry {
  id: string
  entry_type: StockEntryType
  item: string
  item_name?: string
  item_code?: string
  warehouse: string
  warehouse_name?: string
  quantity: number
  unit_cost: number
  total_cost: number
  source: string
  source_reference: string
  reference_number: string
  status: StockEntryStatus
  notes: string
  from_warehouse: string | null
  from_warehouse_name?: string
  created_by_name?: string
  created_at: string
  updated_at: string
}

export interface StockLedger {
  id: string
  item: string
  item_name?: string
  item_code?: string
  warehouse: string
  warehouse_name?: string
  balance_qty: number
  valuation_amount: number
  last_movement_date: string
  average_cost: number
}

export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'SUM_OF_YEARS'
export type AssetStatus = 'ACTIVE' | 'DISPOSED' | 'TRANSFERRED' | 'UNDER_MAINTENANCE' | 'WRITTEN_OFF'

export interface Asset {
  id: string
  asset_number: string
  name: string
  description: string
  category: string
  category_name?: string
  item: string | null
  item_name?: string
  acquisition_date: string
  acquisition_cost: number
  current_value: number
  depreciation_method: DepreciationMethod
  useful_life_months: number
  salvage_value: number
  monthly_depreciation: number
  accumulated_depreciation: number
  location: string
  custodian: string | null
  custodian_name?: string
  department: string | null
  department_name?: string
  status: AssetStatus
  serial_number: string
  warranty_expiry: string | null
  created_at: string
  updated_at: string
}

export interface AssetDepreciation {
  id: string
  asset: string
  asset_name?: string
  asset_number?: string
  fiscal_period: string
  depreciation_amount: number
  accumulated_depreciation: number
  book_value: number
  journal_entry: string | null
  created_at: string
}

export type AssetTransferStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED'

export interface AssetTransfer {
  id: string
  asset: string
  asset_name?: string
  asset_number?: string
  from_location: string
  to_location: string
  from_custodian: string | null
  from_custodian_name?: string
  to_custodian: string | null
  to_custodian_name?: string
  transfer_date: string
  reason: string
  status: AssetTransferStatus
  approved_by: string | null
  approved_by_name?: string
  created_at: string
  updated_at: string
}

export type MaintenanceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'
export type MaintenanceStatus = 'SCHEDULED' | 'OVERDUE' | 'COMPLETED'

export interface MaintenanceSchedule {
  id: string
  asset: string
  asset_name?: string
  asset_number?: string
  description: string
  frequency: MaintenanceFrequency
  next_due_date: string
  vendor: string
  estimated_cost: number
  last_completed_date: string | null
  status: MaintenanceStatus
  notes: string
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// ==================== Filter Types ====================

export interface ItemFilters {
  search?: string
  category?: string
  is_active?: boolean
  is_asset?: boolean
  is_stockable?: boolean
  page?: number
  page_size?: number
}

export interface StockEntryFilters {
  entry_type?: StockEntryType
  status?: StockEntryStatus
  item?: string
  warehouse?: string
  search?: string
  page?: number
  page_size?: number
}

export interface StockLedgerFilters {
  item?: string
  warehouse?: string
  search?: string
  page?: number
  page_size?: number
}

export interface AssetFilters {
  search?: string
  status?: AssetStatus
  category?: string
  department?: string
  custodian?: string
  page?: number
  page_size?: number
}

export interface AssetDepreciationFilters {
  asset?: string
  fiscal_period?: string
  category?: string
  page?: number
  page_size?: number
}

export interface MaintenanceFilters {
  asset?: string
  status?: MaintenanceStatus
  frequency?: MaintenanceFrequency
  page?: number
  page_size?: number
}

export interface WarehouseFilters {
  search?: string
  is_active?: boolean
  page?: number
  page_size?: number
}

// ==================== Service ====================

export const inventoryService = {
  // ==================== Item Categories ====================

  getCategories: async (params?: Record<string, any>): Promise<ItemCategory[]> => {
    const response = await api.get('/inventory/categories/', { params: { page_size: 200, ...params } })
    return response.data.results || response.data
  },

  getCategory: async (id: string): Promise<ItemCategory> => {
    const response = await api.get(`/inventory/categories/${id}/`)
    return response.data
  },

  createCategory: async (data: Partial<ItemCategory>): Promise<ItemCategory> => {
    const response = await api.post('/inventory/categories/', data)
    return response.data
  },

  updateCategory: async (id: string, data: Partial<ItemCategory>): Promise<ItemCategory> => {
    const response = await api.patch(`/inventory/categories/${id}/`, data)
    return response.data
  },

  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/inventory/categories/${id}/`)
  },

  // ==================== Items ====================

  getItems: async (filters: ItemFilters = {}): Promise<PaginatedResponse<Item>> => {
    const response = await api.get('/inventory/items/', { params: filters })
    return response.data
  },

  getItem: async (id: string): Promise<Item> => {
    const response = await api.get(`/inventory/items/${id}/`)
    return response.data
  },

  createItem: async (data: Partial<Item>): Promise<Item> => {
    const response = await api.post('/inventory/items/', data)
    return response.data
  },

  updateItem: async (id: string, data: Partial<Item>): Promise<Item> => {
    const response = await api.patch(`/inventory/items/${id}/`, data)
    return response.data
  },

  deleteItem: async (id: string): Promise<void> => {
    await api.delete(`/inventory/items/${id}/`)
  },

  // ==================== Warehouses ====================

  getWarehouses: async (filters: WarehouseFilters = {}): Promise<PaginatedResponse<Warehouse>> => {
    const response = await api.get('/inventory/warehouses/', { params: filters })
    return response.data
  },

  getWarehouse: async (id: string): Promise<Warehouse> => {
    const response = await api.get(`/inventory/warehouses/${id}/`)
    return response.data
  },

  createWarehouse: async (data: Partial<Warehouse>): Promise<Warehouse> => {
    const response = await api.post('/inventory/warehouses/', data)
    return response.data
  },

  updateWarehouse: async (id: string, data: Partial<Warehouse>): Promise<Warehouse> => {
    const response = await api.patch(`/inventory/warehouses/${id}/`, data)
    return response.data
  },

  deleteWarehouse: async (id: string): Promise<void> => {
    await api.delete(`/inventory/warehouses/${id}/`)
  },

  // ==================== Stock Entries ====================

  getStockEntries: async (filters: StockEntryFilters = {}): Promise<PaginatedResponse<StockEntry>> => {
    const response = await api.get('/inventory/stock-entries/', { params: filters })
    return response.data
  },

  getStockEntry: async (id: string): Promise<StockEntry> => {
    const response = await api.get(`/inventory/stock-entries/${id}/`)
    return response.data
  },

  createStockEntry: async (data: Partial<StockEntry>): Promise<StockEntry> => {
    const response = await api.post('/inventory/stock-entries/', data)
    return response.data
  },

  updateStockEntry: async (id: string, data: Partial<StockEntry>): Promise<StockEntry> => {
    const response = await api.patch(`/inventory/stock-entries/${id}/`, data)
    return response.data
  },

  deleteStockEntry: async (id: string): Promise<void> => {
    await api.delete(`/inventory/stock-entries/${id}/`)
  },

  submitStockEntry: async (id: string): Promise<StockEntry> => {
    const response = await api.post(`/inventory/stock-entries/${id}/submit/`)
    return response.data
  },

  approveStockEntry: async (id: string): Promise<StockEntry> => {
    const response = await api.post(`/inventory/stock-entries/${id}/approve/`)
    return response.data
  },

  // ==================== Stock Ledger ====================

  getStockLedger: async (filters: StockLedgerFilters = {}): Promise<PaginatedResponse<StockLedger>> => {
    const response = await api.get('/inventory/stock-ledger/', { params: filters })
    return response.data
  },

  // ==================== Assets ====================

  getAssets: async (filters: AssetFilters = {}): Promise<PaginatedResponse<Asset>> => {
    const response = await api.get('/inventory/assets/', { params: filters })
    return response.data
  },

  getAsset: async (id: string): Promise<Asset> => {
    const response = await api.get(`/inventory/assets/${id}/`)
    return response.data
  },

  createAsset: async (data: Partial<Asset>): Promise<Asset> => {
    const response = await api.post('/inventory/assets/', data)
    return response.data
  },

  updateAsset: async (id: string, data: Partial<Asset>): Promise<Asset> => {
    const response = await api.patch(`/inventory/assets/${id}/`, data)
    return response.data
  },

  deleteAsset: async (id: string): Promise<void> => {
    await api.delete(`/inventory/assets/${id}/`)
  },

  disposeAsset: async (id: string, data?: { reason?: string; disposal_date?: string; disposal_value?: number }): Promise<Asset> => {
    const response = await api.post(`/inventory/assets/${id}/dispose/`, data)
    return response.data
  },

  transferAsset: async (id: string, data: {
    to_location: string
    to_custodian?: string
    reason: string
    transfer_date: string
  }): Promise<AssetTransfer> => {
    const response = await api.post(`/inventory/assets/${id}/transfer/`, data)
    return response.data
  },

  // ==================== Asset Depreciation ====================

  getDepreciations: async (filters: AssetDepreciationFilters = {}): Promise<PaginatedResponse<AssetDepreciation>> => {
    const response = await api.get('/inventory/asset-depreciations/', { params: filters })
    return response.data
  },

  getAssetDepreciations: async (assetId: string): Promise<AssetDepreciation[]> => {
    const response = await api.get('/inventory/asset-depreciations/', { params: { asset: assetId, page_size: 200 } })
    return response.data.results || response.data
  },

  // ==================== Asset Transfers ====================

  getAssetTransfers: async (params?: Record<string, any>): Promise<PaginatedResponse<AssetTransfer>> => {
    const response = await api.get('/inventory/asset-transfers/', { params })
    return response.data
  },

  getAssetTransfersByAsset: async (assetId: string): Promise<AssetTransfer[]> => {
    const response = await api.get('/inventory/asset-transfers/', { params: { asset: assetId, page_size: 200 } })
    return response.data.results || response.data
  },

  // ==================== Maintenance Schedules ====================

  getMaintenanceSchedules: async (filters: MaintenanceFilters = {}): Promise<PaginatedResponse<MaintenanceSchedule>> => {
    const response = await api.get('/inventory/maintenance-schedules/', { params: filters })
    return response.data
  },

  getMaintenanceSchedule: async (id: string): Promise<MaintenanceSchedule> => {
    const response = await api.get(`/inventory/maintenance-schedules/${id}/`)
    return response.data
  },

  createMaintenanceSchedule: async (data: Partial<MaintenanceSchedule>): Promise<MaintenanceSchedule> => {
    const response = await api.post('/inventory/maintenance-schedules/', data)
    return response.data
  },

  updateMaintenanceSchedule: async (id: string, data: Partial<MaintenanceSchedule>): Promise<MaintenanceSchedule> => {
    const response = await api.patch(`/inventory/maintenance-schedules/${id}/`, data)
    return response.data
  },

  deleteMaintenanceSchedule: async (id: string): Promise<void> => {
    await api.delete(`/inventory/maintenance-schedules/${id}/`)
  },

  completeMaintenanceSchedule: async (id: string): Promise<MaintenanceSchedule> => {
    const response = await api.post(`/inventory/maintenance-schedules/${id}/complete/`)
    return response.data
  },

  getAssetMaintenanceSchedules: async (assetId: string): Promise<MaintenanceSchedule[]> => {
    const response = await api.get('/inventory/maintenance-schedules/', { params: { asset: assetId, page_size: 200 } })
    return response.data.results || response.data
  },

  // ==================== Asset Disposals ====================
  getAssetDisposals: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/inventory/asset-disposals/', { params })
    return response.data
  },
  getAssetDisposal: async (id: string): Promise<any> => {
    const response = await api.get(`/inventory/asset-disposals/${id}/`)
    return response.data
  },
  createAssetDisposal: async (data: any): Promise<any> => {
    const response = await api.post('/inventory/asset-disposals/', data)
    return response.data
  },
  updateAssetDisposal: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/inventory/asset-disposals/${id}/`, data)
    return response.data
  },
  submitAssetDisposal: async (id: string): Promise<any> => {
    const response = await api.post(`/inventory/asset-disposals/${id}/submit/`)
    return response.data
  },
  approveAssetDisposal: async (id: string): Promise<any> => {
    const response = await api.post(`/inventory/asset-disposals/${id}/approve/`)
    return response.data
  },
  rejectAssetDisposal: async (id: string, data: { reason: string }): Promise<any> => {
    const response = await api.post(`/inventory/asset-disposals/${id}/reject/`, data)
    return response.data
  },

  // ==================== Cycle Counts ====================
  getCycleCounts: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/inventory/cycle-counts/', { params })
    return response.data
  },
  getCycleCount: async (id: string): Promise<any> => {
    const response = await api.get(`/inventory/cycle-counts/${id}/`)
    return response.data
  },
  createCycleCount: async (data: any): Promise<any> => {
    const response = await api.post('/inventory/cycle-counts/', data)
    return response.data
  },
  updateCycleCount: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/inventory/cycle-counts/${id}/`, data)
    return response.data
  },
  startCycleCount: async (id: string): Promise<any> => {
    const response = await api.post(`/inventory/cycle-counts/${id}/start/`)
    return response.data
  },
  completeCycleCount: async (id: string): Promise<any> => {
    const response = await api.post(`/inventory/cycle-counts/${id}/complete/`)
    return response.data
  },
  approveCycleCount: async (id: string): Promise<any> => {
    const response = await api.post(`/inventory/cycle-counts/${id}/approve/`)
    return response.data
  },
  getCycleCountItems: async (id: string): Promise<any[]> => {
    const response = await api.get(`/inventory/cycle-counts/${id}/items/`)
    return response.data.results || response.data
  },

  // ==================== Cycle Count Items ====================
  updateCycleCountItem: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/inventory/cycle-count-items/${id}/`, data)
    return response.data
  },
}

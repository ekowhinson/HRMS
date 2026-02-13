import api from '@/lib/api'

// ==================== Interfaces ====================

export type BOMStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE'

export interface BOMLine {
  id: string
  bom: string
  raw_material: string
  raw_material_name?: string
  quantity: number
  unit_of_measure: string
  scrap_percent: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface BillOfMaterials {
  id: string
  code: string
  name: string
  description: string
  finished_product: string
  version: number
  is_active: boolean
  yield_qty: number
  status: BOMStatus
  lines: BOMLine[]
  created_at: string
  updated_at: string
}

export interface WorkCenter {
  id: string
  code: string
  name: string
  description: string
  department: string
  department_name?: string
  warehouse: string
  warehouse_name?: string
  hourly_rate: number
  capacity_per_day: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductionRouting {
  id: string
  bom: string
  operation_number: number
  name: string
  description: string
  work_center: string
  work_center_name?: string
  setup_time_minutes: number
  run_time_minutes: number
  sort_order: number
  created_at: string
  updated_at: string
}

export type WorkOrderStatus = 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD'

export interface WorkOrder {
  id: string
  work_order_number: string
  bom: string
  product: string
  product_name?: string
  planned_qty: number
  completed_qty: number
  rejected_qty: number
  planned_start: string
  planned_end: string
  actual_start: string | null
  actual_end: string | null
  status: WorkOrderStatus
  priority: number
  project: string | null
  cost_center: string | null
  estimated_cost: number
  actual_cost: number
  notes: string
  completion_percent?: number
  created_at: string
  updated_at: string
}

export type WorkOrderOperationStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'

export interface WorkOrderOperation {
  id: string
  work_order: string
  routing: string
  operation_number: number
  name: string
  work_center: string
  work_center_name?: string
  planned_start: string
  planned_end: string
  actual_start: string | null
  actual_end: string | null
  setup_time: number
  run_time: number
  actual_time: number
  status: WorkOrderOperationStatus
  completed_by: string | null
  completed_by_name?: string
  created_at: string
  updated_at: string
}

export interface MaterialConsumption {
  id: string
  work_order: string
  item: string
  item_name?: string
  item_code?: string
  warehouse: string
  warehouse_name?: string
  planned_qty: number
  actual_qty: number
  stock_entry: string | null
  consumed_at: string
  created_at: string
  updated_at: string
}

export type QualityCheckType = 'IN_PROCESS' | 'FINAL' | 'INCOMING'
export type QualityCheckResult = 'PASS' | 'FAIL' | 'CONDITIONAL'

export interface QualityCheck {
  id: string
  work_order: string
  check_type: QualityCheckType
  parameter: string
  specification: string
  actual_value: string
  result: QualityCheckResult
  checked_by: string | null
  checked_by_name?: string
  checked_at: string
  notes: string
  created_at: string
  updated_at: string
}

export interface ProductionBatch {
  id: string
  batch_number: string
  work_order: string
  quantity: number
  manufacture_date: string
  expiry_date: string | null
  stock_entry: string | null
  journal_entry: string | null
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

export interface BOMFilters {
  search?: string
  status?: BOMStatus
  finished_product?: string
  is_active?: boolean
  page?: number
  page_size?: number
}

export interface BOMLineFilters {
  bom?: string
  page?: number
  page_size?: number
}

export interface WorkCenterFilters {
  search?: string
  department?: string
  is_active?: boolean
  page?: number
  page_size?: number
}

export interface ProductionRoutingFilters {
  bom?: string
  work_center?: string
  page?: number
  page_size?: number
}

export interface WorkOrderFilters {
  search?: string
  status?: WorkOrderStatus
  bom?: string
  product?: string
  priority?: number
  project?: string
  cost_center?: string
  planned_start_after?: string
  planned_start_before?: string
  page?: number
  page_size?: number
}

export interface WorkOrderOperationFilters {
  work_order?: string
  status?: WorkOrderOperationStatus
  work_center?: string
  page?: number
  page_size?: number
}

export interface MaterialConsumptionFilters {
  work_order?: string
  item?: string
  warehouse?: string
  page?: number
  page_size?: number
}

export interface QualityCheckFilters {
  work_order?: string
  check_type?: QualityCheckType
  result?: QualityCheckResult
  page?: number
  page_size?: number
}

export interface ProductionBatchFilters {
  work_order?: string
  page?: number
  page_size?: number
}

// ==================== Service ====================

export const manufacturingService = {
  // ==================== Bills of Materials ====================

  getBOMs: async (filters: BOMFilters = {}): Promise<PaginatedResponse<BillOfMaterials>> => {
    const response = await api.get('/manufacturing/boms/', { params: filters })
    return response.data
  },

  getBOM: async (id: string): Promise<BillOfMaterials> => {
    const response = await api.get(`/manufacturing/boms/${id}/`)
    return response.data
  },

  createBOM: async (data: Partial<BillOfMaterials>): Promise<BillOfMaterials> => {
    const response = await api.post('/manufacturing/boms/', data)
    return response.data
  },

  updateBOM: async (id: string, data: Partial<BillOfMaterials>): Promise<BillOfMaterials> => {
    const response = await api.patch(`/manufacturing/boms/${id}/`, data)
    return response.data
  },

  deleteBOM: async (id: string): Promise<void> => {
    await api.delete(`/manufacturing/boms/${id}/`)
  },

  activateBOM: async (id: string): Promise<BillOfMaterials> => {
    const response = await api.post(`/manufacturing/boms/${id}/activate/`)
    return response.data
  },

  deactivateBOM: async (id: string): Promise<BillOfMaterials> => {
    const response = await api.post(`/manufacturing/boms/${id}/deactivate/`)
    return response.data
  },

  copyBOMVersion: async (id: string): Promise<BillOfMaterials> => {
    const response = await api.post(`/manufacturing/boms/${id}/copy_version/`)
    return response.data
  },

  // ==================== BOM Lines ====================

  getBOMLines: async (bomId: string, filters: BOMLineFilters = {}): Promise<PaginatedResponse<BOMLine>> => {
    const response = await api.get('/manufacturing/bom-lines/', { params: { bom: bomId, ...filters } })
    return response.data
  },

  getBOMLine: async (id: string): Promise<BOMLine> => {
    const response = await api.get(`/manufacturing/bom-lines/${id}/`)
    return response.data
  },

  createBOMLine: async (data: Partial<BOMLine>): Promise<BOMLine> => {
    const response = await api.post('/manufacturing/bom-lines/', data)
    return response.data
  },

  updateBOMLine: async (id: string, data: Partial<BOMLine>): Promise<BOMLine> => {
    const response = await api.patch(`/manufacturing/bom-lines/${id}/`, data)
    return response.data
  },

  deleteBOMLine: async (id: string): Promise<void> => {
    await api.delete(`/manufacturing/bom-lines/${id}/`)
  },

  // ==================== Work Centers ====================

  getWorkCenters: async (filters: WorkCenterFilters = {}): Promise<PaginatedResponse<WorkCenter>> => {
    const response = await api.get('/manufacturing/work-centers/', { params: filters })
    return response.data
  },

  getWorkCenter: async (id: string): Promise<WorkCenter> => {
    const response = await api.get(`/manufacturing/work-centers/${id}/`)
    return response.data
  },

  createWorkCenter: async (data: Partial<WorkCenter>): Promise<WorkCenter> => {
    const response = await api.post('/manufacturing/work-centers/', data)
    return response.data
  },

  updateWorkCenter: async (id: string, data: Partial<WorkCenter>): Promise<WorkCenter> => {
    const response = await api.patch(`/manufacturing/work-centers/${id}/`, data)
    return response.data
  },

  deleteWorkCenter: async (id: string): Promise<void> => {
    await api.delete(`/manufacturing/work-centers/${id}/`)
  },

  // ==================== Production Routings ====================

  getProductionRoutings: async (bomId: string, filters: ProductionRoutingFilters = {}): Promise<PaginatedResponse<ProductionRouting>> => {
    const response = await api.get('/manufacturing/routings/', { params: { bom: bomId, ...filters } })
    return response.data
  },

  getProductionRouting: async (id: string): Promise<ProductionRouting> => {
    const response = await api.get(`/manufacturing/routings/${id}/`)
    return response.data
  },

  createProductionRouting: async (data: Partial<ProductionRouting>): Promise<ProductionRouting> => {
    const response = await api.post('/manufacturing/routings/', data)
    return response.data
  },

  updateProductionRouting: async (id: string, data: Partial<ProductionRouting>): Promise<ProductionRouting> => {
    const response = await api.patch(`/manufacturing/routings/${id}/`, data)
    return response.data
  },

  deleteProductionRouting: async (id: string): Promise<void> => {
    await api.delete(`/manufacturing/routings/${id}/`)
  },

  // ==================== Work Orders ====================

  getWorkOrders: async (filters: WorkOrderFilters = {}): Promise<PaginatedResponse<WorkOrder>> => {
    const response = await api.get('/manufacturing/work-orders/', { params: filters })
    return response.data
  },

  getWorkOrder: async (id: string): Promise<WorkOrder> => {
    const response = await api.get(`/manufacturing/work-orders/${id}/`)
    return response.data
  },

  createWorkOrder: async (data: Partial<WorkOrder>): Promise<WorkOrder> => {
    const response = await api.post('/manufacturing/work-orders/', data)
    return response.data
  },

  updateWorkOrder: async (id: string, data: Partial<WorkOrder>): Promise<WorkOrder> => {
    const response = await api.patch(`/manufacturing/work-orders/${id}/`, data)
    return response.data
  },

  deleteWorkOrder: async (id: string): Promise<void> => {
    await api.delete(`/manufacturing/work-orders/${id}/`)
  },

  releaseWorkOrder: async (id: string): Promise<WorkOrder> => {
    const response = await api.post(`/manufacturing/work-orders/${id}/release/`)
    return response.data
  },

  startWorkOrder: async (id: string): Promise<WorkOrder> => {
    const response = await api.post(`/manufacturing/work-orders/${id}/start/`)
    return response.data
  },

  completeWorkOrder: async (id: string): Promise<WorkOrder> => {
    const response = await api.post(`/manufacturing/work-orders/${id}/complete/`)
    return response.data
  },

  cancelWorkOrder: async (id: string): Promise<WorkOrder> => {
    const response = await api.post(`/manufacturing/work-orders/${id}/cancel/`)
    return response.data
  },

  holdWorkOrder: async (id: string): Promise<WorkOrder> => {
    const response = await api.post(`/manufacturing/work-orders/${id}/hold/`)
    return response.data
  },

  issueMaterials: async (id: string, data?: Record<string, any>): Promise<WorkOrder> => {
    const response = await api.post(`/manufacturing/work-orders/${id}/issue_materials/`, data)
    return response.data
  },

  reportProduction: async (id: string, data?: Record<string, any>): Promise<WorkOrder> => {
    const response = await api.post(`/manufacturing/work-orders/${id}/report_production/`, data)
    return response.data
  },

  // ==================== Work Order Operations ====================

  getWorkOrderOperations: async (workOrderId: string, filters: WorkOrderOperationFilters = {}): Promise<PaginatedResponse<WorkOrderOperation>> => {
    const response = await api.get('/manufacturing/work-order-operations/', { params: { work_order: workOrderId, ...filters } })
    return response.data
  },

  getWorkOrderOperation: async (id: string): Promise<WorkOrderOperation> => {
    const response = await api.get(`/manufacturing/work-order-operations/${id}/`)
    return response.data
  },

  createWorkOrderOperation: async (data: Partial<WorkOrderOperation>): Promise<WorkOrderOperation> => {
    const response = await api.post('/manufacturing/work-order-operations/', data)
    return response.data
  },

  updateWorkOrderOperation: async (id: string, data: Partial<WorkOrderOperation>): Promise<WorkOrderOperation> => {
    const response = await api.patch(`/manufacturing/work-order-operations/${id}/`, data)
    return response.data
  },

  deleteWorkOrderOperation: async (id: string): Promise<void> => {
    await api.delete(`/manufacturing/work-order-operations/${id}/`)
  },

  // ==================== Material Consumptions ====================

  getMaterialConsumptions: async (workOrderId: string, filters: MaterialConsumptionFilters = {}): Promise<PaginatedResponse<MaterialConsumption>> => {
    const response = await api.get('/manufacturing/material-consumptions/', { params: { work_order: workOrderId, ...filters } })
    return response.data
  },

  getMaterialConsumption: async (id: string): Promise<MaterialConsumption> => {
    const response = await api.get(`/manufacturing/material-consumptions/${id}/`)
    return response.data
  },

  createMaterialConsumption: async (data: Partial<MaterialConsumption>): Promise<MaterialConsumption> => {
    const response = await api.post('/manufacturing/material-consumptions/', data)
    return response.data
  },

  updateMaterialConsumption: async (id: string, data: Partial<MaterialConsumption>): Promise<MaterialConsumption> => {
    const response = await api.patch(`/manufacturing/material-consumptions/${id}/`, data)
    return response.data
  },

  deleteMaterialConsumption: async (id: string): Promise<void> => {
    await api.delete(`/manufacturing/material-consumptions/${id}/`)
  },

  // ==================== Quality Checks ====================

  getQualityChecks: async (workOrderId: string, filters: QualityCheckFilters = {}): Promise<PaginatedResponse<QualityCheck>> => {
    const response = await api.get('/manufacturing/quality-checks/', { params: { work_order: workOrderId, ...filters } })
    return response.data
  },

  getQualityCheck: async (id: string): Promise<QualityCheck> => {
    const response = await api.get(`/manufacturing/quality-checks/${id}/`)
    return response.data
  },

  createQualityCheck: async (data: Partial<QualityCheck>): Promise<QualityCheck> => {
    const response = await api.post('/manufacturing/quality-checks/', data)
    return response.data
  },

  updateQualityCheck: async (id: string, data: Partial<QualityCheck>): Promise<QualityCheck> => {
    const response = await api.patch(`/manufacturing/quality-checks/${id}/`, data)
    return response.data
  },

  deleteQualityCheck: async (id: string): Promise<void> => {
    await api.delete(`/manufacturing/quality-checks/${id}/`)
  },

  // ==================== Production Batches ====================

  getProductionBatches: async (workOrderId: string, filters: ProductionBatchFilters = {}): Promise<PaginatedResponse<ProductionBatch>> => {
    const response = await api.get('/manufacturing/production-batches/', { params: { work_order: workOrderId, ...filters } })
    return response.data
  },

  getProductionBatch: async (id: string): Promise<ProductionBatch> => {
    const response = await api.get(`/manufacturing/production-batches/${id}/`)
    return response.data
  },
}

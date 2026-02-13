import api from '@/lib/api'
import type { PaginatedResponse } from '@/types'

// ==================== Types ====================

export type RequisitionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'ORDERED'
export type POStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CLOSED' | 'CANCELLED'
export type GRNStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type InspectionStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'PARTIAL'
export type ContractType = 'SERVICE' | 'SUPPLY' | 'CONSULTING' | 'MAINTENANCE' | 'OTHER'
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'RENEWED'
export type MilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'

export interface RequisitionItem {
  id: string
  requisition: string
  description: string
  item: string | null
  item_name?: string
  quantity: number
  unit_of_measure: string
  unit_price: number
  estimated_total: number
  budget: string | null
  budget_name?: string
  notes: string
}

export interface PurchaseRequisition {
  id: string
  requisition_number: string
  requested_by: string | null
  requested_by_name?: string
  department: string | null
  department_name?: string
  cost_center: string | null
  cost_center_name?: string
  requisition_date: string
  required_date: string
  status: RequisitionStatus
  status_display?: string
  justification: string
  total_estimated: number
  approved_by: string | null
  approved_by_name?: string
  items?: RequisitionItem[]
  created_at: string
  updated_at: string
}

export interface PurchaseOrderItem {
  id: string
  purchase_order: string
  description: string
  item: string | null
  item_name?: string
  quantity: number
  unit_price: number
  tax_rate: number
  total: number
  received_qty: number
  requisition_item: string | null
}

export interface PurchaseOrder {
  id: string
  po_number: string
  vendor: string | null
  vendor_name?: string
  requisition: string | null
  requisition_number?: string
  order_date: string
  delivery_date: string
  status: POStatus
  status_display?: string
  total_amount: number
  payment_terms: string
  approved_by: string | null
  approved_by_name?: string
  notes: string
  items?: PurchaseOrderItem[]
  created_at: string
  updated_at: string
}

export interface GRNItem {
  id: string
  grn: string
  po_item: string
  po_item_description?: string
  received_qty: number
  accepted_qty: number
  rejected_qty: number
  rejection_reason: string
}

export interface GoodsReceiptNote {
  id: string
  grn_number: string
  purchase_order: string
  po_number?: string
  received_by: string | null
  received_by_name?: string
  receipt_date: string
  status: GRNStatus
  status_display?: string
  inspection_status: InspectionStatus
  inspection_status_display?: string
  notes: string
  items?: GRNItem[]
  created_at: string
  updated_at: string
}

export interface ContractMilestone {
  id: string
  contract: string
  description: string
  due_date: string
  amount: number
  status: MilestoneStatus
  status_display?: string
  completion_date: string | null
}

export interface Contract {
  id: string
  contract_number: string
  vendor: string | null
  vendor_name?: string
  contract_type: ContractType
  contract_type_display?: string
  start_date: string
  end_date: string
  value: number
  status: ContractStatus
  status_display?: string
  renewal_date: string | null
  description: string
  milestones?: ContractMilestone[]
  created_at: string
  updated_at: string
}

// ==================== Filter Types ====================

export interface RequisitionFilters {
  status?: string
  department?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
}

export interface POFilters {
  status?: string
  vendor?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
}

export interface GRNFilters {
  status?: string
  inspection_status?: string
  purchase_order?: string
  search?: string
  page?: number
}

export interface ContractFilters {
  status?: string
  contract_type?: string
  vendor?: string
  search?: string
  page?: number
}

// ==================== Service ====================

export const procurementService = {
  // ==================== Purchase Requisitions ====================

  getRequisitions: async (filters: RequisitionFilters = {}): Promise<PaginatedResponse<PurchaseRequisition>> => {
    const response = await api.get('/procurement/requisitions/', { params: filters })
    return response.data
  },

  getRequisition: async (id: string): Promise<PurchaseRequisition> => {
    const response = await api.get(`/procurement/requisitions/${id}/`)
    return response.data
  },

  createRequisition: async (data: Partial<PurchaseRequisition>): Promise<PurchaseRequisition> => {
    const response = await api.post('/procurement/requisitions/', data)
    return response.data
  },

  updateRequisition: async (id: string, data: Partial<PurchaseRequisition>): Promise<PurchaseRequisition> => {
    const response = await api.patch(`/procurement/requisitions/${id}/`, data)
    return response.data
  },

  deleteRequisition: async (id: string): Promise<void> => {
    await api.delete(`/procurement/requisitions/${id}/`)
  },

  submitRequisition: async (id: string): Promise<PurchaseRequisition> => {
    const response = await api.post(`/procurement/requisitions/${id}/submit/`)
    return response.data
  },

  approveRequisition: async (id: string): Promise<PurchaseRequisition> => {
    const response = await api.post(`/procurement/requisitions/${id}/approve/`)
    return response.data
  },

  rejectRequisition: async (id: string, data: { reason: string }): Promise<PurchaseRequisition> => {
    const response = await api.post(`/procurement/requisitions/${id}/reject/`, data)
    return response.data
  },

  // ==================== Purchase Orders ====================

  getPurchaseOrders: async (filters: POFilters = {}): Promise<PaginatedResponse<PurchaseOrder>> => {
    const response = await api.get('/procurement/purchase-orders/', { params: filters })
    return response.data
  },

  getPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await api.get(`/procurement/purchase-orders/${id}/`)
    return response.data
  },

  createPurchaseOrder: async (data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    const response = await api.post('/procurement/purchase-orders/', data)
    return response.data
  },

  updatePurchaseOrder: async (id: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> => {
    const response = await api.patch(`/procurement/purchase-orders/${id}/`, data)
    return response.data
  },

  deletePurchaseOrder: async (id: string): Promise<void> => {
    await api.delete(`/procurement/purchase-orders/${id}/`)
  },

  submitPurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await api.post(`/procurement/purchase-orders/${id}/submit/`)
    return response.data
  },

  approvePurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await api.post(`/procurement/purchase-orders/${id}/approve/`)
    return response.data
  },

  rejectPurchaseOrder: async (id: string, data: { reason: string }): Promise<PurchaseOrder> => {
    const response = await api.post(`/procurement/purchase-orders/${id}/reject/`, data)
    return response.data
  },

  issuePurchaseOrder: async (id: string): Promise<PurchaseOrder> => {
    const response = await api.post(`/procurement/purchase-orders/${id}/issue/`)
    return response.data
  },

  // ==================== Goods Receipt Notes ====================

  getGoodsReceipts: async (filters: GRNFilters = {}): Promise<PaginatedResponse<GoodsReceiptNote>> => {
    const response = await api.get('/procurement/goods-receipts/', { params: filters })
    return response.data
  },

  getGoodsReceipt: async (id: string): Promise<GoodsReceiptNote> => {
    const response = await api.get(`/procurement/goods-receipts/${id}/`)
    return response.data
  },

  createGoodsReceipt: async (data: Partial<GoodsReceiptNote>): Promise<GoodsReceiptNote> => {
    const response = await api.post('/procurement/goods-receipts/', data)
    return response.data
  },

  updateGoodsReceipt: async (id: string, data: Partial<GoodsReceiptNote>): Promise<GoodsReceiptNote> => {
    const response = await api.patch(`/procurement/goods-receipts/${id}/`, data)
    return response.data
  },

  deleteGoodsReceipt: async (id: string): Promise<void> => {
    await api.delete(`/procurement/goods-receipts/${id}/`)
  },

  submitGoodsReceipt: async (id: string): Promise<GoodsReceiptNote> => {
    const response = await api.post(`/procurement/goods-receipts/${id}/submit/`)
    return response.data
  },

  approveGoodsReceipt: async (id: string): Promise<GoodsReceiptNote> => {
    const response = await api.post(`/procurement/goods-receipts/${id}/approve/`)
    return response.data
  },

  // ==================== Contracts ====================

  getContracts: async (filters: ContractFilters = {}): Promise<PaginatedResponse<Contract>> => {
    const response = await api.get('/procurement/contracts/', { params: filters })
    return response.data
  },

  getContract: async (id: string): Promise<Contract> => {
    const response = await api.get(`/procurement/contracts/${id}/`)
    return response.data
  },

  createContract: async (data: Partial<Contract>): Promise<Contract> => {
    const response = await api.post('/procurement/contracts/', data)
    return response.data
  },

  updateContract: async (id: string, data: Partial<Contract>): Promise<Contract> => {
    const response = await api.patch(`/procurement/contracts/${id}/`, data)
    return response.data
  },

  deleteContract: async (id: string): Promise<void> => {
    await api.delete(`/procurement/contracts/${id}/`)
  },

  // ==================== Contract Milestones ====================

  getMilestones: async (contractId: string): Promise<ContractMilestone[]> => {
    const response = await api.get('/procurement/contract-milestones/', {
      params: { contract: contractId },
    })
    return response.data.results || response.data
  },

  createMilestone: async (data: Partial<ContractMilestone>): Promise<ContractMilestone> => {
    const response = await api.post('/procurement/contract-milestones/', data)
    return response.data
  },

  updateMilestone: async (id: string, data: Partial<ContractMilestone>): Promise<ContractMilestone> => {
    const response = await api.patch(`/procurement/contract-milestones/${id}/`, data)
    return response.data
  },

  deleteMilestone: async (id: string): Promise<void> => {
    await api.delete(`/procurement/contract-milestones/${id}/`)
  },

  // ==================== RFQs ====================
  getRFQs: async (filters: Record<string, any> = {}): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/procurement/rfqs/', { params: filters })
    return response.data
  },
  getRFQ: async (id: string): Promise<any> => {
    const response = await api.get(`/procurement/rfqs/${id}/`)
    return response.data
  },
  createRFQ: async (data: any): Promise<any> => {
    const response = await api.post('/procurement/rfqs/', data)
    return response.data
  },
  updateRFQ: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/procurement/rfqs/${id}/`, data)
    return response.data
  },
  deleteRFQ: async (id: string): Promise<void> => {
    await api.delete(`/procurement/rfqs/${id}/`)
  },
  sendRFQ: async (id: string): Promise<any> => {
    const response = await api.post(`/procurement/rfqs/${id}/send/`)
    return response.data
  },
  evaluateRFQ: async (id: string): Promise<any> => {
    const response = await api.post(`/procurement/rfqs/${id}/evaluate/`)
    return response.data
  },
  awardRFQ: async (id: string, vendorId: string): Promise<any> => {
    const response = await api.post(`/procurement/rfqs/${id}/award/`, { vendor_id: vendorId })
    return response.data
  },
  convertRFQToPO: async (id: string, vendorId: string): Promise<any> => {
    const response = await api.post(`/procurement/rfqs/${id}/convert-to-po/`, { vendor_id: vendorId })
    return response.data
  },

  // ==================== RFQ Vendors ====================
  getRFQVendors: async (rfqId: string): Promise<any[]> => {
    const response = await api.get('/procurement/rfq-vendors/', { params: { rfq: rfqId } })
    return response.data.results || response.data
  },
  createRFQVendor: async (data: any): Promise<any> => {
    const response = await api.post('/procurement/rfq-vendors/', data)
    return response.data
  },
  updateRFQVendor: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/procurement/rfq-vendors/${id}/`, data)
    return response.data
  },

  // ==================== RFQ Items ====================
  getRFQItems: async (rfqId: string): Promise<any[]> => {
    const response = await api.get('/procurement/rfq-items/', { params: { rfq: rfqId } })
    return response.data.results || response.data
  },
  createRFQItem: async (data: any): Promise<any> => {
    const response = await api.post('/procurement/rfq-items/', data)
    return response.data
  },

  // ==================== Vendor Scorecards ====================
  getVendorScorecards: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/procurement/vendor-scorecards/', { params })
    return response.data
  },
  createVendorScorecard: async (data: any): Promise<any> => {
    const response = await api.post('/procurement/vendor-scorecards/', data)
    return response.data
  },
  updateVendorScorecard: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/procurement/vendor-scorecards/${id}/`, data)
    return response.data
  },

  // ==================== Vendor Blacklist ====================
  getVendorBlacklist: async (params?: Record<string, any>): Promise<PaginatedResponse<any>> => {
    const response = await api.get('/procurement/vendor-blacklist/', { params })
    return response.data
  },
  createVendorBlacklist: async (data: any): Promise<any> => {
    const response = await api.post('/procurement/vendor-blacklist/', data)
    return response.data
  },
  updateVendorBlacklist: async (id: string, data: any): Promise<any> => {
    const response = await api.patch(`/procurement/vendor-blacklist/${id}/`, data)
    return response.data
  },
}

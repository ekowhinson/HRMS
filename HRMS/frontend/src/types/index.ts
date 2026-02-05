// User & Auth Types
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  role?: string
  is_active: boolean
  is_staff: boolean
  employee?: Employee
  roles: Role[]
}

export interface Role {
  id: string
  code: string
  name: string
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface LoginCredentials {
  email: string
  password: string
}

// Employee Types
export interface Employee {
  id: string
  employee_id?: string
  employee_number: string
  first_name: string
  middle_name?: string
  last_name: string
  full_name?: string
  email?: string
  personal_email?: string
  work_email?: string
  // Phone fields - backend uses mobile_phone
  phone_number?: string
  mobile_phone?: string
  home_phone?: string
  work_phone?: string
  date_of_birth?: string
  gender?: string
  marital_status?: string
  nationality?: string
  ghana_card_number?: string
  ssnit_number?: string
  tin_number?: string
  residential_address?: string
  residential_city?: string
  // Status fields - backend uses 'status'
  employment_status?: string
  status?: string
  employment_type?: string
  // Date fields - backend uses date_of_joining
  date_of_hire?: string
  date_of_joining?: string
  date_of_confirmation?: string
  confirmation_date?: string
  probation_end_date?: string
  date_of_exit?: string
  // Organization fields
  department?: string
  department_name?: string
  grade?: string
  grade_name?: string
  position?: string
  position_name?: string
  position_title?: string
  supervisor?: string
  supervisor_name?: string
  reports_to_name?: string
  work_location?: string
  work_location_name?: string
  cost_center?: string
  photo?: string
  photo_url?: string
  // Bank details (separate model in backend)
  bank_name?: string
  bank_branch?: string
  bank_account_number?: string
  // Related data
  education?: EmployeeEducation[]
  documents?: EmployeeDocument[]
  salary?: EmployeeSalary
  leave_balances?: LeaveBalance[]
  // Computed fields
  age?: number
  years_of_service?: number
  created_at?: string
  updated_at?: string
}

export interface EmployeeEducation {
  id: string
  degree: string
  institution: string
  field_of_study?: string
  start_year: number
  end_year?: number
}

export interface EmployeeDocument {
  id: string
  name: string
  type: string
  file_url: string
  uploaded_at: string
}

export interface EmployeeSalary {
  basic_salary: number
  total_allowances?: number
  gross_salary?: number
}

export type EmploymentStatus =
  | 'ACTIVE'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'PROBATION'
  | 'NOTICE'
  | 'TERMINATED'
  | 'RESIGNED'
  | 'RETIRED'
  | 'DECEASED'

export type EmploymentType =
  | 'PERMANENT'
  | 'CONTRACT'
  | 'TEMPORARY'
  | 'INTERN'
  | 'PART_TIME'

// Organization Types
export interface Department {
  id: string
  code: string
  name: string
  description?: string
  parent?: Department
  head?: Employee
}

export interface JobGrade {
  id: string
  code: string
  name: string
  level: number
  min_salary: number
  max_salary: number
}

export interface JobPosition {
  id: string
  code: string
  title: string
  description?: string
  department?: Department
  grade?: JobGrade
}

// Leave Types
export type LeaveAccrualType = 'NONE' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ON_HIRE'
export type LeaveGenderApplicability = 'M' | 'F' | 'A'

export interface LeaveType {
  id: string
  code: string
  name: string
  description?: string
  // Entitlement
  default_days: number
  max_days?: number
  min_days_per_request: number
  max_days_per_request?: number
  // Accrual settings
  accrual_type: LeaveAccrualType
  accrual_type_display?: string
  accrual_rate?: number
  // Carry forward
  allow_carry_forward: boolean
  max_carry_forward_days?: number
  carry_forward_expiry_months?: number
  // Encashment
  allow_encashment: boolean
  max_encashment_days?: number
  // Rules
  is_paid: boolean
  requires_approval: boolean
  requires_document: boolean
  document_required_after_days?: number
  min_service_months: number
  applies_to_gender: LeaveGenderApplicability
  applies_to_gender_display?: string
  max_instances_per_year?: number
  consecutive_days_only: boolean
  include_weekends: boolean
  include_holidays: boolean
  advance_notice_days: number
  // Display
  color_code: string
  sort_order: number
  is_active: boolean
  // Computed
  policy_count?: number
  balance_count?: number
  created_at?: string
  updated_at?: string
}

export interface LeaveBalance {
  id: string
  employee: Employee
  leave_type: LeaveType
  year: number
  opening_balance: number
  earned: number
  taken: number
  pending: number
  available_balance: number
}

export interface LeaveRequest {
  id: string
  request_number: string
  employee: Employee
  employee_name: string
  employee_number?: string
  leave_type: LeaveType
  leave_type_name: string
  start_date: string
  end_date: string
  number_of_days: number
  is_half_day?: boolean
  half_day_type?: string
  reason: string
  contact_address?: string
  contact_phone?: string
  handover_to?: string
  handover_notes?: string
  status: LeaveStatus
  submitted_at?: string
  approved_at?: string
  approved_by?: string
  rejection_reason?: string
  balance_at_request?: number
  created_at: string
  updated_at?: string
}

export type LeaveStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'RECALLED'

// Leave Calendar Event
export interface LeaveCalendarEvent {
  id: string
  request_number: string
  title: string
  employee: string
  employee_name: string
  employee_number: string
  employee_photo?: string
  department_name: string
  leave_type: string
  leave_type_name: string
  color: string
  start_date: string
  end_date: string
  number_of_days: number
  status: LeaveStatus
}

// Team Leave
export interface TeamLeaveRequest {
  id: string
  request_number: string
  employee: string
  employee_name: string
  employee_number: string
  employee_photo?: string
  position_title: string
  leave_type: string
  leave_type_name: string
  leave_type_color: string
  start_date: string
  end_date: string
  number_of_days: number
  status: LeaveStatus
  reason: string
  created_at: string
  approved_at?: string
}

export interface TeamLeaveSummary {
  on_leave_today: number
  pending_approvals: number
  total_team_members: number
}

// Team member
export interface TeamMember {
  id: string
  employee_number: string
  full_name: string
  first_name: string
  last_name: string
  photo?: string
  position_title: string
  work_email?: string
  mobile_phone?: string
  status: EmploymentStatus
  is_on_leave: boolean
}

// Team leave overview
export interface TeamLeaveOverview {
  team_size: number
  on_leave_today: Array<{
    id: string
    employee_id: string
    employee_name: string
    employee_photo?: string
    leave_type: string
    leave_type_color: string
    start_date: string
    end_date: string
  }>
  on_leave_count: number
  pending_approvals: number
  upcoming_leave: Array<{
    id: string
    employee_id: string
    employee_name: string
    leave_type: string
    start_date: string
    end_date: string
  }>
}

// Emergency Contact
export interface EmergencyContact {
  id: string
  name: string
  relationship: string
  phone_primary: string
  phone_secondary?: string
  email?: string
  address?: string
  is_primary: boolean
}

// Dependent
export interface Dependent {
  id: string
  name: string
  relationship: string
  date_of_birth: string
  gender: string
  age?: number
  ghana_card_number?: string
  is_disabled: boolean
  is_student: boolean
  school_name?: string
  is_eligible_for_benefits: boolean
  notes?: string
}

// Bank Account
export interface BankAccount {
  id: string
  bank_name: string
  bank_code?: string
  branch_name?: string
  branch_code?: string
  account_name: string
  account_number: string
  account_type: 'SAVINGS' | 'CURRENT' | 'OTHER'
  swift_code?: string
  is_primary: boolean
  is_active: boolean
  is_verified: boolean
  notes?: string
}

// Signup types
export interface SignupInitiateData {
  email: string
  employee_number?: string
  ghana_card_number?: string
}

export interface SignupVerifyResponse {
  valid: boolean
  email: string
  employee: {
    id: string
    employee_number: string
    full_name: string
    first_name: string
    last_name: string
    department_name?: string
    position_title?: string
    work_email?: string
    photo?: string
  }
}

export interface CompleteSignupData {
  token: string
  password: string
  confirm_password: string
}

// Payroll Types
export interface PayrollPeriod {
  id: string
  name: string
  year: number
  month: number
  start_date: string
  end_date: string
  status: string
}

export interface PayrollRun {
  id: string
  run_number: string
  payroll_period: PayrollPeriod
  period_name: string
  run_date: string
  status: string
  total_employees: number
  total_gross: number
  total_deductions: number
  total_net: number
  total_paye: number
  total_ssnit_employee: number
  total_ssnit_employer: number
  total_tier2_employer: number
  total_employer_cost: number
  computed_at?: string
  approved_at?: string
  paid_at?: string
}

export type PayrollStatus =
  | 'DRAFT'
  | 'COMPUTED'
  | 'PENDING'
  | 'APPROVED'
  | 'PAID'
  | 'CANCELLED'

export interface PayrollItem {
  id: string
  employee: Employee
  payroll_run: PayrollRun
  basic_salary: number
  gross_salary: number
  total_deductions: number
  net_salary: number
  paye: number
  ssnit_employee: number
}

// Benefits Types
export interface LoanType {
  id: string
  code: string
  name: string
  interest_rate: number
  max_amount: number
  max_tenure_months: number
}

export interface LoanAccount {
  id: string
  loan_number: string
  employee: Employee
  loan_type: LoanType
  loan_type_name: string
  principal_amount: number
  interest_rate: number
  tenure_months: number
  monthly_deduction: number
  outstanding_balance: number
  payments_made: number
  total_payments: number
  status: string
}

export interface BenefitClaim {
  id: string
  employee: Employee
  benefit_type: string
  benefit_type_name: string
  amount: number
  description: string
  status: string
  created_at: string
  approved_at?: string
  approved_by?: string
}

// Payslip Types
export interface Payslip {
  id: string
  employee: Employee
  payroll_run: PayrollRun
  period_name: string
  payment_date: string
  basic_salary: number
  gross_pay: number
  net_pay: number
  paye_tax: number
  ssnit_employee: number
  ssnit_employer: number
  total_deductions: number
  allowances?: { name: string; amount: number }[]
  other_deductions?: { name: string; amount: number }[]
}

// Dashboard Types
export interface DashboardStats {
  total_employees: number
  new_hires_this_month: number
  pending_leave_requests: number
  active_loans: number
  latest_payroll: {
    period: string
    total_employees: number
    total_gross: number
    total_net: number
  }
}

// API Response Types
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  detail?: string
  message?: string
  errors?: Record<string, string[]>
}

// Pay Component Types
export type ComponentType = 'EARNING' | 'DEDUCTION' | 'EMPLOYER'

export type CalculationType = 'FIXED' | 'PCT_BASIC' | 'PCT_GROSS' | 'FORMULA' | 'LOOKUP'

export type ComponentCategory =
  | 'BASIC'
  | 'ALLOWANCE'
  | 'BONUS'
  | 'STATUTORY'
  | 'OVERTIME'
  | 'SHIFT'
  | 'LOAN'
  | 'FUND'
  | 'OTHER'

export interface PayComponent {
  id: string
  code: string
  name: string
  short_name?: string
  description?: string
  component_type: ComponentType
  component_type_display?: string
  calculation_type: CalculationType
  calculation_type_display?: string
  category: ComponentCategory
  category_display?: string
  default_amount?: number
  percentage_value?: number
  formula?: string
  is_taxable: boolean
  reduces_taxable: boolean
  is_overtime: boolean
  is_bonus: boolean
  is_part_of_basic: boolean
  is_part_of_gross: boolean
  affects_ssnit: boolean
  is_statutory: boolean
  is_recurring: boolean
  is_prorated: boolean
  is_arrears_applicable: boolean
  requires_approval: boolean
  approval_threshold?: number
  display_order: number
  show_on_payslip: boolean
  is_active: boolean
  transaction_count?: number
  created_at?: string
  updated_at?: string
}

// Employee Transaction Types
export type TransactionOverrideType = 'NONE' | 'FIXED' | 'PCT' | 'FORMULA'

export type TransactionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'COMPLETED'
  | 'CANCELLED'

export interface EmployeeTransaction {
  id: string
  reference_number: string
  employee: string
  employee_name?: string
  employee_number?: string
  department_name?: string
  pay_component: string
  component_code?: string
  component_name?: string
  component_type?: ComponentType
  override_type: TransactionOverrideType
  override_type_display?: string
  override_amount?: number
  override_percentage?: number
  override_formula?: string
  is_recurring: boolean
  effective_from: string
  effective_to?: string
  payroll_period?: string
  payroll_period_name?: string
  status: TransactionStatus
  status_display?: string
  approved_by?: string
  approved_by_name?: string
  approved_at?: string
  approval_notes?: string
  description?: string
  supporting_document?: string
  calculated_amount?: string
  created_at?: string
  updated_at?: string
}

export interface EmployeeTransactionCreate {
  employee?: string
  employee_ids?: string[]
  pay_component: string
  override_type: TransactionOverrideType
  override_amount?: number
  override_percentage?: number
  override_formula?: string
  is_recurring: boolean
  effective_from: string
  effective_to?: string
  payroll_period?: string
  description?: string
  supporting_document?: File
}

export interface FormulaValidationResult {
  valid: boolean
  formula: string
  test_basic?: string
  test_gross?: string
  result?: string
  error?: string
}

export interface BulkTransactionCreate {
  employee_ids: string[]
  pay_component: string
  override_type: TransactionOverrideType
  override_amount?: number
  override_percentage?: number
  override_formula?: string
  is_recurring: boolean
  effective_from: string
  effective_to?: string
  payroll_period?: string
  description?: string
}

// PAYE Tax Bracket
export interface TaxBracket {
  id: string
  name: string
  min_amount: number
  max_amount?: number
  rate: number
  cumulative_tax: number
  effective_from: string
  effective_to?: string
  is_active: boolean
  order: number
  created_at?: string
  updated_at?: string
}

// Overtime & Bonus Tax Configuration
export interface OvertimeBonusTaxConfig {
  id: string
  name: string
  description?: string
  // Overtime configuration
  overtime_annual_salary_threshold: number
  overtime_basic_percentage_threshold: number
  overtime_rate_below_threshold: number
  overtime_rate_above_threshold: number
  // Bonus configuration
  bonus_annual_basic_percentage_threshold: number
  bonus_flat_rate: number
  bonus_excess_to_paye: boolean
  // Non-resident rates
  non_resident_overtime_rate: number
  non_resident_bonus_rate: number
  // Validity
  effective_from: string
  effective_to?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface TaxCalculationPreview {
  config: OvertimeBonusTaxConfig
  inputs: {
    basic_salary: string
    annual_salary: string
    annual_basic: string
    overtime_amount: string
    bonus_amount: string
    is_resident: boolean
  }
  overtime: {
    qualifies_for_preferential_rate: boolean
    salary_threshold: string
    basic_percentage_threshold: string
    overtime_tax: string
    overtime_to_paye: string
    explanation: string
  }
  bonus: {
    threshold_amount: string
    bonus_tax: string
    bonus_excess_to_paye: string
  }
}

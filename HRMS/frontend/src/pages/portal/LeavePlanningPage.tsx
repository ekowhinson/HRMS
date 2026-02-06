import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CalendarDaysIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'
import { leaveService, type LeavePlan, type LeavePlanEntry, type LeaveReminder } from '@/services/leave'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Table from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'

const planStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  REVISION: 'warning',
}

const entryStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PLANNED: 'default',
  REQUESTED: 'info',
  TAKEN: 'success',
  CANCELLED: 'danger',
  RESCHEDULED: 'warning',
}

const cfStatusColors: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
  PENDING: 'warning',
  HR_APPROVED: 'info',
  AWAITING_CEO: 'warning',
  CEO_APPROVED: 'success',
  APPROVED: 'success',
  REJECTED: 'danger',
  PROCESSED: 'success',
}

export default function LeavePlanningPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('plans')
  const [currentYear] = useState(new Date().getFullYear())
  const [showCreatePlanModal, setShowCreatePlanModal] = useState(false)
  const [showAddEntryModal, setShowAddEntryModal] = useState(false)
  const [showCarryForwardModal, setShowCarryForwardModal] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<LeavePlan | null>(null)

  const [planForm, setPlanForm] = useState({
    year: currentYear,
    employee_notes: '',
  })

  const [entryForm, setEntryForm] = useState({
    leave_plan: '',
    leave_type: '',
    start_date: '',
    end_date: '',
    description: '',
    quarter: '',
  })

  const [cfForm, setCfForm] = useState({
    from_year: currentYear - 1,
    to_year: currentYear,
    available_balance: '',
    requested_carry_forward: '',
    reason: '',
  })

  // Queries
  const { data: myPlans, isLoading: plansLoading } = useQuery({
    queryKey: ['my-leave-plans'],
    queryFn: leaveService.getMyLeavePlans,
  })

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => leaveService.getLeaveTypes(),
  })

  const { data: myBalances } = useQuery({
    queryKey: ['my-balances'],
    queryFn: leaveService.getMyBalances,
  })

  const { data: myCarryForwardRequests } = useQuery({
    queryKey: ['my-carry-forward'],
    queryFn: leaveService.getMyCarryForwardRequests,
  })

  const { data: myReminders } = useQuery({
    queryKey: ['my-leave-reminders'],
    queryFn: leaveService.getMyReminders,
  })

  // Mutations
  const createPlanMutation = useMutation({
    mutationFn: leaveService.createLeavePlan,
    onSuccess: () => {
      toast.success('Leave plan created')
      queryClient.invalidateQueries({ queryKey: ['my-leave-plans'] })
      setShowCreatePlanModal(false)
      setPlanForm({ year: currentYear, employee_notes: '' })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create plan')
    },
  })

  const submitPlanMutation = useMutation({
    mutationFn: leaveService.submitLeavePlan,
    onSuccess: () => {
      toast.success('Leave plan submitted for approval')
      queryClient.invalidateQueries({ queryKey: ['my-leave-plans'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit plan')
    },
  })

  const addEntryMutation = useMutation({
    mutationFn: leaveService.createLeavePlanEntry,
    onSuccess: () => {
      toast.success('Leave entry added')
      queryClient.invalidateQueries({ queryKey: ['my-leave-plans'] })
      setShowAddEntryModal(false)
      setEntryForm({
        leave_plan: '',
        leave_type: '',
        start_date: '',
        end_date: '',
        description: '',
        quarter: '',
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to add entry')
    },
  })

  const deleteEntryMutation = useMutation({
    mutationFn: leaveService.deleteLeavePlanEntry,
    onSuccess: () => {
      toast.success('Entry deleted')
      queryClient.invalidateQueries({ queryKey: ['my-leave-plans'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete entry')
    },
  })

  const createCfMutation = useMutation({
    mutationFn: leaveService.createCarryForwardRequest,
    onSuccess: () => {
      toast.success('Carry forward request submitted')
      queryClient.invalidateQueries({ queryKey: ['my-carry-forward'] })
      setShowCarryForwardModal(false)
      setCfForm({
        from_year: currentYear - 1,
        to_year: currentYear,
        available_balance: '',
        requested_carry_forward: '',
        reason: '',
      })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to submit request')
    },
  })

  const acknowledgeReminderMutation = useMutation({
    mutationFn: leaveService.acknowledgeReminder,
    onSuccess: () => {
      toast.success('Reminder acknowledged')
      queryClient.invalidateQueries({ queryKey: ['my-leave-reminders'] })
    },
  })

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault()
    const annualBalance = myBalances?.find((b: any) =>
      ['AL', 'ANNUAL', 'ANNUAL_LEAVE'].includes(b.leave_type_code)
    )
    createPlanMutation.mutate({
      year: planForm.year,
      leave_entitlement: annualBalance?.opening_balance || 0,
      brought_forward: 0, // Backend will calculate based on previous year
      employee_notes: planForm.employee_notes,
    })
  }

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault()
    const startDate = new Date(entryForm.start_date)
    const endDate = new Date(entryForm.end_date)
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

    addEntryMutation.mutate({
      leave_plan: selectedPlan?.id || entryForm.leave_plan,
      leave_type: entryForm.leave_type,
      start_date: entryForm.start_date,
      end_date: entryForm.end_date,
      number_of_days: days,
      description: entryForm.description,
      quarter: entryForm.quarter ? parseInt(entryForm.quarter) : undefined,
    })
  }

  const handleCreateCarryForward = (e: React.FormEvent) => {
    e.preventDefault()
    createCfMutation.mutate({
      from_year: cfForm.from_year,
      to_year: cfForm.to_year,
      available_balance: parseFloat(cfForm.available_balance),
      requested_carry_forward: parseFloat(cfForm.requested_carry_forward),
      reason: cfForm.reason,
    })
  }

  const calculateDays = () => {
    if (!entryForm.start_date || !entryForm.end_date) return 0
    const startDate = new Date(entryForm.start_date)
    const endDate = new Date(entryForm.end_date)
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Planning</h1>
          <p className="mt-1 text-sm text-gray-500">
            Plan your annual leave and manage carry forward requests
          </p>
        </div>
      </div>

      {/* Reminders Alert */}
      {myReminders && myReminders.length > 0 && (
        <Card className="border-l-4 border-l-warning-500 bg-warning-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <BellAlertIcon className="h-6 w-6 text-warning-600 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="text-sm font-medium text-warning-800">You have {myReminders.length} leave reminder(s)</h4>
                <ul className="mt-2 space-y-2">
                  {myReminders.slice(0, 3).map((reminder: LeaveReminder) => (
                    <li key={reminder.id} className="flex items-center justify-between text-sm">
                      <span className="text-warning-700">{reminder.message}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeReminderMutation.mutate(reminder.id)}
                      >
                        Acknowledge
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="plans">
            <CalendarDaysIcon className="h-4 w-4 mr-2" />
            My Plans
          </TabsTrigger>
          <TabsTrigger value="carry-forward">
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Carry Forward
          </TabsTrigger>
        </TabsList>

        {/* Leave Plans Tab */}
        <TabsContent value="plans" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCreatePlanModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Create Plan for {currentYear}
              </Button>
            </div>

            {plansLoading ? (
              <Card>
                <CardContent className="py-8 text-center">Loading...</CardContent>
              </Card>
            ) : !myPlans || myPlans.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  <CalendarDaysIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No leave plans found. Create a plan to start planning your annual leave.</p>
                </CardContent>
              </Card>
            ) : (
              myPlans.map((plan: LeavePlan) => (
                <Card key={plan.id}>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <CardTitle>Leave Plan {plan.year}</CardTitle>
                        <Badge variant={planStatusColors[plan.status] || 'default'}>
                          {plan.status_display || plan.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {plan.status === 'DRAFT' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPlan(plan)
                                setEntryForm({ ...entryForm, leave_plan: plan.id })
                                setShowAddEntryModal(true)
                              }}
                            >
                              <PlusIcon className="h-4 w-4 mr-1" />
                              Add Entry
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => submitPlanMutation.mutate(plan.id)}
                              disabled={!plan.entries || plan.entries.length === 0}
                            >
                              Submit for Approval
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Summary */}
                    <div className="grid grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Entitlement</p>
                        <p className="text-lg font-bold">{plan.leave_entitlement} days</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Brought Forward</p>
                        <p className="text-lg font-bold">{plan.brought_forward} days</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Total Available</p>
                        <p className="text-lg font-bold">{Number(plan.leave_entitlement) + Number(plan.brought_forward)} days</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">Planned</p>
                        <p className="text-lg font-bold text-primary-600">{plan.total_planned_days} days</p>
                      </div>
                    </div>

                    {/* Entries */}
                    <Table
                      data={plan.entries || []}
                      columns={[
                        {
                          key: 'leave_type',
                          header: 'Leave Type',
                          render: (entry: LeavePlanEntry) => entry.leave_type_name || '-',
                        },
                        {
                          key: 'period',
                          header: 'Period',
                          render: (entry: LeavePlanEntry) => (
                            <span>
                              {new Date(entry.start_date).toLocaleDateString()} -{' '}
                              {new Date(entry.end_date).toLocaleDateString()}
                            </span>
                          ),
                        },
                        {
                          key: 'days',
                          header: 'Days',
                          render: (entry: LeavePlanEntry) => entry.number_of_days,
                        },
                        {
                          key: 'quarter',
                          header: 'Quarter',
                          render: (entry: LeavePlanEntry) => entry.quarter ? `Q${entry.quarter}` : '-',
                        },
                        {
                          key: 'status',
                          header: 'Status',
                          render: (entry: LeavePlanEntry) => (
                            <Badge variant={entryStatusColors[entry.status] || 'default'}>
                              {entry.status_display || entry.status}
                            </Badge>
                          ),
                        },
                        {
                          key: 'actions',
                          header: 'Actions',
                          render: (entry: LeavePlanEntry) =>
                            plan.status === 'DRAFT' && entry.status === 'PLANNED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (window.confirm('Delete this entry?')) {
                                    deleteEntryMutation.mutate(entry.id)
                                  }
                                }}
                              >
                                <TrashIcon className="h-4 w-4" />
                              </Button>
                            ),
                        },
                      ]}
                      emptyMessage="No entries added yet"
                    />

                    {/* Notes */}
                    {plan.employee_notes && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Your Notes:</strong> {plan.employee_notes}
                        </p>
                      </div>
                    )}
                    {plan.manager_comments && (
                      <div className="mt-2 p-3 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>Manager Comments:</strong> {plan.manager_comments}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Carry Forward Tab */}
        <TabsContent value="carry-forward" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCarryForwardModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Request Carry Forward
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Carry Forward Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Standard carry forward is 5 days. Any additional days require CEO approval.
                </p>
                <Table
                  data={myCarryForwardRequests || []}
                  columns={[
                    {
                      key: 'period',
                      header: 'Period',
                      render: (r: any) => `${r.from_year} → ${r.to_year}`,
                    },
                    {
                      key: 'available',
                      header: 'Available Balance',
                      render: (r: any) => `${r.available_balance} days`,
                    },
                    {
                      key: 'requested',
                      header: 'Requested',
                      render: (r: any) => `${r.requested_carry_forward} days`,
                    },
                    {
                      key: 'approved',
                      header: 'Approved',
                      render: (r: any) => r.approved_carry_forward ? `${r.approved_carry_forward} days` : '-',
                    },
                    {
                      key: 'lapse',
                      header: 'To Lapse',
                      render: (r: any) => r.days_to_lapse ? `${r.days_to_lapse} days` : '-',
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (r: any) => (
                        <Badge variant={cfStatusColors[r.status] || 'default'}>
                          {r.status_display || r.status}
                        </Badge>
                      ),
                    },
                  ]}
                  emptyMessage="No carry forward requests"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Plan Modal */}
      <Modal isOpen={showCreatePlanModal} onClose={() => setShowCreatePlanModal(false)} title="Create Leave Plan">
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <Input
            label="Year"
            type="number"
            value={planForm.year}
            onChange={(e) => setPlanForm({ ...planForm, year: parseInt(e.target.value) })}
            min={currentYear}
            max={currentYear + 1}
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={planForm.employee_notes}
              onChange={(e) => setPlanForm({ ...planForm, employee_notes: e.target.value })}
              placeholder="Any notes for your manager..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowCreatePlanModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createPlanMutation.isPending}>
              Create Plan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Entry Modal */}
      <Modal isOpen={showAddEntryModal} onClose={() => setShowAddEntryModal(false)} title="Add Leave Entry">
        <form onSubmit={handleAddEntry} className="space-y-4">
          <Select
            label="Leave Type"
            value={entryForm.leave_type}
            onChange={(e) => setEntryForm({ ...entryForm, leave_type: e.target.value })}
            options={leaveTypes?.map((lt: any) => ({ value: lt.id, label: lt.name })) || []}
            placeholder="Select leave type"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={entryForm.start_date}
              onChange={(e) => setEntryForm({ ...entryForm, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={entryForm.end_date}
              onChange={(e) => setEntryForm({ ...entryForm, end_date: e.target.value })}
              min={entryForm.start_date}
              required
            />
          </div>
          {entryForm.start_date && entryForm.end_date && (
            <p className="text-sm text-gray-600">
              Duration: <strong>{calculateDays()} days</strong>
            </p>
          )}
          <Select
            label="Quarter"
            value={entryForm.quarter}
            onChange={(e) => setEntryForm({ ...entryForm, quarter: e.target.value })}
            options={[
              { value: '1', label: 'Q1 (Jan-Mar)' },
              { value: '2', label: 'Q2 (Apr-Jun)' },
              { value: '3', label: 'Q3 (Jul-Sep)' },
              { value: '4', label: 'Q4 (Oct-Dec)' },
            ]}
            placeholder="Select quarter (optional)"
          />
          <Input
            label="Description (Optional)"
            value={entryForm.description}
            onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
            placeholder="e.g., Annual vacation"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowAddEntryModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={addEntryMutation.isPending}>
              Add Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* Carry Forward Modal */}
      <Modal isOpen={showCarryForwardModal} onClose={() => setShowCarryForwardModal(false)} title="Request Carry Forward">
        <form onSubmit={handleCreateCarryForward} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="From Year"
              type="number"
              value={cfForm.from_year}
              onChange={(e) => setCfForm({ ...cfForm, from_year: parseInt(e.target.value) })}
              required
            />
            <Input
              label="To Year"
              type="number"
              value={cfForm.to_year}
              onChange={(e) => setCfForm({ ...cfForm, to_year: parseInt(e.target.value) })}
              required
            />
          </div>
          <Input
            label="Available Balance (days)"
            type="number"
            step="0.5"
            value={cfForm.available_balance}
            onChange={(e) => setCfForm({ ...cfForm, available_balance: e.target.value })}
            required
          />
          <Input
            label="Requested Carry Forward (days)"
            type="number"
            step="0.5"
            value={cfForm.requested_carry_forward}
            onChange={(e) => setCfForm({ ...cfForm, requested_carry_forward: e.target.value })}
            required
          />
          {parseFloat(cfForm.requested_carry_forward) > 5 && (
            <p className="text-sm text-warning-600">
              You are requesting more than 5 days. This will require CEO approval.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Carry Forward *
            </label>
            <textarea
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
              rows={3}
              value={cfForm.reason}
              onChange={(e) => setCfForm({ ...cfForm, reason: e.target.value })}
              placeholder="Explain why you need to carry forward these days..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowCarryForwardModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createCfMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

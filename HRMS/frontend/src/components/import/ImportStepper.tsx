/**
 * Horizontal step indicator for the import wizard.
 */

import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { cn } from '@/lib/utils'
import { IMPORT_STEPS, type ImportStep } from '@/hooks/useImportPipeline'

interface ImportStepperProps {
  currentStep: ImportStep
}

export default function ImportStepper({ currentStep }: ImportStepperProps) {
  const currentIdx = IMPORT_STEPS.findIndex((s) => s.id === currentStep)

  return (
    <nav aria-label="Import progress" className="flex items-center justify-between">
      {IMPORT_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx
        const isCurrent = idx === currentIdx

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center min-w-[80px]">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold transition-colors',
                  isCompleted && 'bg-primary-600 text-white',
                  isCurrent && 'bg-primary-100 text-primary-700 ring-2 ring-primary-600',
                  !isCompleted && !isCurrent && 'bg-gray-100 text-gray-400',
                )}
              >
                {isCompleted ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  idx + 1
                )}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-xs font-medium text-center',
                  isCurrent ? 'text-primary-700' : isCompleted ? 'text-gray-700' : 'text-gray-400',
                )}
              >
                {step.name}
              </span>
            </div>

            {/* Connector line */}
            {idx < IMPORT_STEPS.length - 1 && (
              <div className="flex-1 mx-2 mt-[-18px]">
                <div
                  className={cn(
                    'h-0.5 w-full rounded',
                    idx < currentIdx ? 'bg-primary-500' : 'bg-gray-200',
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

/**
 * Data Import wizard page.
 *
 * Orchestrates the multi-step import flow using the useImportPipeline hook.
 * Each step is a standalone component; this page just picks the right one.
 */

import { SimplePageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'

import ImportStepper from '@/components/import/ImportStepper'
import UploadStep from '@/components/import/UploadStep'
import MappingStep from '@/components/import/MappingStep'
import PreviewStep from '@/components/import/PreviewStep'
import ExecutionStep from '@/components/import/ExecutionStep'
import { useImportPipeline } from '@/hooks/useImportPipeline'

export default function DataImportPage() {
  const pipeline = useImportPipeline()

  return (
    <div className="max-w-5xl mx-auto">
      <SimplePageHeader
        title="Data Import"
        subtitle="Import employees, transactions, pay components, banks, and bank accounts from CSV or Excel files."
      />

      {/* Stepper */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <ImportStepper currentStep={pipeline.step} />
        </CardContent>
      </Card>

      {/* Active step */}
      {pipeline.step === 'upload' && (
        <UploadStep
          entityTypes={pipeline.entityTypes}
          entityTypesLoading={pipeline.entityTypesLoading}
          isAnalyzing={pipeline.isAnalyzing}
          onAnalyze={pipeline.analyze}
        />
      )}

      {pipeline.step === 'mapping' && pipeline.analyzeData && (
        <MappingStep
          analyzeData={pipeline.analyzeData}
          editedMapping={pipeline.editedMapping}
          onMappingChange={pipeline.setEditedMapping}
          onSubmit={pipeline.submitMapping}
          onBack={pipeline.goBack}
          isPreviewing={pipeline.isPreviewing}
        />
      )}

      {pipeline.step === 'preview' && pipeline.analyzeData && pipeline.previewData && (
        <PreviewStep
          analyzeData={pipeline.analyzeData}
          previewData={pipeline.previewData}
          isConfirming={pipeline.isConfirming}
          onConfirm={pipeline.confirm}
          onBack={pipeline.goBack}
        />
      )}

      {(pipeline.step === 'execution' || pipeline.step === 'complete') && (
        <ExecutionStep
          step={pipeline.step}
          progress={pipeline.progress}
          session={pipeline.session}
          onReset={pipeline.reset}
        />
      )}
    </div>
  )
}

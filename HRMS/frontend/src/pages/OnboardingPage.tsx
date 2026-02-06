import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  CheckCircleIcon,
  UserIcon,
  PhoneIcon,
  CameraIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import { portalService } from '@/services/portal'
import { useAuthStore } from '@/features/auth/store'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Avatar from '@/components/ui/Avatar'
import { Card, CardContent } from '@/components/ui/Card'

type Step = 'verify' | 'emergency' | 'photo' | 'complete'

const RELATIONSHIP_OPTIONS = [
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'PARENT', label: 'Parent' },
  { value: 'SIBLING', label: 'Sibling' },
  { value: 'CHILD', label: 'Child' },
  { value: 'RELATIVE', label: 'Other Relative' },
  { value: 'FRIEND', label: 'Friend' },
  { value: 'OTHER', label: 'Other' },
]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [currentStep, setCurrentStep] = useState<Step>('verify')
  const [contactData, setContactData] = useState({
    mobile_phone: '',
    home_phone: '',
    personal_email: '',
    residential_address: '',
    residential_city: '',
  })
  const [emergencyContact, setEmergencyContact] = useState({
    name: '',
    relationship: '',
    phone_primary: '',
    phone_secondary: '',
    email: '',
    is_primary: true,
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const steps: Step[] = ['verify', 'emergency', 'photo', 'complete']
  const currentIndex = steps.indexOf(currentStep)

  const updateProfileMutation = useMutation({
    mutationFn: portalService.updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
    },
    onError: () => {
      toast.error('Failed to update profile')
    },
  })

  const createEmergencyContactMutation = useMutation({
    mutationFn: portalService.createEmergencyContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-emergency-contacts'] })
    },
    onError: () => {
      toast.error('Failed to add emergency contact')
    },
  })

  const uploadPhotoMutation = useMutation({
    mutationFn: (file: File) => portalService.uploadProfilePhoto(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile'] })
    },
    onError: () => {
      toast.error('Failed to upload photo')
    },
  })

  const handleNext = async () => {
    if (currentStep === 'verify') {
      // Save contact info
      if (contactData.mobile_phone || contactData.personal_email) {
        await updateProfileMutation.mutateAsync(contactData)
      }
      setCurrentStep('emergency')
    } else if (currentStep === 'emergency') {
      // Save emergency contact if provided
      if (emergencyContact.name && emergencyContact.phone_primary) {
        await createEmergencyContactMutation.mutateAsync(emergencyContact)
      }
      setCurrentStep('photo')
    } else if (currentStep === 'photo') {
      // Upload photo if selected
      if (photoFile) {
        await uploadPhotoMutation.mutateAsync(photoFile)
      }
      setCurrentStep('complete')
    }
  }

  const handleBack = () => {
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex])
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleFinish = () => {
    toast.success('Welcome to NHIA HRMS!')
    navigate('/dashboard', { replace: true })
  }

  const handleSkip = () => {
    if (currentStep === 'complete') {
      handleFinish()
    } else {
      const nextIndex = currentIndex + 1
      if (nextIndex < steps.length) {
        setCurrentStep(steps[nextIndex])
      }
    }
  }

  const isLoading =
    updateProfileMutation.isPending ||
    createEmergencyContactMutation.isPending ||
    uploadPhotoMutation.isPending

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to NHIA HRMS</h1>
          <p className="mt-2 text-gray-600">
            Let's set up your profile to get started
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, idx) => (
            <div key={step} className="flex items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  ${
                    currentIndex === idx
                      ? 'bg-primary-600 text-white'
                      : currentIndex > idx
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }
                `}
              >
                {currentIndex > idx ? <CheckCircleIcon className="h-6 w-6" /> : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`w-16 h-1 mx-1 ${
                    currentIndex > idx ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardContent className="p-8">
            {/* Step 1: Verify Info */}
            {currentStep === 'verify' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <UserIcon className="h-12 w-12 mx-auto text-primary-600 mb-2" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Verify Your Information
                  </h2>
                  <p className="text-sm text-gray-500">
                    Confirm and update your contact details
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Mobile Phone"
                    type="tel"
                    value={contactData.mobile_phone}
                    onChange={(e) =>
                      setContactData({ ...contactData, mobile_phone: e.target.value })
                    }
                    placeholder="e.g., 0244123456"
                  />
                  <Input
                    label="Home Phone (Optional)"
                    type="tel"
                    value={contactData.home_phone}
                    onChange={(e) =>
                      setContactData({ ...contactData, home_phone: e.target.value })
                    }
                  />
                </div>

                <Input
                  label="Personal Email"
                  type="email"
                  value={contactData.personal_email}
                  onChange={(e) =>
                    setContactData({ ...contactData, personal_email: e.target.value })
                  }
                  placeholder="your.personal@email.com"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Residential Address
                  </label>
                  <textarea
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    rows={2}
                    value={contactData.residential_address}
                    onChange={(e) =>
                      setContactData({ ...contactData, residential_address: e.target.value })
                    }
                    placeholder="Street address, house number..."
                  />
                </div>

                <Input
                  label="City"
                  value={contactData.residential_city}
                  onChange={(e) =>
                    setContactData({ ...contactData, residential_city: e.target.value })
                  }
                  placeholder="e.g., Accra"
                />
              </div>
            )}

            {/* Step 2: Emergency Contact */}
            {currentStep === 'emergency' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <PhoneIcon className="h-12 w-12 mx-auto text-primary-600 mb-2" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Emergency Contact
                  </h2>
                  <p className="text-sm text-gray-500">
                    Add someone we can contact in case of emergency
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Contact Name"
                    value={emergencyContact.name}
                    onChange={(e) =>
                      setEmergencyContact({ ...emergencyContact, name: e.target.value })
                    }
                    placeholder="Full name"
                  />
                  <Select
                    label="Relationship"
                    value={emergencyContact.relationship}
                    onChange={(e) =>
                      setEmergencyContact({ ...emergencyContact, relationship: e.target.value })
                    }
                    options={RELATIONSHIP_OPTIONS}
                    placeholder="Select relationship"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Primary Phone"
                    type="tel"
                    value={emergencyContact.phone_primary}
                    onChange={(e) =>
                      setEmergencyContact({ ...emergencyContact, phone_primary: e.target.value })
                    }
                    placeholder="e.g., 0244123456"
                  />
                  <Input
                    label="Secondary Phone (Optional)"
                    type="tel"
                    value={emergencyContact.phone_secondary}
                    onChange={(e) =>
                      setEmergencyContact({
                        ...emergencyContact,
                        phone_secondary: e.target.value,
                      })
                    }
                  />
                </div>

                <Input
                  label="Email (Optional)"
                  type="email"
                  value={emergencyContact.email}
                  onChange={(e) =>
                    setEmergencyContact({ ...emergencyContact, email: e.target.value })
                  }
                  placeholder="contact@email.com"
                />
              </div>
            )}

            {/* Step 3: Photo */}
            {currentStep === 'photo' && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CameraIcon className="h-12 w-12 mx-auto text-primary-600 mb-2" />
                  <h2 className="text-lg font-semibold text-gray-900">Profile Photo</h2>
                  <p className="text-sm text-gray-500">
                    Upload a professional photo for your profile
                  </p>
                </div>

                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                      />
                    ) : (
                      <Avatar
                        firstName={user?.first_name}
                        lastName={user?.last_name}
                        size="xl"
                        className="w-32 h-32"
                      />
                    )}
                  </div>

                  <div>
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <CameraIcon className="h-5 w-5 mr-2" />
                        Choose Photo
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                      />
                    </label>
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    Recommended: Square image, at least 200x200 pixels
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Complete */}
            {currentStep === 'complete' && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  You're All Set!
                </h2>
                <p className="text-gray-600 mb-6">
                  Your profile has been set up successfully. You can always update your
                  information later from the My Profile page.
                </p>
                <Button size="lg" onClick={handleFinish}>
                  Go to Dashboard
                  <ArrowRightIcon className="h-5 w-5 ml-2" />
                </Button>
              </div>
            )}

            {/* Navigation */}
            {currentStep !== 'complete' && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <div>
                  {currentIndex > 0 && (
                    <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                      <ArrowLeftIcon className="h-4 w-4 mr-2" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={handleSkip} disabled={isLoading}>
                    Skip
                  </Button>
                  <Button onClick={handleNext} isLoading={isLoading}>
                    {currentIndex === steps.length - 2 ? 'Finish' : 'Continue'}
                    <ArrowRightIcon className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

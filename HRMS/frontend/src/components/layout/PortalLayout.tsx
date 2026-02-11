import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getPortalToken, clearPortalToken } from '@/services/applicantPortal'
import {
  BriefcaseIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'

interface PortalLayoutProps {
  children: React.ReactNode
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const hasToken = !!getPortalToken()

  const handleLogout = () => {
    clearPortalToken()
    navigate('/portal/login')
  }

  const navLinks = [
    { label: 'Careers', path: '/careers' },
    ...(hasToken
      ? [
          { label: 'Dashboard', path: '/portal/dashboard' },
          { label: 'Documents', path: '/portal/documents' },
        ]
      : [{ label: 'Login', path: '/portal/login' }]),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <BriefcaseIcon className="h-8 w-8 text-blue-600" />
              <span className="text-lg font-semibold text-gray-900">
                Applicant Portal
              </span>
            </div>

            <nav className="flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {hasToken && (
                <button
                  onClick={handleLogout}
                  className="ml-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                  Logout
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}

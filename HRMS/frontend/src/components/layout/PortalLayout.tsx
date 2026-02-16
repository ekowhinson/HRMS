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
      {/* Top bar — dark header matching main layout */}
      <header className="bg-header-bg border-b border-header-border h-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center gap-3">
              <BriefcaseIcon className="h-6 w-6 text-white" />
              <span className="text-sm font-semibold text-white">
                Applicant Portal
              </span>
            </div>

            <nav className="flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'bg-header-hover text-white'
                      : 'text-header-text-muted hover:text-white hover:bg-header-hover'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              {hasToken && (
                <button
                  onClick={handleLogout}
                  className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium text-header-text-muted hover:text-white hover:bg-header-hover transition-colors flex items-center gap-1"
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

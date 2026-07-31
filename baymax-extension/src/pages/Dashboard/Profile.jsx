// Dashboard Profile page — account info, preferences, and about.

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, Input, Switch } from '@/components/ui'
import { useTheme } from '@/lib/theme'

const LANGUAGES = ['English', 'Bahasa Malaysia', 'Mandarin', 'Tamil']

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-caption text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

export default function Profile({ user }) {
  const [language, setLanguage] = useState('English')
  const [highlights, setHighlights] = useState(true)
  const { isDark, setDark } = useTheme()

  return (
    <div className="max-w-full space-y-6">
      <h1 className="text-display">Profile</h1>

      <Card>
        <CardHeader>
          <h2 className="text-h2">Account Information</h2>
        </CardHeader>
        {
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row">
              <div className="w-1/2">
                <Field label="Full Name">
                  <Input
                    value={user?.name ?? ''}
                    placeholder={user ? '' : 'Loading…'}
                    readOnly
                    className="bg-muted"
                  />
                </Field>
              </div>
              <div className="w-1/2">
                <Field label="Email Address">
                  <Input
                    value={user?.email ?? ''}
                    placeholder={user ? '' : 'Loading…'}
                    readOnly
                    className="bg-muted"
                  />
                </Field>
              </div>
            </div>
          </CardContent>
        }
      </Card>
      <div className="flex basis-full gap-6">
        <Card className="w-1/2">
          <CardHeader>
            <h2 className="text-h2">Settings</h2>
          </CardHeader>
          {
            <CardContent className="space-y-4">
              <Field label="Preferred Language">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="border-border text-small focus:ring-primary bg-card w-full rounded-lg border px-3 py-2 focus:ring-2 focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <div className="flex items-center justify-between">
                <span className="text-small">Enable Step Highlights</span>
                <Switch checked={highlights} onCheckedChange={setHighlights} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-small">Dark Mode</span>
                <Switch checked={isDark} onCheckedChange={setDark} />
              </div>
            </CardContent>
          }
        </Card>

        <Card className="w-1/2">
          <CardHeader>
            <h2 className="text-h2">About</h2>
          </CardHeader>
          {
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-small text-muted-foreground">Version</span>
                <span className="bg-info-soft text-caption text-info-foreground rounded-full px-2.5 py-0.5">
                  v2.2.0
                </span>
              </div>
              <div>
                <p className="text-caption text-muted-foreground">Development Team</p>
                <p className="text-small">Built by Baymax Team</p>
              </div>
              <a
                href={import.meta.env.VITE_DOCS_URL || 'https://baymax.dev/docs'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-small text-primary inline-flex items-center gap-1.5 hover:underline"
              >
                View Documentation
                <ExternalLink size={14} />
              </a>
            </CardContent>
          }
        </Card>
      </div>
    </div>
  )
}

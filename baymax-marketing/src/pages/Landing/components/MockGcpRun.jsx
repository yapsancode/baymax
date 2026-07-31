// MockGcpRun — a Cloud Run service details page showing a failed revision
// and the error logs. The palette is the Google Cloud Console light UI:
// blue top bar, red error banner, monospace log entries. Uses the ancestor
// `.mock-gcp` scope for the light Google tokens and a few arbitrary colors
// where the Console UI demands exact Google brand values.
// Used by slide 4 (pain points) to show the "error deploying" beat.

import { motion } from 'framer-motion'
import {
  Menu,
  Search,
  ChevronDown,
  AlertCircle,
  Terminal,
  HelpCircle,
  Bell,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  PlusSquare,
  Filter,
  Info,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react'

function HuntRing({ delay = 0 }) {
  return (
    <motion.span
      className="pointer-events-none absolute -inset-1 rounded-md ring-2 ring-[#d93025]"
      animate={{ opacity: [0, 1, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  )
}

export function MockGcpRun({
  hunting = false,
  huntingStatic = false,
  error = false,
  className = '',
}) {
  return (
    <div className={`text-left ${className}`}>
      {/* GCP top bar */}
      <div className="flex h-12 items-center gap-3 bg-[#4285f4] px-4 text-white">
        <Menu size={18} className="shrink-0" />
        <span className="hidden text-sm font-medium sm:inline">Google Cloud Platform</span>
        <div className="flex items-center gap-1 text-xs opacity-90">
          <LayoutGrid size={13} />
          <span className="truncate">bennogasse</span>
          <ChevronDown size={12} />
        </div>
        <div className="flex flex-1 justify-center px-3">
          <div className="flex w-3/5 max-w-md items-center gap-2 rounded bg-white/20 px-3 py-1.5">
            <Search size={13} className="shrink-0" />
            <span className="truncate text-xs opacity-90">Search</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Terminal size={16} />
          <HelpCircle size={16} />
          <Bell size={16} />
          <MoreVertical size={16} />
        </div>
      </div>

      {/* Breadcrumb bar */}
      <div className="flex items-center gap-2 border-b border-[#dadce0] bg-white px-4 py-2.5">
        <ChevronRight size={15} className="shrink-0 text-[#5f6368]" />
        <span className="text-sm text-[#202124]">Cloud Run</span>
        <ChevronLeft size={15} className="ml-2 shrink-0 text-[#5f6368]" />
        <span className="text-sm text-[#202124]">Service details</span>
        <span className="relative ml-auto flex items-center gap-1.5 text-xs font-medium text-[#1a73e8]">
          {hunting ? <HuntRing delay={0} /> : null}
          {huntingStatic ? (
            <span className="pointer-events-none absolute -inset-1 rounded-md ring-2 ring-[#d93025]" />
          ) : null}
          <PlusSquare size={14} />
          DEPLOY NEW REVISION
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <motion.div
          className="flex items-start gap-2.5 bg-[#fce8e6] px-4 py-3 text-xs leading-relaxed text-[#d93025]"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            Cloud Run error: Container failed to start. Failed to start and then listen on the port
            defined by the <code className="font-mono">PORT</code> environment variable. Logs for
            this revision might contain more information.
          </span>
        </motion.div>
      )}

      {/* Service info */}
      <div className="flex items-center gap-3 bg-white px-4 py-4">
        <AlertCircle size={22} className="shrink-0 text-[#d93025]" />
        <span className="text-xl text-[#202124]">testing</span>
        <span className="ml-2 text-xs text-[#5f6368]">Region: europe-west1</span>
        <span className="ml-4 text-xs text-[#5f6368]">
          URL: <span className="text-[#80868b]">(loading)</span>
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-[#dadce0] bg-white px-4 text-xs font-medium tracking-wide text-[#5f6368]">
        {['METRICS', 'REVISIONS', 'LOGS', 'DETAILS', 'YAML', 'PERMISSIONS'].map((tab) => {
          const active = tab === 'LOGS'
          return (
            <span
              key={tab}
              className={`py-2.5 ${
                active
                  ? 'border-b-2 border-[#1a73e8] text-[#1a73e8]'
                  : 'hover:text-[#202124]'
              }`}
            >
              {tab}
            </span>
          )
        })}
      </div>

      {/* Logs header */}
      <div className="flex items-center gap-4 bg-white px-4 py-3">
        <span className="text-sm text-[#202124]">Logs</span>
        <span className="text-xs text-[#5f6368]">Showing 6 messages</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-[#5f6368]">
          Any log level <ChevronDown size={12} />
        </span>
        <span className="flex items-center gap-1 text-xs text-[#5f6368]">
          <Filter size={13} />
          Filter
        </span>
      </div>

      {/* Log entries */}
      <div className="bg-white font-mono text-xs text-[#3c4043]">
        <div className="flex items-center gap-2 bg-[#f1f3f4] px-4 py-2 text-[#5f6368]">
          <Info size={13} />
          <span>No older entries found matching current filter.</span>
        </div>

        <div className="flex items-center gap-2 border-b border-[#f1f3f4] px-4 py-2">
          <span className="shrink-0 text-[#80868b]">2020-01-28T16:50:55.801Z</span>
          <span className="shrink-0 text-[#5f6368]">Cloud Run CreateService testing bichler@gmail.com</span>
          <span className="truncate text-[#80868b]">
            {'{@type: type.googleapis.com/google.cloud.audit.AuditLog, ...}'}
          </span>
        </div>

        <div className="flex gap-2 border-b border-[#f1f3f4] px-4 py-2">
          <span className="text-[#80868b]">2020-01-28T16:51:09.415036Z</span>
          <span>npm ERR! missing script: start</span>
        </div>

        <div className="flex gap-2 border-b border-[#f1f3f4] px-4 py-2">
          <span className="text-[#80868b]">2020-01-28T16:51:09.419506Z</span>
        </div>

        <div className="flex gap-2 border-b border-[#f1f3f4] px-4 py-2">
          <span className="text-[#80868b]">2020-01-28T16:51:09.419747Z</span>
          <span>npm ERR! A complete log of this run can be found in:</span>
        </div>

        <div className="flex gap-2 border-b border-[#f1f3f4] px-4 py-2">
          <span className="text-[#80868b]">2020-01-28T16:51:09.419841Z</span>
          <span>npm ERR! /home/.npm/_logs/2020-01-28T16_51_09_415Z-debug.log</span>
        </div>

        <div className="flex items-center gap-2 px-4 py-2">
          <AlertTriangle size={13} className="shrink-0 text-[#f9ab00]" />
          <span className="text-[#80868b]">2020-01-28T16:51:09.874002610Z</span>
          <span>Container called exit(1).</span>
        </div>
      </div>
    </div>
  )
}

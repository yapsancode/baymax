import { useState } from 'react'
import { TaskIcon } from '@/components/shared'
import { Badge } from './Badge'
import { Button } from './Button'
import { ProgressBar } from './ProgressBar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'

import { X, Loader2, Check, AlertTriangle } from 'lucide-react'

export function TaskCard({ task, label, status, progress, onResume, onDelete, onDeleted }) {
  const [open, setOpen] = useState(false)
  const completed = status === 'completed'

  //delete flow
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePhase, setDeletePhase] = useState('confirm') // 'confirm' | 'loading' | 'success' | 'error'
  const [deleteError, setDeleteError] = useState('')

  const handleDeleteOpenChange = (next) => {
    if (deletePhase === 'loading') return // block closing mid-delete
    setDeleteOpen(next)
    if (!next) {
      // closing after a successful delete (e.g. clicking outside instead of
      // pressing Done) must still notify the parent so the list reloads
      if (deletePhase === 'success') {
        onDeleted()
      }
      // reset back to the start every time it closes, so reopening is fresh
      setDeletePhase('confirm')
      setDeleteError('')
    }
  }

  const handleConfirmDelete = async () => {
    setDeletePhase('loading')
    try {
      await onDelete()
      setDeletePhase('success')
    } catch (err) {
      setDeleteError(err.message || 'Something went wrong. Please try again.')
      setDeletePhase('error')
    }
  }

  return (
    <div className="border-border bg-card w-full min-w-0 rounded-lg border p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TaskIcon task={task} />
          <p className="text-body text-foreground min-w-0 flex-1 truncate font-semibold">{label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge
            variant={completed ? 'completed' : 'active'}
            className="flex-shrink-0 whitespace-nowrap"
          >
            {completed ? 'Completed' : 'In Progress'}
          </Badge>
          <button
            onClick={() => setDeleteOpen(true)}
            className="bg-muted text-muted-foreground hover:bg-border flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition-colors"
            aria-label="Delete task"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="text-caption text-muted-foreground flex items-center justify-between">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <ProgressBar current={progress} total={100} />
      </div>

      <div className="mt-4">
        {completed ? (
          <>
            <Button variant="primary" className="w-full" onClick={() => setOpen(true)}>
              View Summary
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Task Summary</DialogTitle>
                  <DialogDescription>Your deployment task is complete.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-caption text-muted-foreground">Task</p>
                    <p className="text-body font-medium">{label}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-caption text-muted-foreground">Status</p>
                    <p className="text-body font-medium">Completed</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-caption text-muted-foreground">Progress</p>
                    <p className="text-body font-medium">{progress}%</p>
                  </div>
                </div>
                <DialogFooter showCloseButton />
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <Button variant="secondary" className="w-full" onClick={onResume}>
            Resume Task
          </Button>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
        <DialogContent showCloseButton={deletePhase !== 'loading'}>
          {deletePhase === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle>Delete this task?</DialogTitle>
                <DialogDescription>This task will be permanently deleted.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button variant="default" onClick={handleConfirmDelete}>
                  Delete
                </Button>
              </DialogFooter>
            </>
          )}

          {deletePhase === 'loading' && (
            <>
              {console.log('hello')}
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                <p className="text-body text-foreground">Deleting...</p>
              </div>
            </>
          )}

          {deletePhase === 'success' && (
            <>
              {console.log('XXXXXXX')}
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="bg-success-soft flex h-12 w-12 items-center justify-center rounded-full">
                  <Check className="text-success-foreground h-6 w-6" />
                </div>
                <p className="text-body text-foreground font-medium">Task deleted successfully.</p>
              </div>
              <DialogFooter>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    onDeleted()
                    setDeleteOpen(false)
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}

          {deletePhase === 'error' && (
            <>
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="bg-danger-soft flex h-12 w-12 items-center justify-center rounded-full">
                  <AlertTriangle className="text-danger-foreground h-6 w-6" />
                </div>
                <p className="text-body text-foreground font-medium">{deleteError}</p>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleConfirmDelete}>
                  Try again
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

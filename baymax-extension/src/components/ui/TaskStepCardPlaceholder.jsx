import { Loader2 } from 'lucide-react'
import { Card, CardContent } from './Card'

export function TaskStepCardPlaceholder({ message, loadingIcon = false }) {
  return (
    <Card className="overflow-hidden pt-0">
      <div className="border-t-primary border-t-4 py-4">
        <CardContent className="pt-0">
          <div className="flex h-full flex-1 items-center justify-center">
            <div className="text-center">
              {loadingIcon && <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-400" />}
              <p className="mt-4 text-gray-600">{message}</p>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

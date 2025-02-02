import type React from "react"
import { Button } from "@/components/ui/button"

interface PageNavigationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  onRemovePage: (page: number) => void
}

const PageNavigation: React.FC<PageNavigationProps> = ({ currentPage, totalPages, onPageChange, onRemovePage }) => {
  return (
    <div className="flex items-center justify-center space-x-2">
      <Button onClick={() => onPageChange(Math.max(0, currentPage - 1))} disabled={currentPage === 0} variant="outline">
        Previous
      </Button>
      <span>
        Page {currentPage + 1} of {totalPages}
      </span>
      <Button
        onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
        disabled={currentPage === totalPages - 1}
        variant="outline"
      >
        Next
      </Button>
      {totalPages > 1 && (
        <Button onClick={() => onRemovePage(currentPage)} variant="outline">
          Remove Page
        </Button>
      )}
    </div>
  )
}

export default PageNavigation


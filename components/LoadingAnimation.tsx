import type React from "react"
import { useEffect, useState } from "react"

const LoadingAnimation: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(interval)
          setTimeout(onFinish, 500) // Delay to show 100% briefly
          return 100
        }
        return prevProgress + 10
      })
    }, 200)

    return () => clearInterval(interval)
  }, [onFinish])

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4 animate-pulse">MATRIX</h1>
        <div className="w-64 h-2 bg-gray-200 rounded-full">
          <div
            className="h-full bg-primary rounded-full transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="mt-2">{progress}%</p>
      </div>
    </div>
  )
}

export default LoadingAnimation


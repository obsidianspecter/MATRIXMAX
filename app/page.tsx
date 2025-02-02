"use client"

import { useState } from "react"
import LoadingAnimation from "@/components/LoadingAnimation"
import IntegratedBoard from "@/components/IntegratedBoard"

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <>
      {isLoading && <LoadingAnimation onFinish={() => setIsLoading(false)} />}
      {!isLoading && <IntegratedBoard />}
    </>
  )
}


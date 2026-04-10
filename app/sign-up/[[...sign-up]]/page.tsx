import { Suspense } from 'react'
import { connection } from 'next/server'
import { SignUp } from '@clerk/nextjs'

async function SignUpContent() {
  await connection()
  return <SignUp />
}

export default function SignUpPage() {
  return (
    <div className="flex justify-center items-center min-h-[80vh] px-4">
      <Suspense>
        <SignUpContent />
      </Suspense>
    </div>
  )
}

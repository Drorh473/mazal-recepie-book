import { Suspense } from 'react'
import { connection } from 'next/server'
import { SignIn } from '@clerk/nextjs'

async function SignInContent() {
  await connection()
  return <SignIn />
}

export default function SignInPage() {
  return (
    <div className="flex justify-center items-center min-h-[80vh] px-4">
      <Suspense>
        <SignInContent />
      </Suspense>
    </div>
  )
}

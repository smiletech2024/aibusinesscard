import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminEmail = process.env.ADMIN_EMAIL
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !adminEmail || user.email !== adminEmail) {
    redirect('/dashboard')
  }

  return <>{children}</>
}

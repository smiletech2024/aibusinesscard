import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import CardPageClient from './CardPageClient'

const SITE_URL = 'https://www.aimeishi.biz'

export async function generateMetadata(
  { params }: { params: Promise<{ cardId: string }> }
): Promise<Metadata> {
  const { cardId } = await params
  const supabase   = await createClient()

  const { data: card } = await supabase
    .from('business_cards')
    .select('full_name, title, company, profiles:user_id(avatar_url)')
    .eq('id', cardId)
    .eq('is_active', true)
    .single()

  if (!card) {
    return {
      title: 'AI名刺',
      description: 'AIが24時間、あなたの代わりに顧客の質問に答えます。',
    }
  }

  const name       = card.full_name
  const subtitle   = [card.title, card.company].filter(Boolean).join(' · ')
  const title      = subtitle ? `${name} - ${subtitle}` : name
  const description = `${name}のAI分身と話す。24時間、質問に答えます。`
  const avatarUrl  = (card.profiles as { avatar_url?: string | null } | null)?.avatar_url

  return {
    title: `${name} | AI名刺`,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/card/${cardId}`,
      siteName: 'AI名刺',
      type: 'profile',
      ...(avatarUrl ? { images: [{ url: avatarUrl, width: 400, height: 400, alt: name }] } : {}),
    },
    twitter: {
      card:        'summary',
      title,
      description,
      ...(avatarUrl ? { images: [avatarUrl] } : {}),
    },
  }
}

export default function CardPage() {
  return <CardPageClient />
}

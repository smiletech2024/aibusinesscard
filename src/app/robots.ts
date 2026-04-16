import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/faq', '/support', '/tokusho', '/terms', '/privacy', '/refund'],
        disallow: ['/dashboard', '/admin', '/auth/', '/api/', '/edit/', '/edit-persona/', '/setup', '/owner/', '/print/'],
      },
    ],
    sitemap: 'https://www.aimeishi.biz/sitemap.xml',
  }
}

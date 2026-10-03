import { MetadataRoute } from 'next'
import { ADMISSIONS_DOMAIN } from '@/lib/constants'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/confirm/'],
    },
    sitemap: `https://${ADMISSIONS_DOMAIN}/sitemap.xml`,
  }
}

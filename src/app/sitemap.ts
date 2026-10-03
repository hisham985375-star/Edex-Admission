import { MetadataRoute } from 'next'
import { ADMISSIONS_DOMAIN } from '@/lib/constants'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `https://${ADMISSIONS_DOMAIN}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `https://${ADMISSIONS_DOMAIN}/apply`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]
}

"use client";

import { useState, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Play } from "lucide-react";

type Testimonial = {
  id: string;
  student_name: string;
  place: string;
  batch: string;
  video_url: string;
  thumbnail_url: string;
  display_order: number;
};

export default function TestimonialsList() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(6);

  useEffect(() => {
    async function fetchTestimonials() {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("testimonials")
        .select("*")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch testimonials:", error);
      } else {
        setTestimonials(data || []);
      }
      setLoading(false);
    }
    fetchTestimonials();
  }, []);

  if (loading) {
    return <div className="text-center text-edex-white/50">Loading testimonials...</div>;
  }

  if (testimonials.length === 0) {
    return <div className="text-center text-edex-white/50">No testimonials available yet.</div>;
  }

  const visibleTestimonials = testimonials.slice(0, visibleCount);

  // Group by batch
  const batches = Array.from(new Set(visibleTestimonials.map(t => t.batch)));

  const getObjectPosition = (name: string, type: 'video' | 'thumbnail') => {
    const n = name.toLowerCase();
    if (n.includes("mukthar")) return type === 'video' ? "object-[center_60%]" : "object-top";
    if (n.includes("majida")) return "object-[center_40%]";
    if (n.includes("vyshnav") || n.includes("asil ali")) return "object-[center_45%]";
    if (n.includes("afsal")) return "object-[center_15%]";
    return "object-[center_25%]";
  };

  return (
    <div className="space-y-16">
      {batches.map(batch => (
        <div key={batch}>
          <h3 className="text-[clamp(1.25rem,5vw,1.875rem)] md:text-3xl font-bold mb-8 text-edex-neon text-left border-b border-edex-white/20 pb-4 whitespace-nowrap tracking-tight md:tracking-normal overflow-hidden text-ellipsis">
            {batch}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {visibleTestimonials.filter(t => t.batch === batch).map(t => (
              <div key={t.id} className="bg-edex-white/5 rounded-xl overflow-hidden border border-edex-white/10 hover:border-edex-neon transition-colors">
                <div 
                  className="relative aspect-video bg-black cursor-pointer group overflow-hidden" 
                  onClick={() => setPlayingId(t.id)}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {playingId === t.id ? (
                    <video 
                      src={t.video_url} 
                      controls 
                      autoPlay 
                      className={`w-full h-full object-cover ${getObjectPosition(t.student_name, 'video')}`}
                    />
                  ) : hoveredId === t.id && !playingId ? (
                    <video 
                      src={t.video_url} 
                      autoPlay 
                      loop 
                      className={`w-full h-full object-cover ${getObjectPosition(t.student_name, 'video')}`}
                    />
                  ) : (
                    <>
                      {t.thumbnail_url ? (
                        <img src={t.thumbnail_url} alt={t.student_name} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${getObjectPosition(t.student_name, 'thumbnail')}`} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-edex-white/30">No Thumbnail</div>
                      )}
                      <div className="absolute top-3 right-3 pointer-events-none">
                        <div className="bg-edex-neon text-edex-charcoal p-3 rounded-full opacity-90 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(206,255,0,0.3)]">
                          <Play className="w-5 h-5 ml-1" fill="currentColor" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <div className="p-4">
                  <div className="font-bold text-xl">{t.student_name}</div>
                  <div className="text-edex-white/70">{t.place}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {visibleCount < testimonials.length && (
        <div className="flex justify-center mt-12">
          <button 
            onClick={() => setVisibleCount(prev => prev + 6)}
            className="px-8 py-3 bg-edex-neon text-edex-charcoal font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            View More
          </button>
        </div>
      )}
    </div>
  );
}

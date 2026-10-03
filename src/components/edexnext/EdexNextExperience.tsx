"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function EdexNextExperience({ onChangeProgram }: { onChangeProgram: () => void }) {
  return (
    <div className="bg-edex-charcoal text-edex-white min-h-screen">
      {/* Header/Nav */}
      <nav className="fixed top-0 w-full p-6 flex justify-between items-center bg-edex-charcoal/80 backdrop-blur z-50">
        <img src="/edex-logo.png" alt="EDEX Life School" className="h-10 object-contain" />
        <div className="flex gap-4">
          <button onClick={onChangeProgram} className="text-edex-white/70 hover:text-edex-white transition-colors">
            Change Program
          </button>
          <Link href="/apply" className="bg-edex-neon text-edex-charcoal px-4 py-2 font-bold rounded">
            Apply Now
          </Link>
        </div>
      </nav>

      {/* 1. Hero */}
      <section className="min-h-screen flex items-center justify-center p-8 pt-32 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <h1 className="text-6xl md:text-8xl font-bold mb-6 text-edex-white">EDEX <span className="text-edex-neon">Next</span></h1>
          <p className="text-2xl md:text-4xl mb-8 max-w-3xl mx-auto text-edex-white/80">
            The next evolution in leadership.
          </p>
          <p className="text-xl text-edex-white/50 max-w-2xl mx-auto mb-12">
            Details for this program are being finalized. Check back soon for the complete curriculum and schedule.
          </p>
          <Link href="/apply" className="inline-block bg-edex-neon text-edex-charcoal px-8 py-4 font-bold rounded-full text-lg hover:bg-white transition-colors">
            Pre-Apply Now
          </Link>
        </motion.div>
      </section>

      {/* 15. Application CTA */}
      <section id="apply" className="py-32 px-8 bg-edex-neon text-edex-charcoal text-center">
        <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready for what's Next?</h2>
        <p className="text-xl mb-12">Application Fee: ₹1,000</p>
        <Link href="/apply" className="bg-edex-charcoal text-edex-white px-12 py-5 rounded-full font-bold text-xl hover:bg-black transition-colors">
          Apply Now
        </Link>
      </section>
    </div>
  );
}

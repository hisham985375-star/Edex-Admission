"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import TestimonialsList from "@/components/TestimonialsList";

export default function EGX100Experience({ onChangeProgram }: { onChangeProgram: () => void }) {
  return (
    <div className="bg-edex-charcoal text-edex-white min-h-[100dvh]">
      {/* Header/Nav */}
      <nav className="absolute top-0 w-full p-4 md:p-6 flex justify-between items-center bg-transparent md:bg-edex-charcoal/80 backdrop-blur-none md:backdrop-blur z-50">
        <img src="/edex-logo.png" alt="EDEX Life School" className="h-8 md:h-10 object-contain" />
        <div className="flex gap-2 md:gap-4 items-center">
          <button onClick={onChangeProgram} className="text-xs md:text-base text-edex-white/70 hover:text-edex-white transition-colors">
            Change Program
          </button>
          <a href="#apply" className="bg-edex-neon text-edex-charcoal px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-base font-bold rounded">
            Apply Now
          </a>
        </div>
      </nav>

      {/* 1. Hero */}
      <section 
        className="min-h-[100dvh] flex items-center justify-center p-8 pt-32 text-center relative bg-[url('/bg-egx-mobile.png')] md:bg-[url('/bg-egx.png')] bg-cover bg-center"
      >
        <div className="absolute inset-0 bg-black/70"></div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="relative z-10">
          <h1 className="text-6xl md:text-8xl font-bold mb-6 text-edex-neon">EGX 100</h1>
          <p className="text-2xl md:text-4xl mb-8 max-w-3xl mx-auto">
            Adaptive Generalists for the AI Era
          </p>
          <p className="text-xl text-edex-white/70 max-w-2xl mx-auto mb-12">
            100 Days. 14 Industry Experts. 14 Business Projects. 14 Human Skills.
          </p>
          <a href="#journey" className="inline-block bg-edex-neon text-edex-charcoal px-8 py-4 font-bold rounded-full text-lg hover:bg-white transition-colors">
            Start Your Journey
          </a>
        </motion.div>
      </section>

      {/* 13. Philosophy */}
      <section className="py-32 px-8 bg-edex-neon text-edex-charcoal text-center">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <h2 className="text-4xl md:text-6xl font-bold max-w-5xl mx-auto leading-tight">
            Curiosity + Courage + Commitment = Unstoppable Human Potential
          </h2>
        </motion.div>
      </section>

      {/* 6. 14 Human Skills */}
      <section className="py-32 px-8 max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold mb-16 text-center">14 Human Skills</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            "Communication", "Critical Thinking", "Leadership", "Emotional Intelligence",
            "Adaptability", "Problem Solving", "Financial Literacy", "Public Speaking",
            "Personal Branding", "Entrepreneurial Mindset", "AI-Era Productivity",
            "Strategic Thinking", "Networking", "Decision Making Under Pressure"
          ].map((skill, i) => (
            <motion.div 
              key={skill}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-6 border border-edex-white/10 rounded-xl hover:border-edex-neon transition-colors"
            >
              <div className="text-edex-neon font-bold mb-2">{String(i + 1).padStart(2, '0')}</div>
              <div className="font-bold">{skill}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 8. Four Phases */}
      <section id="journey" className="py-32 px-4 md:px-8 bg-black/50 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl min-[375px]:text-3xl md:text-5xl font-bold mb-16 text-center whitespace-nowrap tracking-tighter md:tracking-normal">The 100-Day Journey</h2>
          <div className="space-y-8">
            {[
              { phase: "Foundation", days: "Days 1–25", desc: "Building the core human skills and mindset." },
              { phase: "Application", days: "Days 26–50", desc: "Applying skills to real-world business scenarios." },
              { phase: "Growth", days: "Days 51–75", desc: "Accelerating learning and expanding networks." },
              { phase: "Mastery", days: "Days 76–100", desc: "Solidifying the Adaptive Generalist identity." }
            ].map((p) => (
              <div key={p.phase} className="flex flex-col md:flex-row items-baseline gap-4 md:gap-12 p-8 border-l-2 border-edex-neon">
                <div className="w-48 shrink-0">
                  <div className="text-edex-neon font-bold">{p.days}</div>
                  <h3 className="text-2xl font-bold">{p.phase}</h3>
                </div>
                <p className="text-xl text-edex-white/70">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Certification */}
      <section className="py-32 px-8 text-center max-w-4xl mx-auto">
        <h2 className="text-4xl font-bold mb-8">Certification</h2>
        <div className="p-12 border border-edex-neon rounded-2xl bg-edex-neon/5">
          <div className="text-edex-neon text-xl mb-4">Upon successful completion</div>
          <h3 className="text-3xl md:text-5xl font-bold mb-6">Certified Adaptive Generalist (CAG)</h3>
          <p className="text-edex-white/70 text-lg">A credential that sets you apart in the AI Era.</p>
        </div>
      </section>

      {/* 14. Testimonials (Placeholder for now) */}
      <section className="py-32 px-4 md:px-8 max-w-7xl mx-auto overflow-hidden">
        <h2 className="text-2xl min-[375px]:text-3xl md:text-4xl font-bold mb-16 text-center whitespace-nowrap tracking-tighter md:tracking-normal">Hear From Our Alumni</h2>
        <div className="w-full">
          <TestimonialsList />
        </div>
      </section>

      {/* 15. Application CTA */}
      <section id="apply" className="py-32 px-8 bg-edex-neon text-edex-charcoal text-center">
        <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to become an Adaptive Generalist?</h2>
        <p className="text-xl mb-12">Application Fee: ₹1,000</p>
        <Link href="/apply" className="bg-edex-charcoal text-edex-white px-12 py-5 rounded-full font-bold text-xl hover:bg-black transition-colors">
          Apply Now
        </Link>
      </section>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";

export default function ProgramSelection({ onSelect }: { onSelect: (program: string) => void }) {
  return (
    <div className="min-h-screen bg-edex-charcoal text-edex-white flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-16">
          Which program do you want to join?
        </h1>
        
        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="border border-edex-white/10 rounded-2xl p-8 cursor-pointer hover:border-edex-neon transition-colors group relative overflow-hidden"
            onClick={() => onSelect("EGX 100")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-edex-neon/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h2 className="text-3xl font-bold mb-4 group-hover:text-edex-neon transition-colors">EGX 100</h2>
            <p className="text-edex-white/70 mb-8">
              100 Days. 14 Industry Experts. 14 Business Projects. 14 Human Skills. 
              Become an Adaptive Generalist for the AI Era.
            </p>
            <div className="inline-flex items-center text-edex-neon font-bold">
              Explore Program &rarr;
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="border border-edex-white/10 rounded-2xl p-8 cursor-pointer hover:border-edex-neon transition-colors group relative overflow-hidden"
            onClick={() => onSelect("EDEX Next")}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-edex-neon/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <h2 className="text-3xl font-bold mb-4 group-hover:text-edex-neon transition-colors">EDEX Next</h2>
            <p className="text-edex-white/70 mb-8">
              The next evolution in professional development and leadership training.
              (Placeholder content)
            </p>
            <div className="inline-flex items-center text-edex-neon font-bold">
              Explore Program &rarr;
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

"use client";
import { motion } from "framer-motion";

const highlights = [
  { title: "Real-Time Messaging", desc: "Messages arrive instantly, with no lag between sending and receiving." },
  { title: "Cross-Device Sync", desc: "Pick up a conversation on your phone right where you left off on desktop." },
  { title: "Privacy First", desc: "Your conversations stay yours — built with privacy as a default, not an add-on." },
  { title: "Fast & Lightweight", desc: "A minimal interface that stays out of your way and loads instantly." },
];

export function AboutSection() {
  return (
    <section className="relative w-full bg-white dark:bg-neutral-950 py-20 sm:py-28 px-4 md:px-6">
      <div className="container mx-auto max-w-5xl text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-neutral-900 to-neutral-700/80 dark:from-white dark:to-white/80"
        >
          What is Lanchat?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-14"
        >
          Lanchat is a fast, minimal chat experience built for clear, uninterrupted
          conversations — on any device, in any browser.
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {highlights.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-gradient-to-b from-black/10 to-white/10 dark:from-white/10 dark:to-black/10 p-px rounded-2xl"
            >
              <div className="h-full rounded-[1.15rem] backdrop-blur-md bg-white/95 dark:bg-black/95 border border-black/10 dark:border-white/10 p-6 text-left">
                <h3 className="font-semibold text-black dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

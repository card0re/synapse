import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme");
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches;

        if (savedTheme === "dark" || (!savedTheme && systemTheme)) {
            setIsDark(true);
            document.documentElement.classList.add("dark");
        }
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
            setIsDark(false);
        } else {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
            setIsDark(true);
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className="fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 shadow-xl border border-slate-700 dark:bg-white dark:border-slate-200 transition-all active:scale-90"
        >
            <motion.div
                initial={false}
                animate={{ rotate: isDark ? 180 : 0, scale: isDark ? 1 : 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                className="flex items-center justify-center"
            >
                {isDark ? (
                    <Sun className="h-7 w-7 text-yellow-500" />
                ) : (
                    <Moon className="h-7 w-7 text-indigo-400" />
                )}
            </motion.div>
        </button>
    );
}
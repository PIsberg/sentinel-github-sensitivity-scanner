"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Search, Settings } from "lucide-react";

export default function Header() {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path;

    return (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
                        <div className="bg-blue-600 text-white p-1.5 rounded-lg">
                            <ShieldAlert size={20} />
                        </div>
                        GitHub Sentinel
                    </Link>

                    <nav className="flex gap-1">
                        <Link
                            href="/"
                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${isActive("/")
                                    ? "bg-gray-100 text-gray-900"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                }`}
                        >
                            <Search size={16} />
                            Scanner
                        </Link>
                        <Link
                            href="/admin"
                            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${isActive("/admin")
                                    ? "bg-gray-100 text-gray-900"
                                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                }`}
                        >
                            <Settings size={16} />
                            Rules & Config
                        </Link>
                    </nav>
                </div>
            </div>
        </header>
    );
}

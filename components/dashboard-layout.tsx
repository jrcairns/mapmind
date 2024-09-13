import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { Home, Package, Settings, Users } from "lucide-react"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            {/* <div className="hidden md:flex md:flex-shrink-0">
                <div className="flex flex-col w-64">
                    <div className="flex flex-col h-0 flex-1 border-r border-gray-200 bg-white">
                        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
                            <div className="flex items-center flex-shrink-0 px-4">
                                <span className="h-8 font-semibold">mapmind</span>
                            </div>
                            <nav className="mt-5 flex-1 px-2 bg-white space-y-1">
                                <Link href="/dashboard" className="group flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900">
                                    <Home className="mr-3 h-6 w-6" />
                                    Dashboard
                                </Link>
                                <Link href="#" className="group flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900">
                                    <Package className="mr-3 h-6 w-6" />
                                    Projects
                                </Link>
                                <Link href="#" className="group flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900">
                                    <Users className="mr-3 h-6 w-6" />
                                    Team
                                </Link>
                                <Link href="#" className="group flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900">
                                    <Settings className="mr-3 h-6 w-6" />
                                    Settings
                                </Link>
                            </nav>
                        </div>
                        <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
                            <UserButton afterSignOutUrl="/" />
                        </div>
                    </div>
                </div>
            </div> */}

            {/* Main content */}
            <div className="flex flex-col w-0 flex-1 overflow-hidden">
                <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
                    <div className="py-6">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
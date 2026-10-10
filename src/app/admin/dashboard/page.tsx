"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  LayoutDashboard, Users, MessageSquare, LogOut, Menu, X,
  TrendingUp, CreditCard, Clock, UserCheck, ChevronRight, RefreshCw
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  total: number;
  paid: number;
  paymentPending: number;
  byAdmissionStatus: Record<string, number>;
  byProgram: Record<string, number>;
  recentApplications: Array<{
    id: string; name: string; email: string; program: string;
    admissionStatus: string; createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30days");
  const [program, setProgram] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = createBrowserSupabaseClient();

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/admin"; return; }

    try {
      const res = await fetch(`/api/admin/dashboard?dateRange=${dateRange}&program=${program}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } finally {
      setLoading(false);
    }
  }, [dateRange, program]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/admin";
  };

  const statusColors: Record<string, string> = {
    New: "bg-blue-900/30 text-blue-400",
    Contacted: "bg-yellow-900/30 text-yellow-400",
    "Under Review": "bg-purple-900/30 text-purple-400",
    Selected: "bg-green-900/30 text-green-400",
    Enrolled: "bg-[#CEFF00]/20 text-[#CEFF00]",
  };

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, active: true },
    { href: "/admin/applications", label: "Applications", icon: Users, active: false },
    { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquare, active: false },
  ];

  return (
    <div className="min-h-screen bg-[#161616] flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#222222] border-r border-[#333333] transform transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}>
        <div className="p-6 border-b border-[#333333]">
          <div className="flex items-center gap-3">
            <img src="/edex-logo.png" alt="EDEX Life School" className="h-8 object-contain" />
            <div>
              <div className="font-bold text-white text-sm">EDEX Admin</div>
              <div className="text-[#777777] text-xs">Admissions Portal</div>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-[#CEFF00]/10 text-[#CEFF00]" : "text-[#999999] hover:text-white hover:bg-[#333333]"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#333333]">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#999999] hover:text-white hover:bg-[#333333] transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="bg-[#222222] border-b border-[#333333] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-[#999999] hover:text-white">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-lg font-bold text-white">Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-[#333333] border border-[#444444] text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#CEFF00]"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="thisMonth">This month</option>
              <option value="all">All time</option>
            </select>

            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="bg-[#333333] border border-[#444444] text-gray-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#CEFF00]"
            >
              <option value="all">All Programs</option>
              <option value="EGX 100">EGX 100</option>
              <option value="EDEX Next">EDEX Next</option>
            </select>

            <button
              onClick={fetchStats}
              disabled={loading}
              className="p-1.5 text-[#999999] hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </header>

        <main className="p-6">
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#222222] rounded-xl p-5 animate-pulse h-24" />
              ))}
            </div>
          ) : stats ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Applications", value: stats.total, icon: Users, color: "text-blue-400", href: "/admin/applications" },
                  { label: "Paid", value: stats.paid, icon: CreditCard, color: "text-[#CEFF00]", href: "/admin/applications?paymentStatus=paid" },
                  { label: "Payment Pending", value: stats.paymentPending, icon: Clock, color: "text-yellow-400", href: "/admin/applications?paymentStatus=payment_pending" },
                  { label: "Enrolled", value: stats.byAdmissionStatus?.Enrolled ?? 0, icon: UserCheck, color: "text-green-400", href: "/admin/applications?admissionStatus=Enrolled" },
                ].map(({ label, value, icon: Icon, color, href }) => (
                  <Link key={label} href={href} className="bg-[#222222] border border-[#333333] rounded-xl p-5 hover:border-[#CEFF00]/50 hover:bg-[#333333]/50 transition-colors block cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[#999999] text-sm">{label}</span>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className={`text-3xl font-bold ${color}`}>{value}</div>
                  </Link>
                ))}
              </div>

              {/* Breakdown row */}
              <div className="grid lg:grid-cols-3 gap-4 mb-6">
                {/* Admission pipeline */}
                <div className="bg-[#222222] border border-[#333333] rounded-xl p-5 lg:col-span-2">
                  <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Admission Pipeline</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.byAdmissionStatus ?? {}).map(([status, count]) => (
                      <Link 
                        key={status} 
                        href={`/admin/applications?admissionStatus=${encodeURIComponent(status)}`}
                        className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-[#333333]/50 transition-colors cursor-pointer block"
                      >
                        <div className="flex items-center w-full">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColors[status] ?? "bg-[#333333] text-[#999999]"} shrink-0 w-24 text-center`}>
                            {status}
                          </span>
                          <div className="flex items-center gap-3 flex-1 ml-3">
                            <div className="flex-1 bg-[#333333] rounded-full h-1.5">
                              <div
                                className="bg-[#CEFF00] h-1.5 rounded-full"
                                style={{ width: `${stats.total > 0 ? ((count as number) / stats.total) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-white font-bold text-sm w-6 text-right">{count as number}</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Program split */}
                <div className="bg-[#222222] border border-[#333333] rounded-xl p-5">
                  <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">By Program</h3>
                  <div className="space-y-4">
                    {Object.entries(stats.byProgram ?? {}).map(([prog, count]) => (
                      <Link 
                        key={prog}
                        href={`/admin/applications?program=${encodeURIComponent(prog)}`}
                        className="block p-2 -mx-2 rounded-lg hover:bg-[#333333]/50 transition-colors cursor-pointer"
                      >
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[#999999]">{prog}</span>
                          <span className="text-white font-bold">{count as number}</span>
                        </div>
                        <div className="bg-[#333333] rounded-full h-1.5">
                          <div
                            className="bg-[#CEFF00] h-1.5 rounded-full"
                            style={{ width: `${stats.total > 0 ? ((count as number) / stats.total) * 100 : 0}%` }}
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent applications */}
              <div className="bg-[#222222] border border-[#333333] rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white text-sm uppercase tracking-wider">Recent Paid Applications</h3>
                  <Link href="/admin/applications" className="text-[#CEFF00] text-sm hover:underline flex items-center gap-1">
                    View all <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="space-y-3">
                  {stats.recentApplications?.length === 0 && (
                    <p className="text-[#777777] text-sm text-center py-4">No applications yet</p>
                  )}
                  {stats.recentApplications?.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-3 bg-[#333333]/50 rounded-lg">
                      <div>
                        <div className="font-bold text-white text-sm">{app.name}</div>
                        <div className="text-[#777777] text-xs">{app.id} · {app.program}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColors[app.admissionStatus] ?? "bg-gray-700 text-gray-300"}`}>
                          {app.admissionStatus}
                        </span>
                        <Link href={`/admin/applications?id=${app.id}`} className="text-[#777777] hover:text-[#CEFF00]">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

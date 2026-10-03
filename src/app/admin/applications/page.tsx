"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  LayoutDashboard, Users, MessageSquare, LogOut, Menu, X,
  Search, Filter, ChevronLeft, ChevronRight, MoreVertical, Edit, Trash
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

type Application = {
  id: string;
  program: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  payment_status: string;
  admission_status: string;
  created_at: string;
  is_deleted: boolean;
};

export default function AdminApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [admissionStatus, setAdmissionStatus] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [hasInitializedParams, setHasInitializedParams] = useState(false);
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("program")) setProgram(params.get("program")!);
      if (params.has("paymentStatus")) setPaymentStatus(params.get("paymentStatus")!);
      if (params.has("admissionStatus")) setAdmissionStatus(params.get("admissionStatus")!);
    }
    setHasInitializedParams(true);
  }, []);
  
  // Drawer state
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const supabase = createBrowserSupabaseClient();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/admin"; return; }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        search: debouncedSearch,
        program,
        paymentStatus,
        admissionStatus,
      });

      const res = await fetch(`/api/admin/applications?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, program, paymentStatus, admissionStatus]);

  useEffect(() => { 
    if (hasInitializedParams) {
      fetchApplications(); 
    }
  }, [fetchApplications, hasInitializedParams]);

  const fetchApplicationDetails = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Quick fetch for notes (could also be part of the main list if we wanted)
    const { data, error } = await supabase
      .from("applications")
      .select("internal_notes")
      .eq("id", id)
      .single();
      
    if (data) setInternalNotes(data.internal_notes || "");
  };

  const handleOpenDrawer = (app: Application) => {
    setSelectedApp(app);
    setUpdateStatus(app.admission_status);
    setInternalNotes("Loading...");
    fetchApplicationDetails(app.id);
  };

  const handleUpdate = async () => {
    if (!selectedApp) return;
    setUpdating(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          admissionStatus: updateStatus,
          internalNotes,
        }),
      });

      if (res.ok) {
        setApplications(apps => apps.map(a => a.id === selectedApp.id ? { ...a, admission_status: updateStatus } : a));
        setSelectedApp(null);
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ applicationId: id, isDeleted: true }),
      });
      fetchApplications();
    } catch (e) {
      console.error(e);
    }
  };

  const statusColors: Record<string, string> = {
    New: "bg-blue-900/30 text-blue-400",
    Contacted: "bg-yellow-900/30 text-yellow-400",
    "Under Review": "bg-purple-900/30 text-purple-400",
    Selected: "bg-green-900/30 text-green-400",
    Enrolled: "bg-[#CEFF00]/20 text-[#CEFF00]",
    payment_pending: "bg-yellow-900/30 text-yellow-400",
    paid: "bg-green-900/30 text-green-400",
    failed: "bg-red-900/30 text-red-400",
  };

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, active: false },
    { href: "/admin/applications", label: "Applications", icon: Users, active: true },
    { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquare, active: false },
  ];

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-gray-950 flex font-sans">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static lg:z-auto`}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#CEFF00] flex items-center justify-center">
              <span className="text-[#161616] font-bold text-xs">EX</span>
            </div>
            <div>
              <div className="font-bold text-white text-sm">EDEX Admin</div>
              <div className="text-gray-500 text-xs">Admissions Portal</div>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon, active }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-[#CEFF00]/10 text-[#CEFF00]" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col h-screen">
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-gray-400 hover:text-white">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-lg font-bold text-white">Applications</h1>
          </div>
        </header>

        <main className="p-6 flex-1 overflow-auto">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search ID, name, email, phone..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:border-[#CEFF00]"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
              <Filter className="w-4 h-4 text-gray-500 shrink-0" />
              <select
                value={program}
                onChange={(e) => { setProgram(e.target.value); setPage(1); }}
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#CEFF00] shrink-0"
              >
                <option value="all">All Programs</option>
                <option value="EGX 100">EGX 100</option>
                <option value="EDEX Next">EDEX Next</option>
              </select>
              <select
                value={paymentStatus}
                onChange={(e) => { setPaymentStatus(e.target.value); setPage(1); }}
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#CEFF00] shrink-0"
              >
                <option value="all">Any Payment</option>
                <option value="paid">Paid</option>
                <option value="payment_pending">Pending</option>
              </select>
              <select
                value={admissionStatus}
                onChange={(e) => { setAdmissionStatus(e.target.value); setPage(1); }}
                className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#CEFF00] shrink-0"
              >
                <option value="all">Any Status</option>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Under Review">Under Review</option>
                <option value="Selected">Selected</option>
                <option value="Enrolled">Enrolled</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-400">
                <thead className="bg-gray-800/50 text-gray-300 text-xs uppercase font-medium">
                  <tr>
                    <th className="px-6 py-4">ID & Date</th>
                    <th className="px-6 py-4">Applicant</th>
                    <th className="px-6 py-4">Program</th>
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Loading...</td>
                    </tr>
                  ) : applications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No applications found</td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">{app.id}</div>
                          <div className="text-xs text-gray-500 mt-1">{format(new Date(app.created_at), 'dd MMM yyyy, HH:mm')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white font-medium">{app.first_name} {app.last_name}</div>
                          <div className="text-xs text-gray-500 mt-1">{app.email}</div>
                          <div className="text-xs text-gray-500">{app.mobile}</div>
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-300">{app.program}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[app.payment_status] || "bg-gray-800 text-gray-400"}`}>
                            {app.payment_status === "payment_pending" ? "Pending" : app.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[app.admission_status] || "bg-gray-800 text-gray-400"}`}>
                            {app.admission_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handleOpenDrawer(app)}
                              className="p-2 text-gray-400 hover:text-[#CEFF00] hover:bg-gray-800 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(app.id)}
                              className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && total > 0 && (
              <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Showing <span className="text-white">{(page - 1) * 20 + 1}</span> to <span className="text-white">{Math.min(page * 20, total)}</span> of <span className="text-white">{total}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg border border-gray-700 text-gray-400 disabled:opacity-30 hover:bg-gray-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-gray-700 text-gray-400 disabled:opacity-30 hover:bg-gray-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drawer */}
      {selectedApp && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedApp(null)} />
          <div className="relative w-full max-w-md bg-gray-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">Manage Application</h2>
              <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-auto">
              <div className="mb-6">
                <div className="text-sm text-gray-500 mb-1">Applicant</div>
                <div className="text-lg font-bold text-white">{selectedApp.first_name} {selectedApp.last_name}</div>
                <div className="text-sm text-gray-400">{selectedApp.id}</div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Admission Status</label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-[#CEFF00]"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Selected">Selected</option>
                    <option value="Enrolled">Enrolled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Internal Notes</label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={6}
                    placeholder="Add private notes about this applicant..."
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-[#CEFF00] resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex items-center justify-end gap-3">
              <button 
                onClick={() => setSelectedApp(null)}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdate}
                disabled={updating}
                className="px-6 py-2 bg-[#CEFF00] text-[#161616] text-sm font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-50"
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import {
  LayoutDashboard, Users, MessageSquare, LogOut, Menu, X,
  Plus, Edit, Trash, GripVertical, Check, UploadCloud, Loader2
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

type Testimonial = {
  id: string;
  student_name: string;
  place: string;
  batch: string;
  video_url: string;
  thumbnail_url: string;
  display_order: number;
  is_active: boolean;
  is_deleted: boolean;
  created_at: string;
};

export default function AdminTestimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [place, setPlace] = useState("");
  const [batch, setBatch] = useState("EGX 100 - Previous Batch");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const supabase = createBrowserSupabaseClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = "/admin"; return; }

    try {
      const res = await fetch(`/api/admin/testimonials?includeDeleted=false`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTestimonials(data.testimonials);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const uploadToCloudinary = async (file: File, folder: string, resourceType: "video" | "image", publicId: string, eager?: string) => {
    const timestamp = Math.round(new Date().getTime() / 1000).toString();
    const paramsToSign: Record<string, string> = { timestamp, folder, public_id: publicId };
    if (eager) paramsToSign.eager = eager;

    const { data: { session } } = await supabase.auth.getSession();
    const sigRes = await fetch("/api/admin/cloudinary/signature", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({ paramsToSign })
    });
    
    if (!sigRes.ok) throw new Error("Failed to get upload signature");
    const { signature, apiKey, cloudName } = await sigRes.json();
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp);
    formData.append("signature", signature);
    formData.append("folder", folder);
    formData.append("public_id", publicId);
    if (eager) formData.append("eager", eager);
    
    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: "POST",
      body: formData
    });
    
    if (!uploadRes.ok) {
      const errorData = await uploadRes.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Failed to upload ${resourceType} to Cloudinary`);
    }
    
    return await uploadRes.json();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTestimonial && !videoFile) {
      setUploadError("Video file is required");
      return;
    }

    setUploading(true);
    setUploadError("");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      let res;
      if (editingTestimonial) {
        let thumbnailUrl = undefined;
        
        if (thumbnailFile) {
          const publicId = `${Date.now()}_${studentName.replace(/\s+/g, "_").toLowerCase()}_thumb`;
          const cloudRes = await uploadToCloudinary(thumbnailFile, "testimonials/thumbnails", "image", publicId);
          thumbnailUrl = cloudRes.secure_url;
        }

        res = await fetch("/api/admin/testimonials", {
          method: "PATCH",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}` 
          },
          body: JSON.stringify({
             id: editingTestimonial.id,
             studentName,
             place,
             batch,
             displayOrder: parseInt(displayOrder || "0"),
             thumbnailUrl
          }),
        });
      } else {
        // Upload video directly from client
        const baseId = `${Date.now()}_${studentName.replace(/\s+/g, "_").toLowerCase()}`;
        const videoRes = await uploadToCloudinary(videoFile!, "testimonials", "video", baseId, "w_640,h_360,c_fill,f_jpg");
        const videoUrl = videoRes.secure_url;
        let thumbnailUrl = videoRes.eager?.[0]?.secure_url || videoRes.secure_url.replace(/\.[^.]+$/, ".jpg");

        // Upload custom thumb directly if needed
        if (thumbnailFile) {
          const thumbRes = await uploadToCloudinary(thumbnailFile, "testimonials/thumbnails", "image", `${baseId}_thumb`);
          thumbnailUrl = thumbRes.secure_url;
        }

        res = await fetch("/api/admin/testimonials", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}` 
          },
          body: JSON.stringify({
            studentName,
            place,
            batch,
            displayOrder: parseInt(displayOrder || "0"),
            videoUrl,
            thumbnailUrl
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (editingTestimonial ? "Update failed" : "Upload failed"));

      // Reset & Reload
      setShowUploadModal(false);
      setEditingTestimonial(null);
      setStudentName("");
      setPlace("");
      setBatch("EGX 100 - Previous Batch");
      setDisplayOrder("0");
      setVideoFile(null);
      setThumbnailFile(null);
      fetchTestimonials();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const openEditModal = (t: Testimonial) => {
    setEditingTestimonial(t);
    setStudentName(t.student_name);
    setPlace(t.place);
    setBatch(t.batch);
    setDisplayOrder(t.display_order.toString());
    setVideoFile(null);
    setThumbnailFile(null);
    setShowUploadModal(true);
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setShowUploadModal(false);
    setEditingTestimonial(null);
    setStudentName("");
    setPlace("");
    setBatch("EGX 100 - Previous Batch");
    setDisplayOrder("0");
    setVideoFile(null);
    setThumbnailFile(null);
    setUploadError("");
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await fetch("/api/admin/testimonials", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });
      fetchTestimonials();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      await fetch("/api/admin/testimonials", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id, isDeleted: true }),
      });
      fetchTestimonials();
    } catch (e) {
      console.error(e);
    }
  };

  const navItems = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, active: false },
    { href: "/admin/applications", label: "Applications", icon: Users, active: false },
    { href: "/admin/testimonials", label: "Testimonials", icon: MessageSquare, active: true },
  ];

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
            <h1 className="text-lg font-bold text-white">Testimonials</h1>
          </div>
          
          <button 
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 bg-[#CEFF00] text-[#161616] px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Testimonial
          </button>
        </header>

        <main className="p-6 flex-1 overflow-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 h-64 animate-pulse" />
              ))}
            </div>
          ) : testimonials.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageSquare className="w-16 h-16 text-gray-800 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">No Testimonials</h3>
              <p className="text-gray-500 mb-6 max-w-md">Upload student testimonials to show on the landing page. Videos will be processed and hosted on Cloudinary automatically.</p>
              <button 
                onClick={() => setShowUploadModal(true)}
                className="bg-gray-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
              >
                Upload First Testimonial
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {testimonials.map((t) => {
                const getObjectPosition = (name: string, type: 'video' | 'thumbnail') => {
                  const n = name.toLowerCase();
                  if (n.includes("mukthar")) return type === 'video' ? "object-[center_60%]" : "object-top";
                  if (n.includes("vyshnav") || n.includes("asil ali")) return "object-[center_45%]";
                  if (n.includes("afsal")) return "object-[center_15%]";
                  return "object-[center_25%]";
                };

                return (
                <div 
                  key={t.id} 
                  className={`bg-gray-900 border ${t.is_active ? 'border-gray-700 hover:border-gray-500' : 'border-gray-800 opacity-60'} rounded-xl overflow-hidden flex flex-col transition-all cursor-pointer group`}
                  onClick={() => openEditModal(t)}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {hoveredId === t.id ? (
                      <video 
                        src={t.video_url} 
                        className={`w-full h-full object-cover ${getObjectPosition(t.student_name, 'video')}`} 
                        autoPlay 
                        loop 
                      />
                    ) : (
                      <img src={t.thumbnail_url} alt={t.student_name} className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${getObjectPosition(t.student_name, 'thumbnail')}`} />
                    )}
                    {!t.is_active && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="bg-black/80 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">Inactive</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="text-white font-bold text-lg">{t.student_name}</h3>
                        <p className="text-gray-500 text-sm">{t.place} • {t.batch}</p>
                      </div>
                      <div className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded flex items-center gap-1">
                        <GripVertical className="w-3 h-3 text-gray-500" />
                        Order: {t.display_order}
                      </div>
                    </div>
                    
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-800">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleActive(t.id, t.is_active); }}
                        className={`text-sm font-medium flex items-center gap-1 ${t.is_active ? 'text-gray-400 hover:text-yellow-400' : 'text-[#CEFF00] hover:text-white'}`}
                      >
                        {t.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </main>
      </div>

      {/* Upload/Edit Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={closeUploadModal} />
          <div className="relative bg-gray-900 border border-gray-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">{editingTestimonial ? "Edit Testimonial" : "Upload Testimonial"}</h2>
              <button 
                type="button"
                onClick={closeUploadModal} 
                disabled={uploading}
                className="text-gray-400 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpload} className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Student Name *</label>
                  <input
                    required
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-[#CEFF00]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Place *</label>
                  <input
                    required
                    type="text"
                    value={place}
                    onChange={(e) => setPlace(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-[#CEFF00]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Batch/Program *</label>
                  <select
                    required
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-[#CEFF00]"
                  >
                    <option value="EGX 100 - Previous Batch">EGX 100 - Previous Batch</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-[#CEFF00]"
                  />
                </div>
              </div>

              {!editingTestimonial && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Video File (MP4, WebM) *</label>
                    <div 
                      className={`border-2 border-dashed ${videoFile ? 'border-[#CEFF00] bg-[#CEFF00]/5' : 'border-gray-700 hover:border-gray-500'} rounded-lg p-6 text-center cursor-pointer transition-colors`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="video/*" 
                        onChange={(e) => setVideoFile(e.target.files?.[0] || null)} 
                      />
                      {videoFile ? (
                        <div className="text-[#CEFF00] font-medium flex items-center justify-center gap-2">
                          <Check className="w-5 h-5" /> {videoFile.name} ({(videoFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </div>
                      ) : (
                        <div className="text-gray-400 flex flex-col items-center">
                          <UploadCloud className="w-8 h-8 mb-2" />
                          <span>Click to browse for video</span>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Custom Thumbnail (Optional)</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="file" 
                    ref={thumbInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} 
                  />
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
                  >
                    {thumbnailFile ? "Change Thumbnail" : "Browse Image"}
                  </button>
                  {thumbnailFile && <span className="text-sm text-gray-400 truncate max-w-[200px]">{thumbnailFile.name}</span>}
                  {editingTestimonial && !thumbnailFile && (
                    <span className="text-sm text-gray-500">Leave blank to keep current banner</span>
                  )}
                </div>
              </div>

              {uploadError && <div className="p-3 bg-red-900/30 border border-red-900 text-red-400 rounded-lg text-sm mb-6">{uploadError}</div>}

              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={closeUploadModal}
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={uploading || (!editingTestimonial && !videoFile) || !studentName || !place || !batch}
                  className="px-6 py-2 bg-[#CEFF00] text-[#161616] text-sm font-bold rounded-lg hover:bg-white transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {uploading ? "Saving..." : editingTestimonial ? "Save Changes" : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

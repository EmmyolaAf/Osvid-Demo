"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUsersByRole, updateManagerProfile } from "@/lib/firebase/firestore";
import { UserProfile, ManagerPermissions, DEFAULT_MANAGER_PERMISSIONS } from "@/types/auth";
import {
  Users,
  UserPlus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Phone,
  Shield,
  Briefcase,
  AlertCircle,
  Search,
  KeyRound,
  Edit2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function ManagersManagementPage() {
  const { userProfile, createManager, toggleUserStatus, deleteUser, isAdmin, isSuperAdmin } = useAuth();
  const [managers, setManagers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phoneNumber: "",
    customTitle: "Operations Manager",
    password: "",
  });
  const [createPermissions, setCreatePermissions] = useState<ManagerPermissions>({
    ...DEFAULT_MANAGER_PERMISSIONS,
  });

  // Edit Manager Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedManager, setSelectedManager] = useState<UserProfile | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPermissions, setEditPermissions] = useState<ManagerPermissions>({
    ...DEFAULT_MANAGER_PERMISSIONS,
  });

  const loadManagers = async () => {
    try {
      setLoading(true);
      const list = await getUsersByRole("manager");
      setManagers(list);
    } catch (err) {
      console.error("Error loading managers:", err);
      toast.error("Failed to load manager accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadManagers();
  }, []);

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.displayName || !formData.email) {
      toast.error("Please provide both name and email");
      return;
    }

    try {
      setSubmitting(true);
      await createManager({
        displayName: formData.displayName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        customTitle: formData.customTitle || "Operations Manager",
        password: formData.password || "OsvidManager2026!",
        permissions: createPermissions,
      });

      toast.success(`Manager account created for ${formData.displayName}!`);
      setIsCreateOpen(false);
      setFormData({
        displayName: "",
        email: "",
        phoneNumber: "",
        customTitle: "Operations Manager",
        password: "",
      });
      setCreatePermissions({ ...DEFAULT_MANAGER_PERMISSIONS });
      loadManagers();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create manager account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (mgr: UserProfile) => {
    setSelectedManager(mgr);
    setEditTitle(mgr.customTitle || "Operations Manager");
    setEditPermissions({
      canManageProducts: mgr.permissions?.canManageProducts ?? true,
      canManageOrders: mgr.permissions?.canManageOrders ?? true,
      canViewFinancials: mgr.permissions?.canViewFinancials ?? false,
      canManageWebsite: mgr.permissions?.canManageWebsite ?? false,
      canManageCustomers: mgr.permissions?.canManageCustomers ?? true,
      canManageDiscounts: mgr.permissions?.canManageDiscounts ?? false,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManager) return;

    try {
      setSubmitting(true);
      await updateManagerProfile(selectedManager.uid, {
        customTitle: editTitle,
        permissions: editPermissions,
      });

      toast.success(`Permissions updated for ${selectedManager.displayName}`);
      setIsEditOpen(false);
      loadManagers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update manager");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (mgr: UserProfile) => {
    try {
      const newStatus = !mgr.isActive;
      await toggleUserStatus(mgr.uid, newStatus);
      toast.success(`Manager status updated to ${newStatus ? "Active" : "Inactive"}`);
      setManagers((prev) =>
        prev.map((m) => (m.uid === mgr.uid ? { ...m, isActive: newStatus } : m))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleDeleteManager = async (uid: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete manager account "${name}"?`)) {
      return;
    }

    try {
      await deleteUser(uid);
      toast.success("Manager account deleted successfully");
      setManagers((prev) => prev.filter((m) => m.uid !== uid));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete manager");
    }
  };

  const filteredManagers = managers.filter(
    (m) =>
      m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.customTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phoneNumber?.includes(searchTerm)
  );

  return (
    <ProtectedRoute allowedRoles={["super_admin", "admin"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-600/20">
                <Briefcase size={20} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Manager &amp; Staff Roles</h1>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Appoint custom managers (e.g. Logistics, Products, Storefront) and delegate granular module permissions.
            </p>
          </div>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl shadow-lg shadow-orange-600/25 flex items-center gap-2 h-11 px-5"
          >
            <UserPlus size={18} />
            <span>Create New Manager</span>
          </Button>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search managers by name, custom title, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-medium"
          />
        </div>

        {/* Managers Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading manager profiles...</p>
            </div>
          ) : filteredManagers.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No managers found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                You haven&apos;t created any manager accounts yet, or your search did not match any active profiles.
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                variant="outline"
                className="text-xs font-semibold rounded-xl"
              >
                <UserPlus size={14} className="mr-1.5" />
                Add Your First Manager
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] uppercase tracking-wider font-bold text-slate-400">
                  <tr>
                    <th className="py-4 px-6">Manager &amp; Title</th>
                    <th className="py-4 px-6">Assigned Permissions</th>
                    <th className="py-4 px-6">Contact Info</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredManagers.map((mgr) => {
                    const perms = mgr.permissions || DEFAULT_MANAGER_PERMISSIONS;
                    return (
                      <tr key={mgr.uid} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm">
                              {mgr.displayName?.charAt(0).toUpperCase() || "M"}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{mgr.displayName}</p>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                {mgr.customTitle || "Operations Manager"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {perms.canManageProducts && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                Products
                              </span>
                            )}
                            {perms.canManageOrders && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                Orders
                              </span>
                            )}
                            {perms.canViewFinancials && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                                Financials
                              </span>
                            )}
                            {perms.canManageWebsite && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-100">
                                Website Builder
                              </span>
                            )}
                            {perms.canManageCustomers && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                Customers
                              </span>
                            )}
                            {perms.canManageDiscounts && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-100">
                                Discounts
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-slate-600 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Mail size={13} className="text-slate-400" />
                            <span>{mgr.email}</span>
                          </div>
                          {mgr.phoneNumber && (
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Phone size={13} className="text-slate-400" />
                              <span>{mgr.phoneNumber}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          {mgr.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 size={12} />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              <XCircle size={12} />
                              Deactivated
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(mgr)}
                              className="text-xs h-8 text-slate-600 hover:text-slate-900 rounded-lg gap-1"
                            >
                              <Settings size={14} />
                              <span>Permissions</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleStatus(mgr)}
                              className="text-xs h-8 rounded-lg"
                            >
                              {mgr.isActive ? "Deactivate" : "Activate"}
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteManager(mgr.uid, mgr.displayName)}
                              className="text-xs h-8 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Manager Dialog Modal */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="sm:max-w-lg bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <UserPlus className="text-orange-600 w-5 h-5" />
                Create New Operations Manager
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Designate a custom manager role and choose the exact dashboard modules they can access.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateManager} className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-700">Full Name *</Label>
                  <Input
                    required
                    placeholder="e.g. John Olabisi"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-700">Custom Title / Role</Label>
                  <Input
                    placeholder="e.g. Logistics Lead, Product Manager"
                    value={formData.customTitle}
                    onChange={(e) => setFormData({ ...formData, customTitle: e.target.value })}
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-700">Email Address *</Label>
                  <Input
                    type="email"
                    required
                    placeholder="manager@osvidchemicals.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase text-slate-700">Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="mt-1 h-10 rounded-xl"
                  />
                </div>
              </div>

              {/* Granular Permissions Checkboxes */}
              <div className="pt-2 border-t border-slate-100">
                <Label className="text-xs font-bold uppercase text-slate-700 mb-2 block">
                  Assign Delegated Permissions
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createPermissions.canManageProducts}
                      onChange={(e) =>
                        setCreatePermissions({
                          ...createPermissions,
                          canManageProducts: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Products &amp; Inventory</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createPermissions.canManageOrders}
                      onChange={(e) =>
                        setCreatePermissions({
                          ...createPermissions,
                          canManageOrders: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Orders &amp; Fulfillment</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createPermissions.canViewFinancials}
                      onChange={(e) =>
                        setCreatePermissions({
                          ...createPermissions,
                          canViewFinancials: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Financials &amp; Analytics</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createPermissions.canManageWebsite}
                      onChange={(e) =>
                        setCreatePermissions({
                          ...createPermissions,
                          canManageWebsite: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Website Content Builder</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createPermissions.canManageCustomers}
                      onChange={(e) =>
                        setCreatePermissions({
                          ...createPermissions,
                          canManageCustomers: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Customer Management</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createPermissions.canManageDiscounts}
                      onChange={(e) =>
                        setCreatePermissions({
                          ...createPermissions,
                          canManageDiscounts: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Discounts &amp; Coupons</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={submitting}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Appoint Manager"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Manager Permissions Modal */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Settings className="text-orange-600 w-5 h-5" />
                Edit Manager Permissions
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Updating access for {selectedManager?.displayName} ({selectedManager?.email})
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-bold uppercase text-slate-700">Custom Title / Designation</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Warehouse & Logistics Lead"
                  required
                  className="mt-1 h-10 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase text-slate-700 mb-2 block">
                  Permissions Scope
                </Label>
                <div className="grid grid-cols-1 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                  <label className="flex items-center gap-2.5 text-xs text-slate-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPermissions.canManageProducts}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          canManageProducts: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Manage Products &amp; Stock</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPermissions.canManageOrders}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          canManageOrders: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Manage Orders &amp; Fulfillment</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPermissions.canViewFinancials}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          canViewFinancials: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>View Financials &amp; Analytics</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPermissions.canManageWebsite}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          canManageWebsite: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Access Front-End Website Builder</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPermissions.canManageCustomers}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          canManageCustomers: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Access Customer Directory</span>
                  </label>

                  <label className="flex items-center gap-2.5 text-xs text-slate-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPermissions.canManageDiscounts}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          canManageDiscounts: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-orange-600 rounded"
                    />
                    <span>Manage Discounts &amp; Coupons</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  disabled={submitting}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-600/20"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { OrderNote } from "@/types/auth";
import { getOrderNotesFromDb, addOrderNoteInDb } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Lock, Globe, Send, Loader2, Clock } from "lucide-react";

interface OrderNotesDrawerProps {
  orderId: string;
  authorName?: string;
}

export default function OrderNotesDrawer({
  orderId,
  authorName = "Staff Administrator",
}: OrderNotesDrawerProps) {
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [isCustomerVisible, setIsCustomerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const res = await getOrderNotesFromDb(orderId);
      setNotes(res);
    } catch (err) {
      console.warn("Could not load notes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      loadNotes();
    }
  }, [orderId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) {
      toast.error("Please enter a note before adding.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await addOrderNoteInDb(
        orderId,
        newNote.trim(),
        isCustomerVisible,
        authorName
      );

      if (res.success && res.data) {
        setNotes([res.data, ...notes]);
        setNewNote("");
        toast.success(
          isCustomerVisible
            ? "Customer note added and visible to purchaser."
            : "Private staff note saved successfully."
        );
      } else {
        toast.error(res.error || "Failed to add note.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error saving note.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <MessageSquare size={13} className="text-orange-600" />
          Order Notes &amp; Communication History
        </h4>
        <span className="text-[11px] font-bold text-slate-500">
          {notes.length} note{notes.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add an internal reference or note for the customer..."
          rows={2}
          className="bg-white rounded-xl text-xs border-slate-200"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              value={isCustomerVisible ? "customer" : "private"}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setIsCustomerVisible(e.target.value === "customer")}
              className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-bold text-slate-700 outline-none"
            >
              <option value="private">Private Internal Note</option>
              <option value="customer">Note to Customer</option>
            </select>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              {isCustomerVisible ? (
                <>
                  <Globe size={11} className="text-blue-500" /> Visible on invoice
                </>
              ) : (
                <>
                  <Lock size={11} className="text-amber-500" /> Internal only
                </>
              )}
            </span>
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={submitting || !newNote.trim()}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs h-8 px-4 gap-1.5"
          >
            {submitting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
            Add Note
          </Button>
        </div>
      </form>

      {/* Notes List */}
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading order notes...</div>
      ) : notes.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          No order notes recorded yet.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                note.isCustomerVisible
                  ? "bg-blue-50/60 border-blue-200/80 text-blue-950"
                  : "bg-amber-50/50 border-amber-200/80 text-amber-950"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1">
                  {note.isCustomerVisible ? (
                    <>
                      <Globe size={11} className="text-blue-600" /> Note to Customer
                    </>
                  ) : (
                    <>
                      <Lock size={11} className="text-amber-600" /> Private Internal Note
                    </>
                  )}
                  <span className="font-normal text-slate-500 ml-1">
                    by {note.authorName || "Staff"}
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(note.createdAt).toLocaleString("en-NG", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed font-normal">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

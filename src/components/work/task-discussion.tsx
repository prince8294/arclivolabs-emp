"use client";

import { useState, type FormEvent } from "react";
import { MessageSquareText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";

interface DiscussionComment {
  _id?: string;
  id?: string;
  message: string;
  createdAt: string;
  author?: { fullName: string; role?: string; profilePicture?: string } | null;
}

export function TaskDiscussion({
  taskId,
  admin,
  comments,
  onRefresh,
}: {
  taskId: string;
  admin: boolean;
  comments: DiscussionComment[];
  onRefresh: () => void;
}) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const base = admin ? "/api/admin" : "/api/employee";
      const response = await fetch(`${base}/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not post your comment.");
      setMessage("");
      onRefresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not post your comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-panel">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4"><MessageSquareText size={16} className="text-violet-200" /><h2 className="text-sm font-semibold text-white">Discussion</h2><span className="text-xs text-slate-500">{comments.length}</span></div>
      <div className="max-h-[440px] space-y-4 overflow-y-auto p-5">
        {comments.length ? comments.map((comment) => (
          <div key={comment._id ?? comment.id ?? `${comment.createdAt}-${comment.message}`} className="flex gap-3">
            <UserAvatar name={comment.author?.fullName ?? "Team member"} src={comment.author?.profilePicture} className="size-8 shrink-0 text-[10px]" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-xs font-medium text-slate-200">{comment.author?.fullName ?? "Team member"}</p><time className="text-[10px] text-slate-500">{new Date(comment.createdAt).toLocaleString()}</time></div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">{comment.message}</p>
            </div>
          </div>
        )) : <p className="py-4 text-center text-sm text-slate-500">No comments yet. Start the discussion with a project update or question.</p>}
      </div>
      <form onSubmit={submit} className="border-t border-white/[0.06] p-4">
        <label className="sr-only" htmlFor={`comment-${taskId}`}>Add a comment</label>
        <textarea id={`comment-${taskId}`} required minLength={1} maxLength={2000} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a comment…" className="w-full resize-y rounded-xl border border-white/10 bg-sidebar px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-accent" />
        {error && <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p>}
        <div className="mt-3 flex justify-end"><Button type="submit" size="sm" disabled={busy || !message.trim()}><Send size={14} />{busy ? "Posting…" : "Post comment"}</Button></div>
      </form>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getGroupFiles, uploadGroupFile, deleteGroupFile, downloadFile } from "../../api/client";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { PaperClipIcon, TrashIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";

function formatSize(bytes) {
  if (!bytes) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Internal group collaboration files — drafts, references, anything the
 * group is working on together. Deliberately separate from the
 * Submissions tab on Assignments: this never leaves the group, no
 * lecturer/rep ever sees it. That's the whole point of "internal".
 */
export default function SharedFiles({ user, group }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    getGroupFiles()
      .then((r) => setFiles(r.data))
      .catch(() => setError("Couldn't load shared files."))
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const r = await uploadGroupFile(file);
      setFiles([r.data, ...files]);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.file?.[0] || data?.error || "Couldn't upload that file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteGroupFile(id);
      setFiles(files.filter((f) => f.id !== id));
    } catch {
      setError("Couldn't remove that file.");
    }
  };

  const canDelete = (file) => file.uploaded_by === user.id || group.leader?.id === user.id;

  return (
    <div className="bg-surface rounded-[--radius-card] border border-border p-6 mt-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-display text-lg font-semibold text-ink">Shared Files</h2>
        <Button
          variant="outline" size="sm" icon={ArrowUpTrayIcon}
          loading={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
      </div>
      <p className="text-sm text-muted mb-4">
        Internal to your group only — for drafts and working files. This isn't your final
        submission; use the Assignments tab for that.
      </p>

      {error && <Alert type="error">{error}</Alert>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted">No files shared yet. Upload something for the group to see.</p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {files.map((file) => (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center justify-between gap-3 bg-paper rounded-[--radius-control] px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PaperClipIcon className="w-4 h-4 text-muted shrink-0" />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => downloadFile(file.file, file.filename)}
                      className="text-sm font-medium text-ink hover:text-accent-dark truncate block text-left"
                    >
                      {file.filename}
                    </button>
                    <p className="text-xs text-muted truncate">
                      {file.uploaded_by_detail?.full_name} · {new Date(file.uploaded_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
                {canDelete(file) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(file.id)}
                    className="text-muted hover:text-status-overdue shrink-0"
                    aria-label="Remove file"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

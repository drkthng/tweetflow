import React, { useCallback } from "react";

interface TweetBlockProps {
  content: string;
  mediaPath: string | null;
  onContentChange: (content: string) => void;
  onMediaChange: (path: string | null) => void;
  maxChars: number;
  suffix: string;
}

const TweetBlock: React.FC<TweetBlockProps> = ({
  content,
  mediaPath,
  onContentChange,
  onMediaChange,
  maxChars,
  suffix,
}) => {
  const charCount = content.length;
  const isOverLimit = charCount > maxChars;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // @ts-ignore
      const savedPath = await window.api.handleMediaUpload(file.path);
      onMediaChange(savedPath);
    }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        // Convert blob to base64 and save via IPC
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = reader.result as string;
          // Strip the data:image/png;base64, prefix
          const base64 = dataUrl.split(",")[1];
          if (base64) {
            const savedPath = await window.api.savePastedImage(base64);
            onMediaChange(savedPath);
          }
        };
        reader.readAsDataURL(blob);
        return; // Only handle the first image
      }
    }
    // If no image found, let the default paste (text) happen
  }, [onMediaChange]);

  return (
    <div className="tweet-editor-stage">
      <textarea
        placeholder="What's happening? (paste images with Ctrl+V)"
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        onPaste={handlePaste}
        style={{
          width: "100%",
          minHeight: "200px",
          borderColor: isOverLimit ? "#ff4444" : "var(--border)",
          marginBottom: "0.5rem",
          fontSize: "1.2rem",
        }}
      />

      {mediaPath && (
        <div style={{ marginBottom: "0.5rem", position: "relative", display: "inline-block" }}>
          <img
            src={`file://${mediaPath}`}
            alt="attachment"
            style={{
              maxWidth: "100%",
              maxHeight: "180px",
              borderRadius: "8px",
              border: "1px solid var(--border)",
            }}
          />
          <button
            onClick={() => onMediaChange(null)}
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              background: "rgba(0,0,0,0.7)",
              border: "none",
              color: "#fff",
              borderRadius: "50%",
              width: "24px",
              height: "24px",
              cursor: "pointer",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="media-selector">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            id="media-input-stage"
            style={{ display: "none" }}
          />
          <label
            htmlFor="media-input-stage"
            className="btn-secondary"
            style={{ padding: "0.6rem 1rem", cursor: "pointer" }}
          >
            {mediaPath ? "📷 Change Media" : "📷 Attach Media"}
          </label>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: "bold",
              color: isOverLimit ? "#ff4444" : "var(--text-secondary)",
            }}
          >
            {charCount} / {maxChars}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              marginTop: "0.2rem",
            }}
          >
            Suffix: "{suffix}"
          </div>
        </div>
      </div>
    </div>
  );
};

export default TweetBlock;
